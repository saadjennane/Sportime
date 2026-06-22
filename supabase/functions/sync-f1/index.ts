/**
 * Sync F1 season data from api-sports Formula-1 into f1_constructors / f1_drivers /
 * f1_races / f1_results. Idempotent (upserts). Body: { season?, withResults? }.
 *
 * - constructors  ← /rankings/teams?season
 * - drivers       ← /rankings/drivers?season   (linked to constructor by team name)
 * - races (GP)    ← /races?season               (grouped by competition; Race session = PK)
 * - results       ← /rankings/races + /rankings/fastestlaps  for Completed GPs (if withResults)
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, API_FOOTBALL_KEY (same api-sports key).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const API_KEY = Deno.env.get('API_FOOTBALL_KEY')!
const F1_HOST = 'v1.formula-1.api-sports.io'

async function f1(path: string, params: Record<string, any> = {}): Promise<any[]> {
  const url = new URL(`https://${F1_HOST}${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))
  const res = await fetch(url, { headers: { 'x-rapidapi-key': API_KEY, 'x-rapidapi-host': F1_HOST } })
  const j = await res.json().catch(() => ({}))
  if (j.errors && Object.keys(j.errors).length) console.error('[sync-f1]', path, JSON.stringify(j.errors))
  return j.response || []
}

const NAME_SUFFIXES = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v'])
const splitName = (full: string) => {
  const parts = String(full || '').trim().split(/\s+/)
  if (parts.length <= 1) return { first: '', last: full || '' }
  // Drop a trailing generational suffix so "Carlos Sainz Jr" → last "Sainz".
  if (parts.length > 2 && NAME_SUFFIXES.has(parts[parts.length - 1].toLowerCase())) parts.pop()
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] }
}

Deno.serve(async (req) => {
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE)
  const body = await req.json().catch(() => ({}))
  const season: number = body.season ?? new Date().getUTCFullYear()
  const withResults: boolean = body.withResults !== false
  const out: any = { season }

  // 1. Constructors
  const teams = await f1('/rankings/teams', { season })
  const teamRows = teams.map((t: any) => ({
    id: t.team?.id, name: t.team?.name, logo: t.team?.logo ?? null,
    season, points: t.points ?? null, position: t.position ?? null, updated_at: new Date().toISOString(),
  })).filter((r: any) => r.id)
  if (teamRows.length) await sb.from('f1_constructors').upsert(teamRows)
  const teamByName = new Map<string, number>(teamRows.map((r: any) => [r.name, r.id]))
  out.constructors = teamRows.length

  // 2. Drivers — `team` is an object {id,name} in the drivers ranking; link by its id
  // (fall back to a name match if the id is ever missing).
  const drivers = await f1('/rankings/drivers', { season })
  const driverRows = drivers.map((d: any) => {
    const nm = splitName(d.driver?.name)
    const teamName = typeof d.team === 'string' ? d.team : d.team?.name ?? null
    const teamId = typeof d.team === 'object' ? d.team?.id ?? null : teamByName.get(d.team) ?? null
    return {
      id: d.driver?.id, name: d.driver?.name, first_name: nm.first, last_name: nm.last,
      abbr: d.driver?.abbr ?? null, number: d.driver?.number ?? null, image: d.driver?.image ?? null,
      constructor_id: teamId ?? teamByName.get(teamName ?? '') ?? null, team_name: teamName,
      season, points: d.points ?? null, position: d.position ?? null, wins: d.wins ?? null,
      updated_at: new Date().toISOString(),
    }
  }).filter((r: any) => r.id)
  if (driverRows.length) await sb.from('f1_drivers').upsert(driverRows)
  out.drivers = driverRows.length

  // 3. Races — group sessions by competition; the "Race" session id is the GP key.
  const sessions = await f1('/races', { season })
  const byComp = new Map<number, any[]>()
  for (const s of sessions) {
    const cid = s.competition?.id
    if (cid == null) continue
    if (!byComp.has(cid)) byComp.set(cid, [])
    byComp.get(cid)!.push(s)
  }
  const raceRows: any[] = []
  for (const [cid, ss] of byComp) {
    const race = ss.find((x: any) => x.type === 'Race')
    if (!race) continue
    const q1 = ss.find((x: any) => x.type === '1st Qualifying')
    const q3 = ss.find((x: any) => x.type === '3rd Qualifying')
    const sprint = ss.find((x: any) => x.type === 'Sprint')
    // Sessions that make up the weekend, for the live "Sessions" view (Practice → Q1/Q2/Q3/Sprint/Race).
    // Practice pace (esp. FP2 long runs / FP3) is an early form signal for pre-qualifying picks.
    const TYPE_MAP: Record<string, string> = { '1st Practice': 'FP1', '2nd Practice': 'FP2', '3rd Practice': 'FP3', '1st Qualifying': 'Q1', '2nd Qualifying': 'Q2', '3rd Qualifying': 'Q3', 'Race': 'Race', 'Sprint': 'Sprint' }
    const sessions = ss
      .filter((x: any) => TYPE_MAP[x.type])
      .map((x: any) => ({ type: TYPE_MAP[x.type], id: x.id, date: x.date, status: x.status }))
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
    raceRows.push({
      id: race.id, season, api_competition_id: cid,
      name: race.competition?.name, country: race.competition?.location?.country ?? null,
      city: race.competition?.location?.city ?? null,
      circuit_name: race.circuit?.name ?? null, circuit_image: race.circuit?.image ?? null,
      race_at: race.date, quali_start_at: q1?.date ?? null,
      pole_session_id: q3?.id ?? null, sprint_session_id: sprint?.id ?? null,
      sessions,
      total_laps: race.laps?.total ?? null, status: race.status ?? null,
      updated_at: new Date().toISOString(),
    })
  }
  // round = chronological order within the season
  raceRows.sort((a, b) => new Date(a.race_at).getTime() - new Date(b.race_at).getTime())
  raceRows.forEach((r, i) => (r.round = i + 1))
  if (raceRows.length) await sb.from('f1_races').upsert(raceRows)
  out.races = raceRows.length

  // 4. Results for completed GPs
  if (withResults) {
    let resCount = 0
    const completed = raceRows.filter((r) => r.status === 'Completed')
    for (const r of completed) {
      const rank = await f1('/rankings/races', { race: r.id })
      if (!rank.length) continue
      const fl = await f1('/rankings/fastestlaps', { race: r.id })
      const flDriverId = fl[0]?.driver?.id ?? null
      const rows = rank.map((x: any) => {
        const time = x.time ?? x.status ?? null
        const isDnf = x.position == null || /dnf|ret|dsq|dns|nc/i.test(String(time))
        return {
          race_id: r.id, driver_id: x.driver?.id, position: x.position ?? null,
          grid: x.grid ?? null, laps: x.laps ?? null, status: time,
          is_dnf: isDnf, is_pole: Number(x.grid) === 1, is_fastest_lap: x.driver?.id === flDriverId,
          updated_at: new Date().toISOString(),
        }
      }).filter((x: any) => x.driver_id)
      if (rows.length) { await sb.from('f1_results').upsert(rows); resCount += rows.length }
      // Sprint winner (sprint weekends) — used by the GP Predictor's sprint pick.
      if (r.sprint_session_id) {
        const sr = await f1('/rankings/races', { race: r.sprint_session_id })
        const sw = sr.find((x: any) => Number(x.position) === 1)?.driver?.id ?? null
        if (sw) await sb.from('f1_races').update({ sprint_winner_id: sw }).eq('id', r.id)
      }
      // Settle any pending bets now that this GP's results are in (safety-car bets
      // wait for the manual result; everything else settles from f1_results).
      await sb.rpc('f1_settle_race', { p_race_id: r.id })
      await sb.rpc('f1_duel_settle', { p_race_id: r.id })
      await sb.rpc('f1_pred_settle_race', { p_race_id: r.id })
      await sb.rpc('f1_fantasy_settle_race', { p_race_id: r.id })
    }
    out.result_rows = resCount
    // Refresh dynamic Fantasy categories from the latest results.
    if (completed.length) await sb.rpc('f1_fantasy_recalc_categories', {})
  }

  return new Response(JSON.stringify({ success: true, ...out }), { headers: { 'Content-Type': 'application/json' } })
})
