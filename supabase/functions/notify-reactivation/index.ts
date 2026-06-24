// Journey: reactivation ladder (daily cron). Dormant users get an escalating nudge:
//   • RE-1 (dormant 3–6d): "matches you'll like" — P1
//   • RE-2 (dormant 7–13d): free spin incentive — P0, grants a free spin when actually sent
// One send per stage window (orchestrator dedup with a long cooldown). RE-3/4/5 later.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const URL = Deno.env.get('SUPABASE_URL') ?? ''
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const sb = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: rows, error } = await sb.rpc('reactivation_candidates')
    if (error) throw error

    const notify = (body: Record<string, unknown>) =>
      fetch(`${URL}/functions/v1/notify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE}` },
        body: JSON.stringify(body),
      }).then(r => r.json()).catch(() => null)

    let re1 = 0, re2 = 0
    for (const r of (rows ?? []) as any[]) {
      const dd = r.dormant_days
      if (dd >= 7) {
        // RE-2 — free spin win-back. Grant the spin only if the push actually goes out.
        const res = await notify({
          userId: r.user_id, notifKey: 'RE-2', category: 'reactivation', priority: 0, prefType: 'reminder',
          title: 'We saved you a free spin 🎁', message: "Come back and spin for coins & tickets — it's waiting.",
          route: 'sportime://spin/free', dedupKey: `RE-2:${r.user_id}`, dedupCooldownH: 336,
        })
        if (res?.status === 'sent' || res?.status === 'held') {
          try { await sb.rpc('grant_spin', { p_user_id: r.user_id, p_tier: 'free', p_quantity: 1 }) }
          catch (e) { console.error('[notify-reactivation] grant_spin failed', r.user_id, e) }
          re2++
        }
      } else {
        // RE-1 — gentle nudge back to today's matches.
        await notify({
          userId: r.user_id, notifKey: 'RE-1', category: 'reactivation', priority: 1, prefType: 'reminder',
          title: 'Big matches on Sportime ⚽', message: "Jump back in and make your picks for today's games.",
          route: 'sportime://matches', dedupKey: `RE-1:${r.user_id}`, dedupCooldownH: 168,
        })
        re1++
      }
    }

    return new Response(JSON.stringify({ ok: true, candidates: (rows ?? []).length, re1, re2 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('[notify-reactivation] error:', e)
    return new Response(JSON.stringify({ ok: false, error: String((e as any)?.message ?? e) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
