// Journey DE-1 — daily morning brief, delivered at ~09:00 in each user's LOCAL time.
// Runs every 30 min; sends only to users whose local hour is in the morning window AND
// there are matches today. Orchestrator dedup (20h) keeps it once-per-day.
// ?testUser=<id> bypasses the time window for one user (manual testing).
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' }
const MORNING_HOUR = 9 // local 09:00–09:59

function localHour(tz: string): number {
  try {
    const s = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(new Date())
    return parseInt(s, 10) % 24
  } catch { return -1 }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status })
  try {
    const SUPA_URL = Deno.env.get('SUPABASE_URL') ?? ''
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const sb = createClient(SUPA_URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })
    const testUser = new URL(req.url).searchParams.get('testUser')

    // Global gate: is there a match to pick within ~18h?
    const { count: fixturesSoon } = await sb.from('fb_fixtures').select('id', { count: 'exact', head: true })
      .gte('date', new Date().toISOString()).lte('date', new Date(Date.now() + 18 * 3600_000).toISOString())
    if (!testUser && !(fixturesSoon && fixturesSoon > 0)) return json({ ok: true, sent: 0, reason: 'no_fixtures' })

    const { data: rows, error } = await sb.rpc('daily_brief_candidates')
    if (error) throw error

    let sent = 0
    for (const r of (rows ?? []) as any[]) {
      const inWindow = testUser ? r.user_id === testUser : localHour(r.timezone) === MORNING_HOUR
      if (!inWindow) continue
      const res = await fetch(`${SUPA_URL}/functions/v1/notify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE}` },
        body: JSON.stringify({
          userId: r.user_id, notifKey: 'DE-1', category: 'daily', priority: 1, prefType: 'reminder',
          title: "Today's matches are live ⚽", message: 'Make your picks before kickoff.',
          route: 'sportime://matches', dedupKey: `DE-1:${r.user_id}`, dedupCooldownH: 20,
        }),
      }).then(x => x.json()).catch(() => null)
      if (res?.status === 'sent' || res?.status === 'held') sent++
    }
    return json({ ok: true, candidates: (rows ?? []).length, sent })
  } catch (e) {
    console.error('[notify-daily-brief] error:', e)
    return json({ ok: false, error: String((e as any)?.message ?? e) }, 400)
  }
})
