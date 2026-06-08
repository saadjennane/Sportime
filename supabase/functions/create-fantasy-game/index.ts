// Create a Sportime Fantasy game from selected fixtures: groups them into game
// weeks (by round = 'matchdays' mode, by date = 'calendar' mode). Guarded by is_admin.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const b = await req.json()
    const { name, league_ids = [], fixture_ids = [], mode = 'matchdays', entry_cost = 0,
      min_players = 0, max_players = 0, minimum_level = 'Rookie', is_visible = true, rules_html = null,
      tier = 'amateur', duration_type = 'flash' } = b
    if (!name || !Array.isArray(fixture_ids) || fixture_ids.length === 0) throw new Error('name and at least one fixture are required')

    const asCaller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: isAdmin } = await asCaller.rpc('is_admin')
    if (isAdmin !== true) return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } })

    const db = createClient(SUPABASE_URL, SERVICE_KEY)

    const { data: fixtures } = await db.from('fb_fixtures')
      .select('id, date, round, league:fb_leagues(name)').in('id', fixture_ids)
    if (!fixtures || fixtures.length === 0) throw new Error('Selected fixtures not found')
    const dates = fixtures.map((f: any) => new Date(f.date).getTime())
    const start_date = new Date(Math.min(...dates)).toISOString()
    const end_date = new Date(Math.max(...dates)).toISOString()

    // Group into game weeks
    const groups = new Map<string, any[]>()
    for (const f of fixtures) {
      const key = mode === 'calendar' ? String(f.date).slice(0, 10) : (f.round ?? 'Round')
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(f)
    }

    // Fantasy game (min_players >= 2, max_players >= min_players per DB checks)
    const mn = Math.max(2, Number(min_players) || 2)
    const mx = Math.max(mn, Number(max_players) || 100000)
    const { data: fg, error: fgErr } = await db.from('fantasy_games').insert({
      name, status: 'Upcoming', start_date, end_date, entry_cost, total_players: 0,
      league_id: null, source_league_id: league_ids[0] ?? null, tier, duration_type, // gameweeks carry the leagues by name
      minimum_level, required_badges: [], min_players: mn, max_players: mx, is_visible, rules_html,
      requires_subscription: false,
    }).select('id').single()
    if (fgErr) throw new Error(`fantasy_game: ${fgErr.message}`)
    const gameId = fg!.id

    // Game weeks (sorted by earliest date)
    const sorted = [...groups.entries()].sort((a, b) =>
      Math.min(...a[1].map((f: any) => new Date(f.date).getTime())) - Math.min(...b[1].map((f: any) => new Date(f.date).getTime())))
    let n = 0
    for (const [, fxs] of sorted) {
      n++
      const gd = fxs.map((f: any) => new Date(f.date).getTime())
      const leagueNames = [...new Set(fxs.map((f: any) => f.league?.name).filter(Boolean))]
      await db.from('fantasy_game_weeks').insert({
        fantasy_game_id: gameId, name: `Matchday ${n}`,
        start_date: new Date(Math.min(...gd)).toISOString(),
        end_date: new Date(Math.max(...gd) + 86400000).toISOString(),
        leagues: leagueNames, status: 'upcoming', conditions: [],
      })
    }

    return new Response(JSON.stringify({ ok: true, game_id: gameId, gameweeks: n, fixtures: fixtures.length, mode }),
      { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message ?? e) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
