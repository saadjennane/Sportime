// Reliable one-call import: league -> teams -> players -> fixtures.
// Runs server-side with the service role (bypasses RLS, handles all required
// columns). Guarded by an is_admin() check on the caller's JWT.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Call API-Football through the existing proxy edge function, forwarding the
// caller's JWT (the admin's) — the proxy accepts a user JWT.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function makeApiFootball(authHeader: string) {
  const call = async (path: string, params: Record<string, unknown>, attempt = 0): Promise<any> => {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/api-football-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: authHeader },
      body: JSON.stringify({ path, params }),
    })
    if (r.status === 429 && attempt < 5) { await sleep(10000); return call(path, params, attempt + 1) }
    if (!r.ok) throw new Error(`api-football-proxy ${path} -> ${r.status}`)
    return await r.json()
  }
  return call
}

function splitName(name: string) {
  const parts = (name || '').trim().split(' ')
  if (parts.length < 2) return { first: parts[0] || 'Unknown', last: 'Unknown' }
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { league_api_id, season } = await req.json()
    if (!league_api_id || !season) throw new Error('league_api_id and season are required')

    // ── Admin guard (use the caller's JWT) ─────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? ''
    const asCaller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
    const { data: isAdmin } = await asCaller.rpc('is_admin')
    if (isAdmin !== true) return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } })

    const apiFootball = makeApiFootball(authHeader)
    const db = createClient(SUPABASE_URL, SERVICE_KEY)
    const out: any = { league_api_id, season }

    // ── 1. League ──────────────────────────────────────────────────────────
    const lr = await apiFootball('/leagues', { id: league_api_id, season })
    const ld = lr.response?.[0]
    if (!ld) throw new Error('League not found in API-Football for that season')
    await db.from('countries').upsert(
      { id: ld.country.name, code: ld.country.code, flag: ld.country.flag }, { onConflict: 'id' })
    const inviteCode = ld.league.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20) + '-' + ld.league.id
    const { data: leagueRow } = await db.from('fb_leagues').upsert({
      api_id: ld.league.id, name: ld.league.name, type: 'football_competition',
      logo: ld.league.logo, country_id: ld.country.name, invite_code: inviteCode, api_league_id: ld.league.id,
    }, { onConflict: 'api_id' }).select('id').single()
    const leagueId = leagueRow!.id
    out.league = ld.league.name

    // ── 2. Teams (+ participation) ─────────────────────────────────────────
    const tr = await apiFootball('/teams', { league: league_api_id, season })
    const teams = tr.response ?? []
    const apiToUuid: Record<number, string> = {}
    for (const t of teams) {
      const { data: teamRow } = await db.from('fb_teams').upsert({
        api_id: t.team.id, name: t.team.name, code: t.team.code,
        country: t.team.country ?? 'Unknown', logo_url: t.team.logo ?? '',
      }, { onConflict: 'api_id' }).select('id').single()
      if (!teamRow) continue
      apiToUuid[t.team.id] = teamRow.id
      await db.from('fb_team_league_participation').upsert(
        { team_id: teamRow.id, league_id: leagueId, season: String(season) },
        { onConflict: 'team_id,league_id,season' })
    }
    out.teams = teams.length

    // ── 3. Players (squad per team) — concurrency-limited ──────────────────
    let playersCount = 0
    const startDate = `${season}-01-01`
    const teamEntries = Object.entries(apiToUuid) // [apiId, uuid]
    const BATCH = 3
    for (let i = 0; i < teamEntries.length; i += BATCH) {
      if (i > 0) await sleep(800) // smooth the request rate (avoid API rate limits)
      const slice = teamEntries.slice(i, i + BATCH)
      await Promise.all(slice.map(async ([apiId, uuid]) => {
        const sr = await apiFootball('/players/squads', { team: Number(apiId) })
        const squad = sr.response?.[0]?.players ?? []
        if (squad.length === 0) return
        const playerRows = squad.map((p: any) => {
          const { first, last } = splitName(p.name)
          const birthYear = p.age ? (Number(season) - Number(p.age)) : 2000
          return {
            api_id: p.id, name: p.name ?? 'Unknown', first_name: first, last_name: last,
            nationality: 'Unknown', birthdate: `${birthYear}-01-01`,
            photo_url: p.photo ?? '', photo: p.photo ?? null, position: p.position ?? 'Unknown',
          }
        })
        const { data: inserted } = await db.from('fb_players')
          .upsert(playerRows, { onConflict: 'api_id' }).select('id')
        if (inserted) {
          await db.from('fb_player_team_association').upsert(
            inserted.map((pl: any) => ({ player_id: pl.id, team_id: uuid, start_date: startDate })),
            { onConflict: 'player_id,team_id' })
          playersCount += inserted.length
        }
      }))
    }
    out.players = playersCount

    // ── 4. Fixtures ────────────────────────────────────────────────────────
    const fr = await apiFootball('/fixtures', { league: league_api_id, season })
    const fixtures = fr.response ?? []
    const fxRows = []
    for (const f of fixtures) {
      const h = apiToUuid[f.teams.home.id], a = apiToUuid[f.teams.away.id]
      if (!h || !a) continue
      fxRows.push({
        api_id: f.fixture.id, league_id: leagueId, home_team_id: h, away_team_id: a,
        date: f.fixture.date, status: f.fixture.status.short,
        goals_home: f.goals.home, goals_away: f.goals.away, round: f.league?.round ?? null,
      })
    }
    if (fxRows.length) await db.from('fb_fixtures').upsert(fxRows, { onConflict: 'api_id' })
    out.fixtures = fxRows.length

    out.ok = true
    return new Response(JSON.stringify(out), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message ?? e) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
