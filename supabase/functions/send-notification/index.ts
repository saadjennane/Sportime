// send-notification v2 — low-level sender.
//   • OneSignal v5 REST (https://api.onesignal.com) + `Authorization: Key` (os_v2 keys).
//   • Targets by EXTERNAL ID (our user id, set via OneSignal.login) — robust vs player_ids.
//   • Supports scheduling: send_after + timezone delivery.
//   • Honours notification_preferences; writes the in-app feed row.
// Called by the `notify` orchestrator (B2), which owns caps/quiet-hours/dedup/logging.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationRequest {
  userId: string
  type: 'gameplay' | 'league' | 'squad' | 'premium' | 'reminder' | 'system'
  title: string
  message: string
  notifKey?: string
  route?: string                       // sportime://...  -> data.route (deep-link router B1)
  imageUrl?: string
  actionLabel?: string
  actionLink?: string                  // legacy
  metadata?: any
  data?: Record<string, unknown>
  sendAfter?: string                   // ISO -> OneSignal send_after
  timezoneDelivery?: boolean           // delayed_option:'timezone'
  deliveryTimeOfDay?: string           // 'H:mmAM' local when timezoneDelivery
  channels?: ('push' | 'inapp')[]      // default ['push','inapp']
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const body = await req.json() as NotificationRequest
    const {
      userId, type, title, message, notifKey, route, imageUrl,
      actionLabel, actionLink, metadata, data,
      sendAfter, timezoneDelivery, deliveryTimeOfDay,
    } = body
    const channels = body.channels ?? ['push', 'inapp']

    // 1. Preferences gate (per-category + channel toggles)
    const { data: prefs } = await supabase
      .from('notification_preferences').select('*').eq('user_id', userId).maybeSingle()
    const typeKey = `${type}_enabled` as keyof typeof prefs
    const pushEnabled = prefs?.push_enabled ?? true
    const typeEnabled = prefs?.[typeKey] ?? true
    const inAppEnabled = prefs?.in_app_enabled ?? true

    // 2. Push via OneSignal v5 (external_id targeting)
    let oneSignalNotificationId: string | null = null
    const wantPush = channels.includes('push') && pushEnabled && typeEnabled

    if (wantPush) {
      const payload: Record<string, unknown> = {
        app_id: Deno.env.get('ONESIGNAL_APP_ID'),
        target_channel: 'push',
        include_aliases: { external_id: [userId] },
        headings: { en: title },
        contents: { en: message },
        data: {
          type,
          notifKey,
          route: route ?? actionLink ?? null,
          actionLabel,
          actionLink,
          ...(data ?? {}),
          metadata: JSON.stringify(metadata ?? {}),
        },
      }
      if (imageUrl) { payload.big_picture = imageUrl; payload.ios_attachments = { id1: imageUrl } }
      if (sendAfter) payload.send_after = sendAfter
      if (timezoneDelivery) { payload.delayed_option = 'timezone'; payload.delivery_time_of_day = deliveryTimeOfDay ?? '9:00AM' }

      try {
        const r = await fetch('https://api.onesignal.com/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Key ${Deno.env.get('ONESIGNAL_API_KEY')}`, // os_v2 key
          },
          body: JSON.stringify(payload),
        })
        if (!r.ok) {
          console.error('[send-notification] OneSignal error:', await r.text())
        } else {
          oneSignalNotificationId = (await r.json()).id ?? null
        }
      } catch (e) {
        console.error('[send-notification] OneSignal request failed:', e)
      }
    }

    // 3. In-app feed row
    let notificationId: string | null = null
    if (channels.includes('inapp') && inAppEnabled && typeEnabled) {
      const { data: n, error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId, type, title, message,
          action_label: actionLabel,
          action_link: route ?? actionLink ?? null,
          metadata: metadata ?? {},
          onesignal_notification_id: oneSignalNotificationId,
        })
        .select('id').single()
      if (error) console.error('[send-notification] in-app insert error:', error)
      else notificationId = n.id
    }

    return new Response(
      JSON.stringify({
        success: true,
        onesignalId: oneSignalNotificationId,
        notificationId,
        sent: { push: !!oneSignalNotificationId, inApp: !!notificationId },
        gated: { pushEnabled, typeEnabled, inAppEnabled },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    console.error('[send-notification] error:', error)
    return new Response(JSON.stringify({ success: false, error: String(error?.message ?? error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
