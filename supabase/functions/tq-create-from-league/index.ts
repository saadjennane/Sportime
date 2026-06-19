// Create a Tournament Quest competition from an imported league, OR backfill an
// existing one's content. Seeds: tq_competition + teams + groups + **matches**
// (from /fixtures) + **players** (from /players/squads).
//
//   • Create:   POST { name, league_api_id, season, ... }
//   • Backfill: POST { competition_id }   → only (re)seeds matches + players
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const API_FOOTBALL_KEY = Deno.env.get('API_FOOTBALL_KEY')!
const API_HOST = 'v3.football.api-sports.io'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_SCORING = {
  long_term: { champion_exact: 150, champion_finalist: 75, champion_semi: 30, finalist_exact: 100, finalist_semi: 40, top_scorer_exact: 100, top_scorer_top3: 40, top_scorer_top10: 15 },
  group: { qualified: 5, exact_position: 5 },
  daily: { result: 10, exact_score: 12, bonus: 8, cards_line: 3.5, distance: { '0': 15, '1': 10, '2': 5, '3': 2 } },
  bracket: { R32: 10, R16: 15, QF: 30, SF: 60, F: 120 },
}

async function apiFootball(path: string, params: Record<string, unknown>) {
  const url = new URL(`https://${API_HOST}${path}`)
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, String(v))
  const r = await fetch(url, { headers: { 'x-rapidapi-key': API_FOOTBALL_KEY, 'x-rapidapi-host': API_HOST } })
  if (!r.ok) throw new Error(`API-Football ${path} -> ${r.status}`)
  return await r.json()
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)

const mapStatus = (s: string) =>
  ['FT', 'AET', 'PEN'].includes(s) ? 'finished'
  : ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(s) ? 'live'
  : 'scheduled'

// api-football round → { group: 'Group A' } | { ko: 'R16'|'QF'|'SF'|'F'|'3P' }
function parseRound(round: string): { group?: string; ko?: string } {
  const g = round?.match(/Group ([A-L])/i)
  if (g) return { group: `Group ${g[1].toUpperCase()}` }
  if (/round of 16/i.test(round)) return { ko: 'R16' }
  if (/round of 32/i.test(round)) return { ko: 'R32' }
  if (/quarter/i.test(round)) return { ko: 'QF' }
  if (/semi/i.test(round)) return { ko: 'SF' }
  if (/3rd place|third place/i.test(round)) return { ko: '3P' }
  if (/final/i.test(round)) return { ko: 'F' }
  return {}
}

// Seed matches from the league fixtures. Group-stage = official daily matches; the
// rest become knockout matches. Idempotent: wipes the comp's matches first.
async function seedMatches(db: any, compId: string, leagueApiId: number, season: number,
                           teamByApi: Record<number, string>, groupByName: Record<string, string>) {
  const fx = await apiFootball('/fixtures', { league: leagueApiId, season })
  const fixtures = fx.response ?? []
  await db.from('tq_matches').delete().eq('competition_id', compId)

  const rows: any[] = []
  let bracketSlot = 0
  for (const f of fixtures) {
    const ha = f.teams?.home?.id, aa = f.teams?.away?.id
    const ta = teamByApi[ha], tb = teamByApi[aa]
    if (!ta || !tb) continue                      // team not in this competition
    const r = parseRound(f.league?.round ?? '')
    const base = {
      competition_id: compId, team_a_id: ta, team_b_id: tb,
      start_time: f.fixture?.date ?? null, status: mapStatus(f.fixture?.status?.short ?? 'NS'),
      score_a: f.goals?.home ?? null, score_b: f.goals?.away ?? null,
    }
    if (r.group) {
      rows.push({ ...base, group_id: groupByName[r.group] ?? null, is_official_quest_match: true, quest_slot_key: `fx-${f.fixture.id}` })
    } else if (r.ko) {
      rows.push({ ...base, knockout_round: r.ko, bracket_slot: bracketSlot++ })
    }
  }
  if (rows.length) {
    for (let i = 0; i < rows.length; i += 200) await db.from('tq_matches').insert(rows.slice(i, i + 200))
  }
  return rows.length
}

// Seed players from each team's squad. Idempotent: wipes the comp's players first.
async function seedPlayers(db: any, compId: string, teamByApi: Record<number, string>) {
  await db.from('tq_players').delete().eq('competition_id', compId)
  const rows: any[] = []
  for (const [apiId, tqTeamId] of Object.entries(teamByApi)) {
    try {
      const sq = await apiFootball('/players/squads', { team: apiId })
      const players = sq.response?.[0]?.players ?? []
      for (const p of players) rows.push({ competition_id: compId, team_id: tqTeamId, name: p.name, photo: p.photo ?? null })
    } catch { /* skip a team whose squad fails */ }
  }
  if (rows.length) {
    for (let i = 0; i < rows.length; i += 200) await db.from('tq_players').insert(rows.slice(i, i + 200))
  }
  return rows.length
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await req.json()
    const asCaller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: isAdmin } = await asCaller.rpc('is_admin')
    if (isAdmin !== true) return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } })

    const db = createClient(SUPABASE_URL, SERVICE_KEY)

    // ── Backfill mode: seed matches + players for an existing competition ──────
    // Players come from each team's squad (external_id), so they seed even when the
    // comp has no source league/season. Matches need a league+season: taken from the
    // comp's source, or overridden via body.league_api_id / body.season.
    if (body.competition_id) {
      const compId = body.competition_id
      const { data: comp } = await db.from('tq_competitions').select('source_league_id, source_season').eq('id', compId).single()
      if (!comp) throw new Error('competition not found')

      let leagueApiId: number | null = body.league_api_id ?? null
      const season: number | null = body.season ?? comp.source_season ?? null
      if (!leagueApiId && comp.source_league_id) {
        const { data: lg } = await db.from('fb_leagues').select('api_id').eq('id', comp.source_league_id).maybeSingle()
        leagueApiId = lg?.api_id ?? null
      }

      const { data: teams } = await db.from('tq_teams').select('id, external_id').eq('competition_id', compId)
      const teamByApi: Record<number, string> = {}
      for (const t of teams ?? []) if (t.external_id != null) teamByApi[t.external_id] = t.id
      const { data: grps } = await db.from('tq_groups').select('id, name').eq('competition_id', compId)
      const groupByName: Record<string, string> = {}
      for (const g of grps ?? []) groupByName[g.name] = g.id

      const players = await seedPlayers(db, compId, teamByApi)
      let matches = 0
      let note: string | undefined
      if (leagueApiId && season) {
        matches = await seedMatches(db, compId, leagueApiId, Number(season), teamByApi, groupByName)
      } else {
        note = 'players seeded; pass league_api_id + season to also seed matches'
      }
      return new Response(JSON.stringify({ ok: true, mode: 'backfill', competition_id: compId, matches, players, note }),
        { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // ── Create mode ───────────────────────────────────────────────────────────
    const { name, league_api_id, season, entry_cost = 0, min_players = null, max_players = null,
      minimum_level = 'Rookie', required_badges = [], is_visible = true, opens_at = null, qualified_per_group = 2,
      tier = 'amateur', duration_type = 'season' } = body
    if (!name || !league_api_id || !season) throw new Error('name, league_api_id and season are required')

    // 1) Standings -> real groups
    const st = await apiFootball('/standings', { league: league_api_id, season })
    const standings = st.response?.[0]?.league?.standings ?? []
    const groups = standings.filter((g: any[]) => g?.[0]?.group?.startsWith('Group') && g.length >= 2)
    if (groups.length === 0) throw new Error('No groups found in standings for this league/season')

    const directQ = groups.length * qualified_per_group
    let pow = 2; while (pow < directQ) pow *= 2
    const bestThirds = Math.min(pow - directQ, groups.length)

    // 2) Competition
    const { data: srcLeague } = await db.from('fb_leagues').select('id').eq('api_id', league_api_id).maybeSingle()
    const comp = (await db.from('tq_competitions').insert({
      name, slug: slugify(name) + '-' + Date.now().toString(36),
      status: 'draft', entry_cost, min_players, max_players, minimum_level, tier, duration_type,
      required_badges, is_visible, source_league_id: srcLeague?.id ?? null, source_season: season, opens_at,
      config_json: { format: { best_thirds_count: bestThirds, third_place_match: true }, scoring: DEFAULT_SCORING },
    }).select('id').single()).data!
    const compId = comp.id

    // 3) Teams (dedup by api id) + map
    const teamByApi: Record<number, string> = {}
    const allTeams: { id: number; name: string; logo: string }[] = []
    for (const g of groups) for (const row of g) {
      if (!(row.team.id in teamByApi)) { teamByApi[row.team.id] = ''; allTeams.push({ id: row.team.id, name: row.team.name, logo: row.team.logo }) }
    }
    const { data: createdTeams } = await db.from('tq_teams').insert(
      allTeams.map(t => ({ competition_id: compId, name: t.name, short_name: t.name.slice(0, 3).toUpperCase(), flag_url: t.logo, external_id: t.id }))
    ).select('id, external_id')
    for (const t of createdTeams ?? []) teamByApi[(t as any).external_id] = (t as any).id

    // 4) Groups + group_teams
    const groupByName: Record<string, string> = {}
    let gi = 0
    for (const g of groups) {
      const grp = (await db.from('tq_groups').insert({
        competition_id: compId, name: g[0].group, sort_order: gi++, qualified_count: qualified_per_group,
      }).select('id').single()).data!
      groupByName[g[0].group] = grp.id
      await db.from('tq_group_teams').insert(
        g.map((row: any, idx: number) => ({ group_id: grp.id, team_id: teamByApi[row.team.id], seed_order: idx + 1 }))
      )
    }

    // 5) Matches (fixtures) + 6) Players (squads)
    const matches = await seedMatches(db, compId, league_api_id, season, teamByApi, groupByName)
    const players = await seedPlayers(db, compId, teamByApi)

    const fmt = (await db.rpc('tq_detect_format', { p_competition_id: compId })).data
    return new Response(JSON.stringify({ ok: true, competition_id: compId, groups: groups.length, teams: allTeams.length, matches, players, format: fmt }),
      { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message ?? e) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
