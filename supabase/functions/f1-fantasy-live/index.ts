// Fantasy F1 live tick. Finds in-progress GPs that have a fantasy game, polls the
// running order (+ fastest lap + current lap), stores it in f1_live_positions,
// snapshots a progression checkpoint every 10 laps, then recomputes every roster's
// live score. Designed to be called every ~60-90s by a cron. Fast no-op when no
// race is live. Each race is wrapped in try/catch so one failure can't break others.
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
  return j.response || []
}

Deno.serve(async () => {
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE)
  const nowIso = new Date().toISOString()
  const fourAgo = new Date(Date.now() - 4 * 3600 * 1000).toISOString()
  const out = { live: [] as any[] }

  // GPs with a fantasy game whose race is plausibly in progress.
  const { data: games } = await sb
    .from('f1_fantasy_games')
    .select('race_id, status, race:f1_races(race_at, status)')
    .neq('status', 'settled')
  const candidates = (games ?? []).filter((g: any) =>
    g.race?.race_at && g.race.race_at <= nowIso && g.race.race_at >= fourAgo && g.race.status !== 'Completed')

  for (const g of candidates) {
    const raceId = g.race_id
    try {
      const lapInfo = (await f1('/races', { id: raceId }))[0]
      const curLap = lapInfo?.laps?.current ?? null
      const totLap = lapInfo?.laps?.total ?? null
      const rank = await f1('/rankings/races', { race: raceId })
      if (!rank.length) { out.live.push({ raceId, skipped: 'no live data' }); continue }
      const fl = await f1('/rankings/fastestlaps', { race: raceId })
      const flId = fl[0]?.driver?.id ?? null

      const rows = rank.map((x: any) => ({
        race_id: raceId, driver_id: x.driver?.id, position: x.position ?? null,
        grid: x.grid != null ? Number(x.grid) : null, laps: x.laps ?? null,
        is_fastest_lap: x.driver?.id === flId,
        is_dnf: x.position == null || /dnf|ret|dsq|dns|nc/i.test(String(x.time ?? x.status ?? '')),
        updated_at: new Date().toISOString(),
      })).filter((r: any) => r.driver_id)
      if (!rows.length) { out.live.push({ raceId, skipped: 'no drivers' }); continue }

      // Keep an existing grid if the live feed omits it.
      const { data: existing } = await sb.from('f1_live_positions').select('driver_id, grid').eq('race_id', raceId)
      const gridMap = new Map((existing ?? []).map((e: any) => [e.driver_id, e.grid]))
      for (const r of rows) if (r.grid == null && gridMap.has(r.driver_id)) r.grid = gridMap.get(r.driver_id)
      await sb.from('f1_live_positions').upsert(rows, { onConflict: 'race_id,driver_id' })

      // Progression checkpoint every 10 laps.
      const { data: st } = await sb.from('f1_live_state').select('last_checkpoint').eq('race_id', raceId).maybeSingle()
      const last = st?.last_checkpoint ?? 0
      let checkpoint = last
      if (curLap != null && curLap >= last + 10) {
        checkpoint = Math.floor(curLap / 10) * 10
        for (const r of rows) await sb.from('f1_live_positions').update({ checkpoint_pos: r.position }).eq('race_id', raceId).eq('driver_id', r.driver_id)
      }
      await sb.from('f1_live_state').upsert({ race_id: raceId, current_lap: curLap, total_laps: totLap, last_checkpoint: checkpoint, updated_at: new Date().toISOString() }, { onConflict: 'race_id' })

      const { data: scored } = await sb.rpc('f1_fantasy_live_score', { p_race_id: raceId })
      out.live.push({ raceId, lap: curLap, total: totLap, checkpoint, rosters: scored })
    } catch (e) {
      out.live.push({ raceId, error: String(e) })
    }
  }

  return new Response(JSON.stringify({ success: true, ...out }), { headers: { 'Content-Type': 'application/json' } })
})
