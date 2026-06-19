// Create a Tournament Quest competition from the ALREADY-SEEDED warehouse (fb_*).
// No API calls, no per-game seeding: teams, groups, matches and players are read
// from fb_team_league_participation / fb_fixtures / fb_player_team_association,
// which the league import (import-league-full) populates once per league.
//
//   POST { name, league_api_id, season, entry_cost?, requires_subscription?, required_badges?, ... }
//
// Groups are DERIVED from the group-stage fixtures (the 4 teams of a group all play
// each other → connected components), since the warehouse has no group label.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

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

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)

// fb_fixtures.status may be an api short code or an already-mapped string.
const mapStatus = (s: string | null) => {
  const u = String(s ?? '').toLowerCase()
  if (['ft', 'aet', 'pen', 'finished'].includes(u)) return 'finished'
  if (['1h', '2h', 'ht', 'et', 'bt', 'p', 'live'].includes(u)) return 'live'
  return 'scheduled'
}

const isGroupStage = (round: string) => /group/i.test(round ?? '')
function parseKO(round: string): string | null {
  const r = round ?? ''
  if (/round of 16/i.test(r)) return 'R16'
  if (/round of 32/i.test(r)) return 'R32'
  if (/quarter/i.test(r)) return 'QF'
  if (/semi/i.test(r)) return 'SF'
  if (/3rd place|third place/i.test(r)) return '3P'
  if (/final/i.test(r)) return 'F'
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await req.json()

    // ── Admin guard (caller's JWT) ────────────────────────────────────────────
    const asCaller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: isAdmin } = await asCaller.rpc('is_admin')
    if (isAdmin !== true) return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } })

    const db = createClient(SUPABASE_URL, SERVICE_KEY)

    const { name, league_api_id, season, entry_cost = 0, min_players = null, max_players = null,
      minimum_level = 'Rookie', required_badges = [], requires_subscription = false, is_visible = true,
      opens_at = null, qualified_per_group = 2, tier = 'amateur', duration_type = 'season' } = body
    if (!name || !league_api_id || !season) throw new Error('name, league_api_id and season are required')

    // ── 1) Resolve the warehouse league ───────────────────────────────────────
    const { data: fbLeague } = await db.from('fb_leagues').select('id, name').eq('api_id', league_api_id).maybeSingle()
    if (!fbLeague) throw new Error(`League ${league_api_id} is not in the warehouse — import it first (Leagues → Seed).`)

    // ── 2) Teams in this league/season (from the warehouse) ───────────────────
    const { data: tlp } = await db.from('fb_team_league_participation')
      .select('team_id, fb_teams!inner(id, name, code, logo_url, api_id)')
      .eq('league_id', fbLeague.id).eq('season', season)
    const teamRows: any[] = []
    const seenTeam = new Set<string>()
    for (const r of tlp ?? []) {
      const t: any = (r as any).fb_teams
      if (t && !seenTeam.has(t.id)) { seenTeam.add(t.id); teamRows.push(t) }
    }
    if (teamRows.length === 0) throw new Error(`No teams seeded for ${fbLeague.name} ${season} — seed the league first (Leagues → Seed).`)

    // ── 3) Fixtures (from the warehouse) ──────────────────────────────────────
    const { data: fixtures } = await db.from('fb_fixtures')
      .select('id, api_id, home_team_id, away_team_id, date, status, goals_home, goals_away, round')
      .eq('league_id', fbLeague.id).eq('season', season)
    if (!fixtures?.length) throw new Error(`No fixtures seeded for ${fbLeague.name} ${season} — seed the league first.`)

    // ── Derive groups via union-find over group-stage fixtures ────────────────
    const parent: Record<string, string> = {}
    teamRows.forEach((t) => { parent[t.id] = t.id })
    const find = (x: string): string => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] } return x }
    const union = (a: string, b: string) => { parent[find(a)] = find(b) }
    for (const f of fixtures) {
      if (isGroupStage(f.round) && parent[f.home_team_id] != null && parent[f.away_team_id] != null) {
        union(f.home_team_id, f.away_team_id)
      }
    }
    const compMap: Record<string, any[]> = {}
    for (const t of teamRows) { const r = find(t.id); (compMap[r] ||= []).push(t) }
    const groups = Object.values(compMap)
    groups.forEach((g) => g.sort((a, b) => a.name.localeCompare(b.name)))
    groups.sort((a, b) => a[0].name.localeCompare(b[0].name))
    const teamToGroupIdx: Record<string, number> = {}
    groups.forEach((g, i) => g.forEach((t) => { teamToGroupIdx[t.id] = i }))
    const groupLabel = (i: number) => groups.length <= 12 ? `Group ${String.fromCharCode(65 + i)}` : `Group ${i + 1}`

    // ── 4) Format detection ───────────────────────────────────────────────────
    const directQ = groups.length * qualified_per_group
    let pow = 2; while (pow < directQ) pow *= 2
    const bestThirds = Math.min(pow - directQ, groups.length)

    // ── 5) Competition row ────────────────────────────────────────────────────
    const comp = (await db.from('tq_competitions').insert({
      name, slug: slugify(name) + '-' + Date.now().toString(36),
      status: 'draft', entry_cost, min_players, max_players, minimum_level, tier, duration_type,
      required_badges, requires_subscription, is_visible,
      source_league_id: fbLeague.id, source_season: season, opens_at,
      config_json: { format: { best_thirds_count: bestThirds, third_place_match: true }, scoring: DEFAULT_SCORING },
    }).select('id').single()).data!
    const compId = comp.id

    // ── 6) Teams → tq_teams, map fbTeamId → tqTeamId (by name, unique here) ────
    const { data: createdTeams } = await db.from('tq_teams').insert(
      teamRows.map((t) => ({ competition_id: compId, name: t.name, short_name: (t.code || t.name.slice(0, 3)).toUpperCase(), flag_url: t.logo_url, external_id: t.api_id }))
    ).select('id, name')
    const nameToTq: Record<string, string> = {}
    for (const t of createdTeams ?? []) nameToTq[(t as any).name] = (t as any).id
    const fbToTq: Record<string, string> = {}
    for (const t of teamRows) fbToTq[t.id] = nameToTq[t.name]

    // ── 7) Groups + group_teams ───────────────────────────────────────────────
    const groupId: string[] = []
    for (let i = 0; i < groups.length; i++) {
      const g = (await db.from('tq_groups').insert({
        competition_id: compId, name: groupLabel(i), sort_order: i, qualified_count: qualified_per_group,
      }).select('id').single()).data!
      groupId[i] = g.id
      await db.from('tq_group_teams').insert(
        groups[i].map((t, idx) => ({ group_id: g.id, team_id: fbToTq[t.id], seed_order: idx + 1 }))
      )
    }

    // ── 8) Matches → tq_matches ───────────────────────────────────────────────
    const matchRows: any[] = []
    let bracketSlot = 0
    for (const f of fixtures) {
      const ta = fbToTq[f.home_team_id], tb = fbToTq[f.away_team_id]
      if (!ta || !tb) continue
      const base = {
        competition_id: compId, team_a_id: ta, team_b_id: tb,
        start_time: f.date ?? null, status: mapStatus(f.status),
        score_a: f.goals_home ?? null, score_b: f.goals_away ?? null,
      }
      if (isGroupStage(f.round)) {
        const gi = teamToGroupIdx[f.home_team_id]
        matchRows.push({ ...base, group_id: gi != null ? groupId[gi] : null, is_official_quest_match: true, quest_slot_key: `fx-${f.api_id}` })
      } else {
        const ko = parseKO(f.round)
        if (ko) matchRows.push({ ...base, knockout_round: ko, bracket_slot: bracketSlot++ })
      }
    }
    for (let i = 0; i < matchRows.length; i += 200) await db.from('tq_matches').insert(matchRows.slice(i, i + 200))

    // ── 9) Players → tq_players (from the warehouse association) ───────────────
    const teamIds = teamRows.map((t) => t.id)
    const assoc: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data: page } = await db.from('fb_player_team_association')
        .select('team_id, fb_players!inner(name, first_name, last_name, photo, photo_url)')
        .in('team_id', teamIds)
        .range(from, from + 999)
      if (!page?.length) break
      assoc.push(...page)
      if (page.length < 1000) break
    }
    const playerRows: any[] = []
    for (const a of assoc ?? []) {
      const tq = fbToTq[(a as any).team_id]
      const p: any = (a as any).fb_players
      if (!tq || !p) continue
      const nm = p.name || [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown'
      playerRows.push({ competition_id: compId, team_id: tq, name: nm, photo: p.photo || p.photo_url || null })
    }
    for (let i = 0; i < playerRows.length; i += 200) await db.from('tq_players').insert(playerRows.slice(i, i + 200))

    const fmt = (await db.rpc('tq_detect_format', { p_competition_id: compId })).data
    return new Response(JSON.stringify({
      ok: true, competition_id: compId, groups: groups.length, teams: teamRows.length,
      matches: matchRows.length, players: playerRows.length, format: fmt,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message ?? e) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
