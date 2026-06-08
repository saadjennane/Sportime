// Create a Tournament Quest competition from an imported league: fetches the
// group composition from /standings and builds tq_competition + teams + groups.
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await req.json()
    const { name, league_api_id, season, entry_cost = 0, min_players = null, max_players = null,
      minimum_level = 'Rookie', required_badges = [], is_visible = true, opens_at = null, qualified_per_group = 2 } = body
    if (!name || !league_api_id || !season) throw new Error('name, league_api_id and season are required')

    const asCaller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: isAdmin } = await asCaller.rpc('is_admin')
    if (isAdmin !== true) return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } })

    const db = createClient(SUPABASE_URL, SERVICE_KEY)

    // 1) Standings -> real groups
    const st = await apiFootball('/standings', { league: league_api_id, season })
    const standings = st.response?.[0]?.league?.standings ?? []
    const groups = standings.filter((g: any[]) => g?.[0]?.group?.startsWith('Group') && g.length >= 2)
    if (groups.length === 0) throw new Error('No groups found in standings for this league/season')

    // best-thirds so knockout participants reach a power of two
    const directQ = groups.length * qualified_per_group
    let pow = 2; while (pow < directQ) pow *= 2
    const bestThirds = Math.min(pow - directQ, groups.length)

    // 2) Competition
    const comp = (await db.from('tq_competitions').insert({
      name, slug: slugify(name) + '-' + Date.now().toString(36),
      status: 'draft', entry_cost, min_players, max_players, minimum_level,
      required_badges, is_visible, source_league_id: null, source_season: season, opens_at,
      config_json: { format: { best_thirds_count: bestThirds, third_place_match: true }, scoring: DEFAULT_SCORING },
    }).select('id').single()).data!
    const compId = comp.id

    // 3) Teams (dedup by api id) + map
    const teamMap: Record<number, string> = {}
    const allTeams: { id: number; name: string; logo: string }[] = []
    for (const g of groups) for (const row of g) {
      if (!teamMap[row.team.id]) { teamMap[row.team.id] = ''; allTeams.push({ id: row.team.id, name: row.team.name, logo: row.team.logo }) }
    }
    const { data: createdTeams } = await db.from('tq_teams').insert(
      allTeams.map(t => ({ competition_id: compId, name: t.name, short_name: t.name.slice(0, 3).toUpperCase(), flag_url: t.logo, external_id: t.id }))
    ).select('id, external_id')
    for (const t of createdTeams ?? []) teamMap[(t as any).external_id] = (t as any).id

    // 4) Groups + group_teams
    let gi = 0
    for (const g of groups) {
      const grp = (await db.from('tq_groups').insert({
        competition_id: compId, name: g[0].group, sort_order: gi++, qualified_count: qualified_per_group,
      }).select('id').single()).data!
      await db.from('tq_group_teams').insert(
        g.map((row: any, idx: number) => ({ group_id: grp.id, team_id: teamMap[row.team.id], seed_order: idx + 1 }))
      )
    }

    const fmt = (await db.rpc('tq_detect_format', { p_competition_id: compId })).data
    return new Response(JSON.stringify({ ok: true, competition_id: compId, groups: groups.length, teams: allTeams.length, format: fmt }),
      { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message ?? e) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
