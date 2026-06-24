// B5b — server reconcile of computed OneSignal tags (dormancy, lifecycle, pending picks).
// Client sets profile tags (tz, favourites, sports); this fills the ones only the server
// knows. Pushes via OneSignal v5 user API (by external_id). Run on a cron (~15 min).
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' }

function lifecycle(dormant: number, sinceInstall: number): string {
  if (sinceInstall <= 1) return 'new'
  if (dormant >= 90) return 'churned'
  if (dormant >= 30) return 'deep_dormant'
  if (dormant >= 7) return 'dormant'
  if (dormant >= 3) return 'at_risk'
  return 'core'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } })
    const APP = Deno.env.get('ONESIGNAL_APP_ID')
    const KEY = Deno.env.get('ONESIGNAL_API_KEY')

    const { data: rows, error } = await sb.rpc('notif_tag_rows')
    if (error) throw error

    let ok = 0, failed = 0
    let debug: any = null
    for (const r of (rows ?? []) as any[]) {
      const tags = {
        dormant_days: String(r.dormant_days),
        lifecycle_stage: lifecycle(r.dormant_days, r.days_since_install),
        days_since_install: String(r.days_since_install),
        pending_picks_count: String(r.pending_picks),
        has_pending_pick: String(r.pending_picks > 0),
      }
      try {
        const res = await fetch(`https://api.onesignal.com/apps/${APP}/users/by/external_id/${r.user_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${KEY}` },
          body: JSON.stringify({ properties: { tags } }),
        })
        if (res.ok) ok++; else { failed++; if (!debug) debug = { uid: r.user_id, appSet: !!APP, keySet: !!KEY, status: res.status, body: (await res.text()).slice(0, 300) } }
      } catch (e) { failed++; if (!debug) debug = { uid: r.user_id, threw: String((e as any)?.message ?? e) } }
    }

    return new Response(JSON.stringify({ ok: true, updated: ok, failed, total: (rows ?? []).length, debug }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (e) {
    console.error('[sync-onesignal-tags] error:', e)
    return new Response(JSON.stringify({ ok: false, error: String((e as any)?.message ?? e) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
