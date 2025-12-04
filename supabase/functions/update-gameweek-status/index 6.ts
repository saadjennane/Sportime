/**
 * Update Game Week Status Edge Function
 *
 * Automatically updates fantasy game week statuses based on current time:
 * - upcoming → live (when start_date is reached)
 * - live → finished (when end_date is reached)
 *
 * When transitioning to 'live':
 * - Locks all user teams (prevents further edits)
 *
 * When transitioning to 'finished':
 * - Can trigger processing (optional)
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

type GameWeekStatus = 'upcoming' | 'live' | 'finished'

interface GameWeek {
  id: string
  status: GameWeekStatus
  start_date: string
  end_date: string
  game_id: string
}

/**
 * Lock all user teams for a game week
 */
async function lockTeamsForGameWeek(supabase: any, gameWeekId: string): Promise<number> {
  const { data, error } = await supabase
    .from('user_fantasy_teams')
    .update({ is_locked: true })
    .eq('game_week_id', gameWeekId)
    .select('id')

  if (error) {
    console.error(`[update-gameweek-status] Error locking teams for game week ${gameWeekId}:`, error)
    throw error
  }

  return data?.length || 0
}

/**
 * Main update function
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    console.log('[update-gameweek-status] Starting game week status update...')

    const now = new Date()
    const nowISO = now.toISOString()

    // Get all game weeks that need status updates
    const { data: gameWeeks, error: fetchError } = await supabase
      .from('fantasy_game_weeks')
      .select('id, status, start_date, end_date, game_id')
      .neq('status', 'finished') // Don't process finished game weeks

    if (fetchError) {
      throw new Error(`Failed to fetch game weeks: ${fetchError.message}`)
    }

    if (!gameWeeks || gameWeeks.length === 0) {
      console.log('[update-gameweek-status] No game weeks to process')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No game weeks to process',
          updated: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[update-gameweek-status] Found ${gameWeeks.length} game weeks to check`)

    let upcomingToLive = 0
    let liveToFinished = 0
    let teamsLocked = 0
    const updates: Array<{ id: string; from: string; to: string }> = []

    for (const gameWeek of gameWeeks as GameWeek[]) {
      const startDate = new Date(gameWeek.start_date)
      const endDate = new Date(gameWeek.end_date)

      let newStatus: GameWeekStatus | null = null

      // Check for upcoming → live transition
      if (gameWeek.status === 'upcoming' && now >= startDate) {
        newStatus = 'live'
        upcomingToLive++
        updates.push({ id: gameWeek.id, from: 'upcoming', to: 'live' })

        console.log(`[update-gameweek-status] Game week ${gameWeek.id} transitioning to LIVE`)

        // Lock all teams for this game week
        try {
          const lockedCount = await lockTeamsForGameWeek(supabase, gameWeek.id)
          teamsLocked += lockedCount
          console.log(`[update-gameweek-status] Locked ${lockedCount} teams for game week ${gameWeek.id}`)
        } catch (lockError) {
          console.error(`[update-gameweek-status] Failed to lock teams for game week ${gameWeek.id}:`, lockError)
          // Continue with status update even if locking fails
        }
      }
      // Check for live → finished transition
      else if (gameWeek.status === 'live' && now >= endDate) {
        newStatus = 'finished'
        liveToFinished++
        updates.push({ id: gameWeek.id, from: 'live', to: 'finished' })

        console.log(`[update-gameweek-status] Game week ${gameWeek.id} transitioning to FINISHED`)
      }

      // Update status if changed
      if (newStatus) {
        const { error: updateError } = await supabase
          .from('fantasy_game_weeks')
          .update({
            status: newStatus,
            updated_at: nowISO
          })
          .eq('id', gameWeek.id)

        if (updateError) {
          console.error(`[update-gameweek-status] Error updating game week ${gameWeek.id}:`, updateError)
          // Continue processing other game weeks
        } else {
          console.log(`[update-gameweek-status] Successfully updated game week ${gameWeek.id}: ${gameWeek.status} → ${newStatus}`)
        }
      }
    }

    console.log('[update-gameweek-status] Status update complete')
    console.log(`[update-gameweek-status] Upcoming → Live: ${upcomingToLive}`)
    console.log(`[update-gameweek-status] Live → Finished: ${liveToFinished}`)
    console.log(`[update-gameweek-status] Teams locked: ${teamsLocked}`)

    return new Response(
      JSON.stringify({
        success: true,
        game_weeks_checked: gameWeeks.length,
        transitions: {
          upcoming_to_live: upcomingToLive,
          live_to_finished: liveToFinished,
        },
        teams_locked: teamsLocked,
        updates,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('[update-gameweek-status] Fatal error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
