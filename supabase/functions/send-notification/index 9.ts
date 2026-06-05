// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

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
  actionLabel?: string
  actionLink?: string
  metadata?: any
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Parse request body
    const { userId, type, title, message, actionLabel, actionLink, metadata }: NotificationRequest = await req.json()

    console.log('[send-notification] Received request:', { userId, type, title })

    // =========================================================================
    // 1. Get user's OneSignal Player IDs
    // =========================================================================
    const { data: players, error: playersError } = await supabaseClient
      .from('user_onesignal_players')
      .select('player_id')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (playersError) {
      console.error('[send-notification] Error fetching player IDs:', playersError)
      throw playersError
    }

    console.log('[send-notification] Found', players?.length || 0, 'active players')

    // =========================================================================
    // 2. Check user preferences
    // =========================================================================
    const { data: prefs, error: prefsError } = await supabaseClient
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (prefsError) {
      console.error('[send-notification] Error fetching preferences:', prefsError)
      throw prefsError
    }

    // Check if user wants this type of notification
    const typeKey = `${type}_enabled` as keyof typeof prefs
    const pushEnabled = prefs?.push_enabled ?? true
    const typeEnabled = prefs?.[typeKey] ?? true
    const inAppEnabled = prefs?.in_app_enabled ?? true

    console.log('[send-notification] Preferences:', { pushEnabled, typeEnabled, inAppEnabled })

    // =========================================================================
    // 3. Send push notification via OneSignal (if enabled and has players)
    // =========================================================================
    let oneSignalNotificationId: string | null = null

    if (pushEnabled && typeEnabled && players && players.length > 0) {
      const playerIds = players.map(p => p.player_id)

      console.log('[send-notification] Sending to OneSignal...', playerIds)

      const oneSignalPayload = {
        app_id: Deno.env.get('ONESIGNAL_APP_ID'),
        include_player_ids: playerIds,
        headings: { en: title },
        contents: { en: message },
        data: {
          type,
          actionLabel,
          actionLink,
          metadata: JSON.stringify(metadata || {}),
        },
        ...(actionLink && { web_url: actionLink }),
      }

      try {
        const oneSignalResponse = await fetch('https://onesignal.com/api/v1/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${Deno.env.get('ONESIGNAL_API_KEY')}`,
          },
          body: JSON.stringify(oneSignalPayload),
        })

        if (!oneSignalResponse.ok) {
          const errorData = await oneSignalResponse.text()
          console.error('[send-notification] OneSignal API error:', errorData)
          throw new Error(`OneSignal API error: ${errorData}`)
        }

        const oneSignalData = await oneSignalResponse.json()
        oneSignalNotificationId = oneSignalData.id

        console.log('[send-notification] OneSignal notification sent:', oneSignalNotificationId)
      } catch (error) {
        console.error('[send-notification] Failed to send via OneSignal:', error)
        // Continue to save in database even if push fails
      }
    } else {
      console.log('[send-notification] Skipping OneSignal (disabled or no players)')
    }

    // =========================================================================
    // 4. Save notification to database (if in-app enabled)
    // =========================================================================
    let notificationId: string | null = null

    if (inAppEnabled && typeEnabled) {
      const { data: notification, error: notificationError } = await supabaseClient
        .from('notifications')
        .insert({
          user_id: userId,
          type,
          title,
          message,
          action_label: actionLabel,
          action_link: actionLink,
          metadata: metadata || {},
          onesignal_notification_id: oneSignalNotificationId,
        })
        .select('id')
        .single()

      if (notificationError) {
        console.error('[send-notification] Error saving notification:', notificationError)
        throw notificationError
      }

      notificationId = notification.id
      console.log('[send-notification] Notification saved to database:', notificationId)
    } else {
      console.log('[send-notification] Skipping database save (in-app disabled)')
    }

    // =========================================================================
    // 5. Return success response
    // =========================================================================
    return new Response(
      JSON.stringify({
        success: true,
        notificationId,
        oneSignalNotificationId,
        sent: {
          push: !!oneSignalNotificationId,
          inApp: !!notificationId,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('[send-notification] Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/send-notification' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"userId":"user-123","type":"gameplay","title":"Test","message":"Test message"}'

*/
