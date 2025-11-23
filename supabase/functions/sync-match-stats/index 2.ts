/**
 * Sync Match Stats Edge Function
 *
 * Synchronizes player match statistics from API-Sports to Supabase.
 * This function should be called after matches complete to fetch real match data.
 *
 * This differs from sync-fantasy-players (which syncs season stats) by:
 * - Fetching match-specific stats (not season aggregates)
 * - Populating player_match_stats table
 * - Including detailed per-match performance metrics
 *
 * Environment variables required:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - API_SPORTS_KEY
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const API_SPORTS_KEY = Deno.env.get('API_SPORTS_KEY')!

// Rate limiting: 10 requests per second for API-Sports
const RATE_LIMIT_MS = 100

// ============================================================================
// Helper Functions
// ============================================================================

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Fetch fixture stats from API-Sports
 */
async function fetchFixtureStatsFromAPI(fixtureApiId: number): Promise<any | null> {
  try {
    await delay(RATE_LIMIT_MS) // Rate limiting

    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures/players?fixture=${fixtureApiId}`,
      {
        headers: {
          'x-apisports-key': API_SPORTS_KEY,
        },
      }
    )

    if (!response.ok) {
      console.error(`API-Sports error for fixture ${fixtureApiId}:`, response.statusText)
      return null
    }

    const data = await response.json()
    if (!data.response || data.response.length === 0) {
      console.log(`No stats found for fixture ${fixtureApiId}`)
      return null
    }

    return data.response
  } catch (error) {
    console.error(`Error fetching fixture ${fixtureApiId}:`, error)
    return null
  }
}

/**
 * Parse player stats from API response
 */
function parsePlayerStats(playerData: any): any {
  const stats = playerData.statistics?.[0]
  if (!stats) return null

  const games = stats.games || {}
  const goals = stats.goals || {}
  const shots = stats.shots || {}
  const passes = stats.passes || {}
  const tackles = stats.tackles || {}
  const duels = stats.duels || {}
  const dribbles = stats.dribbles || {}
  const fouls = stats.fouls || {}
  const cards = stats.cards || {}
  const penalty = stats.penalty || {}

  return {
    minutes_played: games.minutes || 0,
    started: games.position !== 'S', // S = Substitute
    substitute_in: games.substitute === true,
    substitute_out: false, // Not available in API
    rating: games.rating ? parseFloat(games.rating) : null,
    position: games.position,
    goals: goals.total || 0,
    assists: goals.assists || 0,
    shots_total: shots.total || 0,
    shots_on_target: shots.on || 0,
    passes_total: passes.total || 0,
    passes_key: passes.key || 0,
    passes_accuracy: passes.accuracy || 0,
    tackles_total: tackles.total || 0,
    tackles_interceptions: tackles.interceptions || 0,
    duels_total: duels.total || 0,
    duels_won: duels.won || 0,
    dribbles_attempts: dribbles.attempts || 0,
    dribbles_success: dribbles.success || 0,
    fouls_drawn: fouls.drawn || 0,
    fouls_committed: fouls.committed || 0,
    yellow_card: (cards.yellow || 0) > 0,
    red_card: (cards.red || 0) > 0,
    saves: stats.goals?.saves || 0,
    goals_conceded: stats.goals?.conceded || 0,
    penalties_scored: penalty.scored || 0,
    penalties_missed: penalty.missed || 0,
    penalties_saved: penalty.saved || 0,
  }
}

/**
 * Main sync function
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get parameters from request
    const { fixture_ids, game_week_id } = await req.json()

    if (!fixture_ids && !game_week_id) {
      return new Response(
        JSON.stringify({ error: 'Either fixture_ids or game_week_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[sync-match-stats] Starting sync...')

    let fixturesToSync: any[] = []

    // Option 1: Sync specific fixtures by IDs
    if (fixture_ids && Array.isArray(fixture_ids)) {
      const { data: fixtures, error } = await supabase
        .from('fb_fixtures')
        .select('id, api_id')
        .in('id', fixture_ids)

      if (error) {
        throw new Error(`Failed to fetch fixtures: ${error.message}`)
      }

      fixturesToSync = fixtures || []
    }
    // Option 2: Sync all fixtures in a game week
    else if (game_week_id) {
      // Get game week details
      const { data: gameWeek, error: gwError } = await supabase
        .from('fantasy_game_weeks')
        .select('start_date, end_date')
        .eq('id', game_week_id)
        .single()

      if (gwError || !gameWeek) {
        throw new Error(`Game week not found: ${gwError?.message}`)
      }

      // Get all fixtures in this date range
      const { data: fixtures, error } = await supabase
        .from('fb_fixtures')
        .select('id, api_id')
        .gte('date', gameWeek.start_date)
        .lte('date', gameWeek.end_date)
        .eq('status', 'FT') // Only finished matches

      if (error) {
        throw new Error(`Failed to fetch fixtures: ${error.message}`)
      }

      fixturesToSync = fixtures || []
    }

    console.log(`[sync-match-stats] Found ${fixturesToSync.length} fixtures to sync`)

    let totalPlayers = 0
    let successCount = 0
    let errorCount = 0

    // Sync each fixture
    for (const fixture of fixturesToSync) {
      console.log(`[sync-match-stats] Syncing fixture ${fixture.api_id}...`)

      // Fetch stats from API-Sports
      const fixtureStats = await fetchFixtureStatsFromAPI(fixture.api_id)
      if (!fixtureStats) {
        console.log(`[sync-match-stats] No stats for fixture ${fixture.api_id}`)
        continue
      }

      // Process both teams
      for (const teamData of fixtureStats) {
        const teamId = teamData.team?.id
        const players = teamData.players || []

        for (const playerData of players) {
          totalPlayers++

          try {
            const apiPlayerId = playerData.player?.id
            const playerName = playerData.player?.name

            if (!apiPlayerId) {
              console.warn('[sync-match-stats] Player missing API ID, skipping')
              continue
            }

            // Find player in our database by api_player_id
            const { data: dbPlayer, error: playerError } = await supabase
              .from('players')
              .select('id')
              .eq('api_id', apiPlayerId)
              .single()

            if (playerError || !dbPlayer) {
              console.warn(`[sync-match-stats] Player ${playerName} (API ID: ${apiPlayerId}) not found in database`)
              continue
            }

            // Find team in our database
            const { data: dbTeam } = await supabase
              .from('teams')
              .select('id')
              .eq('api_id', teamId)
              .single()

            if (!dbTeam) {
              console.warn(`[sync-match-stats] Team ${teamId} not found in database`)
              continue
            }

            // Parse player stats
            const stats = parsePlayerStats(playerData)
            if (!stats) {
              console.warn(`[sync-match-stats] No stats for player ${playerName}`)
              continue
            }

            // Upsert player match stats
            const { error: upsertError } = await supabase
              .from('player_match_stats')
              .upsert({
                player_id: dbPlayer.id,
                fixture_id: fixture.id,
                team_id: dbTeam.id,
                api_id: apiPlayerId,
                ...stats,
              }, {
                onConflict: 'player_id,fixture_id',
              })

            if (upsertError) {
              console.error(`[sync-match-stats] Error upserting stats for ${playerName}:`, upsertError)
              errorCount++
            } else {
              successCount++
            }
          } catch (error: any) {
            console.error(`[sync-match-stats] Error processing player:`, error)
            errorCount++
          }
        }
      }
    }

    console.log('[sync-match-stats] Sync complete')
    console.log(`[sync-match-stats] Total players processed: ${totalPlayers}`)
    console.log(`[sync-match-stats] Success: ${successCount}, Errors: ${errorCount}`)

    return new Response(
      JSON.stringify({
        success: true,
        fixtures_synced: fixturesToSync.length,
        players_processed: totalPlayers,
        success_count: successCount,
        error_count: errorCount,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('[sync-match-stats] Fatal error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
