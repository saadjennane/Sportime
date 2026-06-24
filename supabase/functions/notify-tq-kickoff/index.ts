// Journey TQ-1 — Tournament Quest kickoff reminder. Per-match deadline: if an official
// quest match starts in ~60 min and the user (who joined that TQ) hasn't predicted it,
// nudge them. Aggregated per user (one push covering all their pending picks). Runs */5.
// ?test=1 widens the window to next 48h for manual testing.
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

    const { data: rows, error } = await sb.rpc('tq_kickoff_targets', test ? { p_min: 0, p_max: 2880 } : { p_min: 55, p_max: 65 })
    if (error) throw error

    // Aggregate per user (one push covering all their pending picks).
    const byUser = new Map<string, { comp: string; name: string; count: number }>()
    for (const r of (rows ?? []) as any[]) {
      const u = byUser.get(r.user_id) ?? { comp: r.competition_id, name: r.comp_name, count: 0 }
      u.count++; byUser.set(r.user_id, u)
    }

    let sent = 0
    for (const [userId, u] of byUser) {
      const s = u.count > 1 ? 's' : ''
      const res = await fetch(`${SUPA_URL}/functions/v1/notify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE}` },
        body: JSON.stringify({
          userId, notifKey: 'TQ-1', category: 'matches', priority: 0, prefType: 'gameplay',
          // In prod this is strictly a T-60 nudge → "in 1 hour" is accurate. Test mode widens
          // the window, so it must NOT claim "1 hour".
          title: test ? '⏰ Predictions still open' : '⏰ Kickoff in 1 hour — predict now',
          message: `You've got ${u.count} ${u.name} pick${s} still open. Lock them in before the whistle.`,
          route: `sportime://tq/${u.comp}`, dedupKey: `TQ-1:${userId}`, dedupCooldownH: 1,
        }),
      }).then(x => x.json()).catch(() => null)
      if (res?.status === 'sent' || res?.status === 'held') sent++
    }
    return json({ ok: true, candidates: (rows ?? []).length, users: byUser.size, sent })
  } catch (e) {
    console.error('[notify-tq-kickoff] error:', e)
    return json({ ok: false, error: String((e as any)?.message ?? e) }, 400)
  }
})
