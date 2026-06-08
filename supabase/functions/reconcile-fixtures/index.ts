/**
 * Reconcile Stale Fixtures Edge Function
 *
 * Self-healing safety net: finds fixtures whose kickoff is well in the past but
 * whose status is still NOT final (e.g. missed during an API outage / quota block),
 * re-fetches their result from API-Football by date, updates fb_fixtures, then runs
 * the settle functions so predictions/bets/games unstick automatically.
 *
 * Idempotent + bounded (caps dates per run to respect the API quota). When there is
 * nothing stale, it makes zero API calls. Schedule it on a cron (e.g. every 30 min).
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, API_FOOTBALL_KEY
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const API_FOOTBALL_KEY = Deno.env.get('API_FOOTBALL_KEY')!

const FINAL_STATUSES = ['FT', 'AET', 'PEN', 'AWD', 'WO', 'CANC', 'ABD', 'PST', 'POST']
const MAX_DATES_PER_RUN = 8          // API-quota guard (1 call per date)
const STALE_AFTER_HOURS = 3          // a match is certainly over ~3h after kickoff
const LOOKBACK_DAYS = 30

async function fetchFinishedFixturesByDate(date: string): Promise<any[]> {
  const url = `https://v3.football.api-sports.io/fixtures?date=${date}&status=FT-AET-PEN`
  const response = await fetch(url, {
    headers: { 'x-rapidapi-key': API_FOOTBALL_KEY, 'x-rapidapi-host': 'v3.football.api-sports.io' },
  })
  if (!response.ok) {
    console.error('[reconcile] API error', response.status, await response.text())
    return []
  }
  const data = await response.json()
  if (data.errors && Object.keys(data.errors).length > 0) {
    console.error('[reconcile] API-Football errors:', JSON.stringify(data.errors))
    return []
  }
  return data.response || []
}

async function updateFixturesInDB(supabase: any, apiFixtures: any[]): Promise<number> {
  let updated = 0
  for (const apiFixture of apiFixtures) {
    const fixtureApiId = apiFixture.fixture?.id
    const newStatus = apiFixture.fixture?.status?.short || 'NS'
    const goalsHome = apiFixture.goals?.home
    const goalsAway = apiFixture.goals?.away
    if (!fixtureApiId) continue

    const { data: existing } = await supabase
      .from('fb_fixtures')
      .select('id, status, goals_home, goals_away')
      .eq('api_id', fixtureApiId)
      .maybeSingle()
    if (!existing) continue

    if (existing.status !== newStatus || existing.goals_home !== goalsHome || existing.goals_away !== goalsAway) {
      const { error } = await supabase
        .from('fb_fixtures')
        .update({ status: newStatus, goals_home: goalsHome, goals_away: goalsAway })
        .eq('api_id', fixtureApiId)
      if (!error) {
        console.log(`[reconcile] ✓ ${fixtureApiId}: ${existing.status} → ${newStatus}`)
        updated++
      }
    }
  }
  return updated
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const nowMs = Date.now()
  const staleBefore = new Date(nowMs - STALE_AFTER_HOURS * 3600 * 1000).toISOString()
  const lookbackAfter = new Date(nowMs - LOOKBACK_DAYS * 24 * 3600 * 1000).toISOString()

  // 1. Find stale fixtures (past kickoff, not final) and group by date.
  const { data: stale, error } = await supabase
    .from('fb_fixtures')
    .select('date')
    .lt('date', staleBefore)
    .gt('date', lookbackAfter)
    .not('status', 'in', `(${FINAL_STATUSES.join(',')})`)
    .order('date', { ascending: true })
    .limit(2000)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const dates = Array.from(new Set((stale || []).map((r: any) => String(r.date).slice(0, 10)))).slice(0, MAX_DATES_PER_RUN)

  // 2. Re-fetch each stale date and update fb_fixtures.
  let updated = 0
  for (const date of dates) {
    const apiFixtures = await fetchFinishedFixturesByDate(date)
    updated += await updateFixturesInDB(supabase, apiFixtures)
  }

  // 3. Settle anything that just became final (idempotent; crons also do this).
  if (updated > 0) {
    for (const fn of ['settle_finished_unsettled_bets', 'settle_finished_unsettled_predictions', 'settle_match_bets']) {
      const { error: e } = await supabase.rpc(fn)
      if (e) console.error(`[reconcile] ${fn} failed:`, e.message)
    }
  }

  const result = { stale_fixtures: (stale || []).length, dates_checked: dates.length, fixtures_updated: updated }
  console.log('[reconcile] done', JSON.stringify(result))
  return new Response(JSON.stringify({ success: true, ...result }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
