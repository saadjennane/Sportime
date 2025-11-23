/**
 * Process All Finished Game Weeks
 *
 * Wrapper function that:
 * 1. Finds all game weeks with status='finished' that haven't been processed
 * 2. Calls process-fantasy-gameweek for each one
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

    console.log('[process-all-finished-gameweeks] Starting...')

    // Find all finished game weeks that need processing
    // We process game weeks that are finished and have no leaderboard entries yet
    const { data: gameWeeks, error: fetchError } = await supabase
      .from('fantasy_game_weeks')
      .select('id, name, end_date')
      .eq('status', 'finished')

    if (fetchError) {
      throw new Error(`Failed to fetch game weeks: ${fetchError.message}`)
    }

    if (!gameWeeks || gameWeeks.length === 0) {
      console.log('[process-all-finished-gameweeks] No finished game weeks to process')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No finished game weeks to process',
          processed: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[process-all-finished-gameweeks] Found ${gameWeeks.length} finished game weeks`)

    const results = []
    let successCount = 0
    let errorCount = 0

    for (const gameWeek of gameWeeks) {
      try {
        console.log(`[process-all-finished-gameweeks] Processing game week ${gameWeek.id} (${gameWeek.name})`)

        // Check if this game week already has leaderboard entries
        const { data: existingLeaderboard, error: checkError } = await supabase
          .from('fantasy_leaderboard')
          .select('id')
          .eq('game_week_id', gameWeek.id)
          .limit(1)

        if (checkError) {
          throw new Error(`Error checking leaderboard: ${checkError.message}`)
        }

        if (existingLeaderboard && existingLeaderboard.length > 0) {
          console.log(`[process-all-finished-gameweeks] Game week ${gameWeek.id} already processed, skipping`)
          results.push({
            game_week_id: gameWeek.id,
            name: gameWeek.name,
            status: 'skipped',
            reason: 'Already processed'
          })
          continue
        }

        // Call process-fantasy-gameweek edge function
        const processResponse = await fetch(
          `${SUPABASE_URL}/functions/v1/process-fantasy-gameweek`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ game_week_id: gameWeek.id })
          }
        )

        const processResult = await processResponse.json()

        if (!processResponse.ok) {
          throw new Error(`Process failed: ${processResult.error || 'Unknown error'}`)
        }

        console.log(`[process-all-finished-gameweeks] Successfully processed game week ${gameWeek.id}`)
        successCount++
        results.push({
          game_week_id: gameWeek.id,
          name: gameWeek.name,
          status: 'success',
          result: processResult
        })
      } catch (error: any) {
        console.error(`[process-all-finished-gameweeks] Error processing game week ${gameWeek.id}:`, error)
        errorCount++
        results.push({
          game_week_id: gameWeek.id,
          name: gameWeek.name,
          status: 'error',
          error: error.message
        })
      }
    }

    console.log('[process-all-finished-gameweeks] Complete')
    console.log(`[process-all-finished-gameweeks] Success: ${successCount}, Errors: ${errorCount}`)

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
    console.error('[process-all-finished-gameweeks] Fatal error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
