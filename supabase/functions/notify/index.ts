// B2 — `notify` orchestrator. THE single entry point for every trigger.
// Pipeline: pref gate → holdout → dedup → frequency cap → quiet-hours hold → send (B4) → log.
// (Digest/bundling of bursty settlements is a follow-up flush job; dedup covers repeats for now.)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type PrefType = 'gameplay' | 'league' | 'squad' | 'premium' | 'reminder' | 'system'
interface NotifyInput {
  userId: string
  notifKey: string
  category: string                 // onboarding|activation|daily|matches|fantasy|social|rewards|premium|reactivation|churn
  priority: 0 | 1 | 2
  prefType?: PrefType
  title: string
  message: string
  route?: string
  imageUrl?: string
  data?: Record<string, unknown>
  dedupKey?: string
  dedupCooldownH?: number          // default 12
  forceNow?: boolean               // P0 time-critical (skip quiet-hours)
  channels?: ('push' | 'inapp')[]
}

const CATEGORY_PREF: Record<string, PrefType> = {
  onboarding: 'system', activation: 'gameplay', daily: 'reminder', matches: 'gameplay',
  fantasy: 'gameplay', social: 'squad', rewards: 'gameplay', premium: 'premium',
  reactivation: 'reminder', churn: 'reminder',
}

const CAPS = {
  marketingPerDay: 2, marketingPerWeek: 6,
  p2PerDay: 1, p2PerWeek: 3,
  newUserMarketingPerDay: 1,            // days_since_install <= 7
  perCategoryPerDay: { social: 1, rewards: 1, reactivation: 1 } as Record<string, number>,
  quietStart: 22, quietEnd: 8, activeHour: 8, activeMin: 30,
}

function localHM(tz: string, d = new Date()) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(d)
  const h = (+(p.find(x => x.type === 'hour')?.value ?? '0')) % 24
  const m = +(p.find(x => x.type === 'minute')?.value ?? '0')
  return { h, m }
}
function isQuiet(tz: string) { const { h } = localHM(tz); return h >= CAPS.quietStart || h < CAPS.quietEnd }
function nextActiveISO(tz: string) {
  const { h, m } = localHM(tz)
  let mins = (CAPS.activeHour * 60 + CAPS.activeMin) - (h * 60 + m)
  if (mins <= 0) mins += 24 * 60
  return new Date(Date.now() + mins * 60000).toISOString()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } })

    const i = await req.json() as NotifyInput
    const prefType = i.prefType ?? CATEGORY_PREF[i.category] ?? 'system'
    const dedupKey = i.dedupKey ?? `${i.notifKey}:${i.userId}`
    const cooldownH = i.dedupCooldownH ?? 12
    const channels = i.channels ?? ['push', 'inapp']

    const { data: u } = await sb.from('users').select('created_at, timezone, mkt_holdout').eq('id', i.userId).maybeSingle()
    const { data: prefs } = await sb.from('notification_preferences').select('*').eq('user_id', i.userId).maybeSingle()

    const log = async (status: string, skip_reason: string | null, onesignal_id: string | null, scheduled_for: string | null, channel = 'push') =>
      sb.from('notification_log').insert({
        user_id: i.userId, notif_key: i.notifKey, category: i.category, pref_type: prefType,
        priority: i.priority, dedup_key: dedupKey, channel,
        status, skip_reason, onesignal_id, scheduled_for,
        payload: { title: i.title, message: i.message, route: i.route },
      })
    const done = (body: Record<string, unknown>) =>
      new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

    // 1. DEDUP — full skip (no push, no in-app)
    const { data: dup } = await sb.from('notification_log')
      .select('id').eq('user_id', i.userId).eq('dedup_key', dedupKey)
      .in('status', ['queued', 'held', 'sent'])
      .gt('created_at', new Date(Date.now() - cooldownH * 3600_000).toISOString()).limit(1)
    if (dup && dup.length) { await log('skipped_dedup', 'dedup', null, null); return done({ ok: true, status: 'skipped_dedup' }) }

    // 2. PREF gate (push)
    const pushPref = (prefs?.push_enabled ?? true) && (prefs?.[`${prefType}_enabled` as keyof typeof prefs] ?? true)
    // 3. HOLDOUT (P2 marketing only)
    const holdoutBlocked = (u?.mkt_holdout ?? false) && i.priority >= 2
    // 4. FREQUENCY (priority>=1; P0 bypasses). New-user ramp.
    let capBlocked = false, capReason = ''
    if (i.priority >= 1) {
      const since = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()
      const cnt = async (q: any) => (await q).count ?? 0
      const base = () => sb.from('notification_log').select('id', { count: 'exact', head: true })
        .eq('user_id', i.userId).eq('channel', 'push').in('status', ['sent', 'held'])
      const mkt24 = await cnt(base().gte('priority', 1).gt('created_at', since(24)))
      const mkt7d = await cnt(base().gte('priority', 1).gt('created_at', since(168)))
      const cat24 = await cnt(base().eq('category', i.category).gt('created_at', since(24)))
      const daysSinceInstall = u?.created_at ? (Date.now() - new Date(u.created_at).getTime()) / 86400_000 : 999
      const dayCap = daysSinceInstall <= 7 ? CAPS.newUserMarketingPerDay : CAPS.marketingPerDay
      if (mkt24 >= dayCap) { capBlocked = true; capReason = 'marketing_day' }
      else if (mkt7d >= CAPS.marketingPerWeek) { capBlocked = true; capReason = 'marketing_week' }
      else if (i.priority >= 2) {
        const p2_24 = await cnt(base().eq('priority', 2).gt('created_at', since(24)))
        const p2_7d = await cnt(base().eq('priority', 2).gt('created_at', since(168)))
        if (p2_24 >= CAPS.p2PerDay) { capBlocked = true; capReason = 'p2_day' }
        else if (p2_7d >= CAPS.p2PerWeek) { capBlocked = true; capReason = 'p2_week' }
      }
      const catCap = CAPS.perCategoryPerDay[i.category]
      if (!capBlocked && catCap && cat24 >= catCap) { capBlocked = true; capReason = `cat_${i.category}_day` }
    }

    // Decide push outcome
    let pushBlockedReason: string | null = null
    if (!pushPref) pushBlockedReason = 'pref'
    else if (holdoutBlocked) pushBlockedReason = 'holdout'
    else if (capBlocked) pushBlockedReason = capReason

    // 5. QUIET HOURS (schedule instead of block) — only if push is otherwise allowed
    let sendAfter: string | null = null
    const tz = u?.timezone
    if (!pushBlockedReason && tz && !i.forceNow && i.priority >= 1 && isQuiet(tz)) {
      sendAfter = nextActiveISO(tz)
    }

    // Build channels for B4: push only if allowed; in-app always (when requested)
    const wantPush = channels.includes('push') && !pushBlockedReason
    const sendChannels: ('push' | 'inapp')[] = []
    if (wantPush) sendChannels.push('push')
    if (channels.includes('inapp')) sendChannels.push('inapp')

    // 6. SEND via B4
    let onesignalId: string | null = null, inApp = false
    if (sendChannels.length) {
      const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
        body: JSON.stringify({
          userId: i.userId, type: prefType, notifKey: i.notifKey,
          title: i.title, message: i.message, route: i.route, imageUrl: i.imageUrl, data: i.data,
          channels: sendChannels, ...(sendAfter ? { sendAfter } : {}),
        }),
      })
      if (r.ok) { const j = await r.json(); onesignalId = j.onesignalId ?? null; inApp = !!j.sent?.inApp }
      else console.error('[notify] send-notification failed:', await r.text())
    }

    // 7. LOG — status reflects the PUSH outcome (so caps count real pushes only).
    let status: string, logChannel = 'push'
    if (sendAfter) status = 'held'
    else if (onesignalId) status = 'sent'
    else if (pushBlockedReason) {
      status = `skipped_${/^(marketing|p2|cat)/.test(pushBlockedReason) ? 'cap' : pushBlockedReason}`
      logChannel = inApp ? 'inapp' : 'push'
    } else if (inApp) { status = 'sent'; logChannel = 'inapp' } // push not requested, in-app only
    else status = 'failed'
    await log(status, pushBlockedReason ?? null, onesignalId, sendAfter, logChannel)

    return done({ ok: true, status, pushBlockedReason, sendAfter, onesignalId, inApp })
  } catch (e) {
    console.error('[notify] error:', e)
    return new Response(JSON.stringify({ ok: false, error: String((e as any)?.message ?? e) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
