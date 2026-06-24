// Phase 3 — pull OneSignal delivery stats for recent sends into notif_delivery_stats.
// Runs daily; only fetches onesignal_ids not already recorded.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } })
    const APP = Deno.env.get('ONESIGNAL_APP_ID'); const KEY = Deno.env.get('ONESIGNAL_API_KEY')

    const { data: rows } = await sb.from('notification_log')
      .select('onesignal_id, notif_key')
      .not('onesignal_id', 'is', null)
      .gte('created_at', new Date(Date.now() - 2 * 86400_000).toISOString())
      .limit(300)
    const seen = new Set((await sb.from('notif_delivery_stats').select('onesignal_id')).data?.map((r: any) => r.onesignal_id) ?? [])
    const todo = [...new Map((rows ?? []).filter((r: any) => !seen.has(r.onesignal_id)).map((r: any) => [r.onesignal_id, r])).values()]

    let fetched = 0
    for (const r of todo as any[]) {
      try {
        const res = await fetch(`https://api.onesignal.com/notifications/${r.onesignal_id}?app_id=${APP}`, { headers: { Authorization: `Key ${KEY}` } })
        if (!res.ok) continue
        const d = await res.json()
        await sb.from('notif_delivery_stats').upsert({
          onesignal_id: r.onesignal_id, notif_key: r.notif_key,
          successful: d.successful ?? 0, failed: d.failed ?? 0, errored: d.errored ?? 0, converted: d.converted ?? 0,
          fetched_at: new Date().toISOString(),
        })
        fetched++
      } catch { /* skip */ }
    }
    return new Response(JSON.stringify({ ok: true, fetched, candidates: todo.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as any)?.message ?? e) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
