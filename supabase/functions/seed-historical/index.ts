// Seed historical data for a league/season into the warehouse.
// phase 'season' -> fixtures + standings + players(+season stats). phase 'transfers' -> per team.
// Idempotent (upserts) + journaled (seed_runs). Call once per season from a driver.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const API_KEY = Deno.env.get('API_FOOTBALL_KEY')!
const API_HOST = 'v3.football.api-sports.io'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function api(path: string, params: Record<string, unknown>) {
  const url = new URL(`https://${API_HOST}${path}`)
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, String(v))
  const r = await fetch(url, { headers: { 'x-rapidapi-key': API_KEY, 'x-rapidapi-host': API_HOST } })
  if (!r.ok) throw new Error(`API ${path} -> ${r.status}`)
  return await r.json()
}
const n = (v: any) => (v == null ? null : Number(v))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { league_api_id, season, phase = 'season' } = await req.json()
    if (!league_api_id) throw new Error('league_api_id required')
    const db = createClient(SUPABASE_URL, SERVICE_KEY)

    // league row
    const lr = await api('/leagues', { id: league_api_id })
    const ld = lr.response?.[0]
    const { data: leagueRow } = await db.from('fb_leagues').upsert(
      { api_id: ld.league.id, name: ld.league.name, type: 'football_competition' }, { onConflict: 'api_id' }
    ).select('id').single()
    const leagueId = leagueRow?.id

    const out: any = { league_api_id, season, phase }

    if (phase === 'transfers') {
      // teams that played this league (from season stats), fetch their transfer trail
      const { data: teams } = await db.from('fb_player_season_stats')
        .select('team_api_id, team_name').eq('league_api_id', league_api_id)
      const uniq = [...new Map((teams ?? []).map((t: any) => [t.team_api_id, t.team_name])).entries()]
      let tx = 0
      for (const [teamId, teamName] of uniq) {
        try {
          const tr = await api('/transfers', { team: teamId })
          const rows: any[] = []
          for (const block of (tr.response ?? [])) {
            const p = block.player
            for (const t of (block.transfers ?? [])) {
              rows.push({
                player_id: p?.id, player_name: p?.name,
                transfer_date: t.date || null, type: t.type === 'N/A' ? null : t.type,
                team_out_api: t.teams?.out?.id ?? null, team_out_name: t.teams?.out?.name ?? null,
                team_in_api: t.teams?.in?.id ?? null, team_in_name: t.teams?.in?.name ?? null,
              })
            }
          }
          if (rows.length) { await db.from('fb_transfers').upsert(rows, { onConflict: 'player_id,transfer_date,team_in_api,team_out_api' }); tx += rows.length }
        } catch (e) { console.error('transfers team', teamId, String(e)) }
        await sleep(120)
      }
      out.teams = uniq.length; out.transfers = tx
      await db.from('seed_runs').upsert({ league_api_id, season: null, phase: 'transfers', status: 'done', detail: out }, { onConflict: 'league_api_id,season,phase' })
      return new Response(JSON.stringify({ ok: true, ...out }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    if (!season) throw new Error('season required for phase=season')

    // 1) Fixtures (+ teams)
    const fx = await api('/fixtures', { league: league_api_id, season })
    const teamRows = new Map<number, any>()
    const fixtureRows = (fx.response ?? []).map((f: any) => {
      teamRows.set(f.teams.home.id, { api_id: f.teams.home.id, name: f.teams.home.name, logo_url: f.teams.home.logo })
      teamRows.set(f.teams.away.id, { api_id: f.teams.away.id, name: f.teams.away.name, logo_url: f.teams.away.logo })
      return {
        api_id: f.fixture.id, date: f.fixture.date, status: f.fixture.status?.short,
        league_id: leagueId, season: Number(season), round: f.league?.round ?? null,
        home_team_id: f.teams.home.id, away_team_id: f.teams.away.id,
        goals_home: n(f.goals?.home), goals_away: n(f.goals?.away),
      }
    })
    if (teamRows.size) await db.from('fb_teams').upsert([...teamRows.values()], { onConflict: 'api_id' })
    if (fixtureRows.length) await db.from('fb_fixtures').upsert(fixtureRows, { onConflict: 'api_id' })
    out.fixtures = fixtureRows.length

    // 2) Standings
    const st = await api('/standings', { league: league_api_id, season })
    const table = st.response?.[0]?.league?.standings?.flat() ?? []
    const standRows = table.map((s: any) => ({
      league_id: leagueId, league_api_id: Number(league_api_id), season: Number(season),
      team_api_id: s.team?.id, team_name: s.team?.name, rank: s.rank, points: s.points,
      played: s.all?.played, win: s.all?.win, draw: s.all?.draw, lose: s.all?.lose,
      goals_for: s.all?.goals?.for, goals_against: s.all?.goals?.against, goals_diff: s.goalsDiff, form: s.form,
    }))
    if (standRows.length) await db.from('fb_standings').upsert(standRows, { onConflict: 'league_api_id,season,team_api_id' })
    out.standings = standRows.length

    // 3) Players (+ season stats), paginated
    let page = 1, totalPages = 1, players = 0
    do {
      const pr = await api('/players', { league: league_api_id, season, page })
      totalPages = pr.paging?.total ?? 1
      const pRows: any[] = [], sRows: any[] = []
      for (const item of (pr.response ?? [])) {
        const p = item.player
        pRows.push({
          id: p.id, name: p.name, firstname: p.firstname, lastname: p.lastname, age: p.age,
          birth_date: p.birth?.date || null, birth_place: p.birth?.place, birth_country: p.birth?.country,
          nationality: p.nationality, photo: p.photo,
        })
        const stat = (item.statistics ?? []).find((x: any) => x.league?.id === Number(league_api_id)) ?? item.statistics?.[0]
        if (stat) sRows.push({
          player_id: p.id, player_name: p.name, season: Number(season), league_api_id: Number(league_api_id),
          team_api_id: stat.team?.id, team_name: stat.team?.name, position: stat.games?.position,
          appearances: stat.games?.appearences, lineups: stat.games?.lineups, minutes: stat.games?.minutes,
          goals: stat.goals?.total ?? 0, assists: stat.goals?.assists ?? 0,
          yellow: stat.cards?.yellow ?? 0, red: stat.cards?.red ?? 0, rating: stat.games?.rating ? Number(stat.games.rating) : null,
        })
      }
      if (pRows.length) await db.from('fb_players').upsert(pRows, { onConflict: 'id' })
      if (sRows.length) await db.from('fb_player_season_stats').upsert(sRows, { onConflict: 'player_id,season,team_api_id,league_api_id' })
      players += pRows.length
      page++
      await sleep(150)
    } while (page <= totalPages && page <= 40)
    out.players = players

    await db.from('seed_runs').upsert({ league_api_id, season: Number(season), phase: 'season', status: 'done', detail: out }, { onConflict: 'league_api_id,season,phase' })
    return new Response(JSON.stringify({ ok: true, ...out }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message ?? e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
