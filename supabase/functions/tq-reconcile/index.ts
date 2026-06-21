/**
 * Tournament Quest — Targeted Reconcile Edge Function
 *
 * Tournament Quest only tracks a few dozen fixtures, so instead of waiting for the
 * global `reconcile-fixtures` cron (3h-stale threshold, 30-min cadence, 8-date cap
 * that can starve recent dates), this fetches TQ's own past-kickoff/not-final
 * fixtures DIRECTLY by id from API-Football, updates fb_fixtures, then runs the TQ
 * sync + resolve so daily picks score within ~15 min of a match ending.
 *
 * Cheap (1 API call per ≤20 stale fixtures; zero calls when nothing is stale) and
 * idempotent. Schedule on a 15-min cron alongside tq-resolve-running.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, API_FOOTBALL_KEY
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const API_FOOTBALL_KEY = Deno.env.get('API_FOOTBALL_KEY')!

const FINAL_STATUSES = ['FT', 'AET', 'PEN', 'AWD', 'WO', 'CANC', 'ABD', 'PST', 'POST']

async function fetchFixturesByIds(ids: number[]): Promise<any[]> {
  // API-Football accepts up to 20 dash-separated ids per call.
  const out: any[] = []
  for (let i = 0; i < ids.length; i += 20) {
    const chunk = ids.slice(i, i + 20).join('-')
    const res = await fetch(`https://v3.football.api-sports.io/fixtures?ids=${chunk}`, {
      headers: { 'x-rapidapi-key': API_FOOTBALL_KEY, 'x-rapidapi-host': 'v3.football.api-sports.io' },
    })
    if (!res.ok) { console.error('[tq-reconcile] API error', res.status, await res.text()); continue }
    const data = await res.json()
    if (data.errors && Object.keys(data.errors).length > 0) {
      console.error('[tq-reconcile] API-Football errors:', JSON.stringify(data.errors)); continue
    }
    out.push(...(data.response || []))
  }
  return out
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // 1. Ask Postgres which TQ fixtures are past kickoff but still not final.
  const { data: ids, error: idErr } = await supabase.rpc('tq_stale_fixture_api_ids')
  if (idErr) return new Response(JSON.stringify({ error: idErr.message }), { status: 500 })
  const staleIds = (ids || []) as number[]

  let updated = 0
  if (staleIds.length > 0) {
    // 2. Pull the real result for each, update fb_fixtures where it changed.
    const apiFixtures = await fetchFixturesByIds(staleIds)
    for (const f of apiFixtures) {
      const apiId = f.fixture?.id
      const status = f.fixture?.status?.short || 'NS'
      const gh = f.goals?.home, ga = f.goals?.away
      if (!apiId) continue
      const { data: ex } = await supabase.from('fb_fixtures')
        .select('id, status, goals_home, goals_away').eq('api_id', apiId).maybeSingle()
      if (!ex) continue
      if (ex.status !== status || ex.goals_home !== gh || ex.goals_away !== ga) {
        const { error } = await supabase.from('fb_fixtures')
          .update({ status, goals_home: gh, goals_away: ga }).eq('api_id', apiId)
        if (!error) { console.log(`[tq-reconcile] ✓ ${apiId}: ${ex.status} → ${status} ${gh}-${ga}`); updated++ }
      }
    }
  }

  // 3. Push results into tq_matches and score picks (idempotent; runs even if 0 updated).
  const { error: syncErr } = await supabase.rpc('tq_sync_results')
  if (syncErr) console.error('[tq-reconcile] sync error:', syncErr.message)
  const { data: resolved } = await supabase.rpc('tq_resolve_running')

  const result = { stale: staleIds.length, fixtures_updated: updated, competitions_resolved: resolved ?? null }
  console.log('[tq-reconcile] done', JSON.stringify(result))
  return new Response(JSON.stringify({ success: true, ...result }), { headers: { 'Content-Type': 'application/json' } })
})
