import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncRequest {
  league_id: string;
  season?: number;
  batch_size?: number;
}

interface PlayerMatchStat {
  player_id: string;
  fixture_id: string;
  team_id: string;
  minutes_played: number;
  started: boolean;
  substitute_in: boolean;
  substitute_out: boolean;
  rating: number | null;
  position: string;
  goals: number;
  assists: number;
  shots_total: number;
  shots_on_target: number;
  passes_total: number;
  passes_key: number;
  passes_accuracy: number | null;
  tackles_total: number;
  tackles_interceptions: number;
  duels_total: number;
  duels_won: number;
  dribbles_attempts: number;
  dribbles_success: number;
  fouls_drawn: number;
  fouls_committed: number;
  yellow_card: boolean;
  red_card: boolean;
  saves: number;
  goals_conceded: number;
  clean_sheet: boolean;
  penalties_saved: number;
  penalties_missed: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        db: {
          schema: 'public'
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const apiKey = Deno.env.get('API_SPORTS_KEY')
    if (!apiKey) {
      throw new Error('API_SPORTS_KEY is not configured')
    }

    const { league_id, season, batch_size = 50 }: SyncRequest = await req.json()

    if (!league_id) {
      throw new Error('league_id is required')
    }

    const currentYear = season || new Date().getFullYear()

    console.log(`[sync-player-match-stats] Starting sync for league: ${league_id}, season: ${currentYear}`)

    // Get all finished fixtures for this league
    const { data: fixtures, error: fetchError } = await supabaseClient
      .from('fixtures')
      .select('id, api_id, league_id, home_team_id, away_team_id, date')
      .eq('league_id', league_id)
      .eq('status', 'FT') // Only finished matches
      .not('api_id', 'is', null)

    if (fetchError) {
      console.error('[sync-player-match-stats] Error fetching fixtures:', fetchError)
      throw fetchError
    }

    if (!fixtures || fixtures.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          message: `No finished fixtures found for league ${league_id}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[sync-player-match-stats] Found ${fixtures.length} finished fixtures`)

    let totalProcessed = 0
    let totalPlayersInserted = 0
    let totalPlayersCreated = 0
    let totalTeamsCreated = 0
    let errors = 0

    // First pass: collect all unique player/team IDs from API to pre-create them in batch
    console.log(`[sync-player-match-stats] Phase 1: Pre-creating players and teams...`)
    const allPlayerIds = new Set<number>()
    const allTeamIds = new Set<number>()
    const playerInfoMap = new Map<number, any>()
    const teamInfoMap = new Map<number, any>()

    // Sample first 5 fixtures to collect player/team info (to avoid API rate limits)
    const sampleFixtures = fixtures.slice(0, Math.min(5, fixtures.length))

    for (const fixture of sampleFixtures) {
      try {
        const response = await fetch(
          `https://v3.football.api-sports.io/fixtures/players?fixture=${fixture.api_id}`,
          { headers: { 'x-apisports-key': apiKey } }
        )

        if (response.ok) {
          const data = await response.json()
          if (data.response) {
            for (const teamData of data.response) {
              allTeamIds.add(teamData.team.id)
              teamInfoMap.set(teamData.team.id, teamData.team)

              for (const playerData of teamData.players) {
                allPlayerIds.add(playerData.player.id)
                playerInfoMap.set(playerData.player.id, playerData.player)
              }
            }
          }
        }

        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        console.warn(`[sync-player-match-stats] Error sampling fixture ${fixture.api_id}`)
      }
    }

    console.log(`[sync-player-match-stats] Found ${allPlayerIds.size} unique players, ${allTeamIds.size} unique teams`)

    // Batch create teams in ONE operation
    const teamsToCreate = Array.from(allTeamIds).map(teamId => {
      const teamInfo = teamInfoMap.get(teamId)
      return {
        api_id: teamId,
        name: teamInfo.name,
        logo: teamInfo.logo,
      }
    })

    if (teamsToCreate.length > 0) {
      const { error: teamsError, count } = await supabaseClient
        .from('teams')
        .upsert(teamsToCreate, { onConflict: 'api_id', ignoreDuplicates: true })
        .select('id', { count: 'exact', head: true })

      if (!teamsError) {
        totalTeamsCreated = count || teamsToCreate.length
      } else {
        console.error('[sync-player-match-stats] Error creating teams:', teamsError)
      }
    }

    // Batch create players in ONE operation
    const playersToCreate = Array.from(allPlayerIds).map(playerId => {
      const playerInfo = playerInfoMap.get(playerId)
      return {
        api_id: playerId,
        first_name: playerInfo.name?.split(' ')[0] || 'Unknown',
        last_name: playerInfo.name?.split(' ').slice(1).join(' ') || '',
        photo_url: playerInfo.photo,
      }
    })

    if (playersToCreate.length > 0) {
      const { error: playersError, count } = await supabaseClient
        .from('players')
        .upsert(playersToCreate, { onConflict: 'api_id', ignoreDuplicates: true })
        .select('id', { count: 'exact', head: true })

      if (!playersError) {
        totalPlayersCreated = count || playersToCreate.length
      } else {
        console.error('[sync-player-match-stats] Error creating players:', playersError)
      }
    }

    console.log(`[sync-player-match-stats] Pre-created ${totalTeamsCreated} teams, ${totalPlayersCreated} players`)
    console.log(`[sync-player-match-stats] Phase 2: Processing match stats...`)

    // Process fixtures in batches
    for (let i = 0; i < fixtures.length; i += batch_size) {
      const batch = fixtures.slice(i, i + batch_size)
      console.log(`[sync-player-match-stats] Processing batch ${Math.floor(i / batch_size) + 1}/${Math.ceil(fixtures.length / batch_size)}`)

      for (const fixture of batch) {
        try {
          // Fetch player stats for this fixture from API-Football
          const response = await fetch(
            `https://v3.football.api-sports.io/fixtures/players?fixture=${fixture.api_id}`,
            {
              headers: {
                'x-apisports-key': apiKey,
              },
            }
          )

          if (!response.ok) {
            console.error(`[sync-player-match-stats] API error for fixture ${fixture.api_id}: ${response.statusText}`)
            errors++
            continue
          }

          const data = await response.json()

          if (!data.response || data.response.length === 0) {
            console.warn(`[sync-player-match-stats] No player data for fixture ${fixture.api_id}`)
            continue
          }

          // Parse and insert player stats
          const playerStats: PlayerMatchStat[] = []

          for (const teamData of data.response) {
            const teamId = teamData.team.id

            // Resolve team UUID from api_id (should exist from pre-creation phase)
            const { data: teamRecord } = await supabaseClient
              .from('teams')
              .select('id')
              .eq('api_id', teamId)
              .single()

            if (!teamRecord) {
              console.warn(`[sync-player-match-stats] Team not found for api_id ${teamId}, skipping`)
              continue
            }

            for (const playerData of teamData.players) {
              const playerApiId = playerData.player.id
              const stats = playerData.statistics[0] // First statistics object

              // Resolve player UUID from api_id (should exist from pre-creation phase)
              const { data: playerRecord } = await supabaseClient
                .from('players')
                .select('id')
                .eq('api_id', playerApiId)
                .single()

              if (!playerRecord) {
                console.warn(`[sync-player-match-stats] Player not found for api_id ${playerApiId}, skipping`)
                continue
              }

              // Parse player stats
              const minutesPlayed = stats.games?.minutes || 0
              const rating = stats.games?.rating ? parseFloat(stats.games.rating) : null

              // Check if player kept a clean sheet (for GK/DEF)
              const cleanSheet = stats.goals?.conceded === 0 && minutesPlayed >= 60

              playerStats.push({
                player_id: playerRecord.id,
                fixture_id: fixture.id,
                team_id: teamRecord.id,
                minutes_played: minutesPlayed,
                started: stats.games?.position?.toLowerCase() !== 'substitute',
                substitute_in: stats.games?.substitute === true,
                substitute_out: minutesPlayed > 0 && minutesPlayed < 90,
                rating,
                position: stats.games?.position || 'Unknown',
                goals: stats.goals?.total || 0,
                assists: stats.goals?.assists || 0,
                shots_total: stats.shots?.total || 0,
                shots_on_target: stats.shots?.on || 0,
                passes_total: stats.passes?.total || 0,
                passes_key: stats.passes?.key || 0,
                passes_accuracy: stats.passes?.accuracy ? parseFloat(stats.passes.accuracy) : null,
                tackles_total: stats.tackles?.total || 0,
                tackles_interceptions: stats.tackles?.interceptions || 0,
                duels_total: stats.duels?.total || 0,
                duels_won: stats.duels?.won || 0,
                dribbles_attempts: stats.dribbles?.attempts || 0,
                dribbles_success: stats.dribbles?.success || 0,
                fouls_drawn: stats.fouls?.drawn || 0,
                fouls_committed: stats.fouls?.committed || 0,
                yellow_card: (stats.cards?.yellow || 0) > 0,
                red_card: (stats.cards?.red || 0) > 0,
                saves: stats.goals?.saves || 0,
                goals_conceded: stats.goals?.conceded || 0,
                clean_sheet: cleanSheet,
                penalties_saved: stats.penalty?.saved || 0,
                penalties_missed: stats.penalty?.missed || 0,
              })
            }
          }

          // Insert all player stats for this fixture
          if (playerStats.length > 0) {
            const { error: insertError } = await supabaseClient
              .from('player_match_stats')
              .upsert(playerStats, {
                onConflict: 'player_id,fixture_id',
                ignoreDuplicates: false
              })

            if (insertError) {
              console.error(`[sync-player-match-stats] Error inserting stats for fixture ${fixture.api_id}:`, insertError)
              errors++
            } else {
              totalPlayersInserted += playerStats.length
              console.log(`[sync-player-match-stats] Inserted ${playerStats.length} player stats for fixture ${fixture.api_id}`)
            }
          }

          totalProcessed++

          // Rate limiting: 500ms between API calls
          await new Promise(resolve => setTimeout(resolve, 500))

        } catch (error: any) {
          console.error(`[sync-player-match-stats] Error processing fixture ${fixture.id}:`, error.message)
          errors++
        }
      }
    }

    console.log(`[sync-player-match-stats] Sync complete`)
    console.log(`  Fixtures processed: ${totalProcessed}/${fixtures.length}`)
    console.log(`  Player stats inserted: ${totalPlayersInserted}`)
    console.log(`  Errors: ${errors}`)

    // Now aggregate into player_season_stats
    console.log(`[sync-player-match-stats] Starting aggregation into player_season_stats...`)

    const { data: aggregationResult, error: aggregationError } = await supabaseClient
      .rpc('aggregate_player_season_stats', {
        p_league_id: league_id,
        p_season: currentYear
      })

    if (aggregationError) {
      console.error('[sync-player-match-stats] Error aggregating season stats:', aggregationError)
      return new Response(
        JSON.stringify({
          success: false,
          error: `Aggregation failed: ${aggregationError.message}`,
          partial_result: {
            fixtures_processed: totalProcessed,
            player_stats_inserted: totalPlayersInserted,
            errors
          }
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const playersProcessed = aggregationResult?.[0]?.players_processed || 0

    console.log(`[sync-player-match-stats] Aggregation complete: ${playersProcessed} players`)

    return new Response(
      JSON.stringify({
        success: true,
        fixtures_processed: totalProcessed,
        total_fixtures: fixtures.length,
        player_match_stats_inserted: totalPlayersInserted,
        player_season_stats_created: playersProcessed,
        errors,
        message: `Successfully synced ${totalProcessed} fixtures with ${totalPlayersInserted} player stats. Aggregated ${playersProcessed} player season stats.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[sync-player-match-stats] Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
