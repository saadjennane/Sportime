// Create a Match Day Challenge (game_type 'betting') from selected fixtures.
// Groups fixtures into matchdays by round ('matchdays' mode) or by calendar date
// ('calendar' mode), and builds challenges + challenge_leagues + challenge_matchdays
// + matchday_fixtures. Guarded by is_admin.
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
      min_players = 0, max_players = 0, minimum_level = 'Rookie', is_visible = true } = b
    if (!name || !Array.isArray(fixture_ids) || fixture_ids.length === 0) throw new Error('name and at least one fixture are required')

    const asCaller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: isAdmin } = await asCaller.rpc('is_admin')
    if (isAdmin !== true) return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } })

    const db = createClient(SUPABASE_URL, SERVICE_KEY)

    // Fetch the selected fixtures (date + round drive the grouping).
    const { data: fixtures } = await db.from('fb_fixtures').select('id, date, round').in('id', fixture_ids)
    if (!fixtures || fixtures.length === 0) throw new Error('Selected fixtures not found')
    const dates = fixtures.map((f: any) => new Date(f.date).getTime())
    const start_date = new Date(Math.min(...dates)).toISOString()
    const end_date = new Date(Math.max(...dates)).toISOString()

    // Group fixtures into "matchdays".
    const groups = new Map<string, any[]>()
    for (const f of fixtures) {
      const key = mode === 'calendar' ? String(f.date).slice(0, 10) : (f.round ?? 'Round')
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(f)
    }

    // 1) Challenge
    const { data: ch, error: chErr } = await db.from('challenges').insert({
      name, game_type: 'betting', sport: 'football', format: 'leaderboard', start_date, end_date,
      entry_cost, status: 'draft', is_visible,
      league_id: league_ids[0] ?? null,
      rules: { tier: 'amateur', period_type: mode, minimum_players: min_players, maximum_players: max_players },
      entry_conditions: { minimum_level, required_badges: [], requires_subscription: false },
    }).select('id').single()
    if (chErr) throw new Error(`challenge: ${chErr.message}`)
    const challengeId = ch!.id

    // 2) Leagues
    if (league_ids.length) await db.from('challenge_leagues').insert(league_ids.map((lid: string) => ({ challenge_id: challengeId, league_id: lid })))

    // 3) Matchdays + fixtures
    let mdCount = 0
    for (const [, fxs] of groups) {
      const earliest = new Date(Math.min(...fxs.map((f: any) => new Date(f.date).getTime())))
      const { data: md, error: mdErr } = await db.from('challenge_matchdays').insert({
        challenge_id: challengeId, date: earliest.toISOString().slice(0, 10),
        deadline: earliest.toISOString(), status: 'upcoming',
      }).select('id').single()
      if (mdErr) throw new Error(`matchday: ${mdErr.message}`)
      await db.from('matchday_fixtures').insert(fxs.map((f: any) => ({ matchday_id: md!.id, fixture_id: f.id })))
      mdCount++
    }

    return new Response(JSON.stringify({ ok: true, challenge_id: challengeId, matchdays: mdCount, fixtures: fixtures.length, mode }),
      { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message ?? e) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
