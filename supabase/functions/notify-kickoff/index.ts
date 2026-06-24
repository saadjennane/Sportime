// Journey MC-1 — kickoff reminder for the user's FAVOURITE CLUB only (event-relative,
// no timezone). Runs every 5 min; fixtures kicking off in ~60 min. Copy varies on whether
// the user already picked. ?test=1 widens the window to next 48h for manual testing.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: s })
  try {
    const SUPA_URL = Deno.env.get('SUPABASE_URL') ?? ''
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const sb = createClient(SUPA_URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })
    const test = new URL(req.url).searchParams.get('test') === '1'

    const { data: rows, error } = await sb.rpc('kickoff_favclub_targets',
      test ? { p_min: 0, p_max: 2880 } : { p_min: 55, p_max: 65 })
    if (error) throw error

    let sent = 0
    for (const r of (rows ?? []) as any[]) {
      const body = r.picked
        ? { priority: 0, title: `${r.fav_name} vs ${r.opp_name} in 1 hour ⏰`, message: 'Your pick is in. Tap to follow it live.' }
        : { priority: 1, title: `${r.fav_name} kick off in 1 hour ⚽`, message: 'Make your pick before the whistle.' }
      const res = await fetch(`${SUPA_URL}/functions/v1/notify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE}` },
        body: JSON.stringify({
          userId: r.user_id, notifKey: 'MC-1', category: 'matches', prefType: 'gameplay',
          ...body, route: `sportime://match/${r.fixture_id}`, dedupKey: `MC-1:${r.user_id}:${r.fixture_id}`,
        }),
      }).then(x => x.json()).catch(() => null)
      if (res?.status === 'sent' || res?.status === 'held') sent++
    }
    return json({ ok: true, candidates: (rows ?? []).length, sent })
  } catch (e) {
    console.error('[notify-kickoff] error:', e)
    return json({ ok: false, error: String((e as any)?.message ?? e) }, 400)
  }
})
