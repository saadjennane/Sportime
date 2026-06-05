/**
 * Sync All Active Game Weeks
 *
 * Wrapper function that:
 * 1. Finds all game weeks with status='live' or recently finished (within 24h)
 * 2. Calls sync-match-stats for each one to fetch match statistics
 *
 * This is meant to be called by a scheduled GitHub Action.
 *
 * Environment variables required:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    console.log('[sync-all-active-gameweeks] Starting...')

    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Find all game weeks that are:
    // 1. Currently live
    // 2. Recently finished (within last 24 hours)
    const { data: gameWeeks, error: fetchError } = await supabase
      .from('fantasy_game_weeks')
      .select('id, name, start_date, end_date, status')
      .or(`status.eq.live,and(status.eq.finished,end_date.gte.${yesterday.toISOString()})`)

    if (fetchError) {
      throw new Error(`Failed to fetch game weeks: ${fetchError.message}`)
    }

    if (!gameWeeks || gameWeeks.length === 0) {
      console.log('[sync-all-active-gameweeks] No active game weeks to sync')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active game weeks to sync',
          synced: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[sync-all-active-gameweeks] Found ${gameWeeks.length} game weeks to sync`)

    const results = []
    let successCount = 0
    let errorCount = 0

    for (const gameWeek of gameWeeks) {
      try {
        console.log(`[sync-all-active-gameweeks] Syncing game week ${gameWeek.id} (${gameWeek.name})`)

        // Call sync-match-stats edge function
        const syncResponse = await fetch(
          `${SUPABASE_URL}/functions/v1/sync-match-stats`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ game_week_id: gameWeek.id })
          }
        )

        const syncResult = await syncResponse.json()

        if (!syncResponse.ok) {
          throw new Error(`Sync failed: ${syncResult.error || 'Unknown error'}`)
        }

        console.log(`[sync-all-active-gameweeks] Successfully synced game week ${gameWeek.id}`)
        successCount++
        results.push({
          game_week_id: gameWeek.id,
          name: gameWeek.name,
          status: 'success',
          result: syncResult
        })
      } catch (error: any) {
        console.error(`[sync-all-active-gameweeks] Error syncing game week ${gameWeek.id}:`, error)
        errorCount++
        results.push({
          game_week_id: gameWeek.id,
          name: gameWeek.name,
          status: 'error',
          error: error.message
        })
      }
    }

    console.log('[sync-all-active-gameweeks] Complete')
    console.log(`[sync-all-active-gameweeks] Success: ${successCount}, Errors: ${errorCount}`)

    return new Response(
      JSON.stringify({
        success: true,
        game_weeks_found: gameWeeks.length,
        success_count: successCount,
        error_count: errorCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('[sync-all-active-gameweeks] Fatal error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
