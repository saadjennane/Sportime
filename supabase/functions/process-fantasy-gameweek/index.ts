import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Helper function to calculate age from birthdate
function calculateAge(birthdate: string): number {
  const birth = new Date(birthdate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Fantasy scoring configuration
const FANTASY_CONFIG = {
  fatigue: { star: 0.2, key: 0.1, rest: 0.1 },
  bonuses: { no_star: 1.25, crazy: 1.4, vintage: 1.2 },
  boosters: { double_impact: 2.0, golden_game: 1.2 },
  captain_passive: 1.1,
}

const BASE_SCORING_TABLE: Record<string, Record<string, number>> = {
  minutes_played: { Goalkeeper: 1, Defender: 1, Midfielder: 1, Attacker: 1 },
  clean_sheet: { Goalkeeper: 5, Defender: 4, Midfielder: 2, Attacker: 0 },
  goals: { Goalkeeper: 8, Defender: 6, Midfielder: 5, Attacker: 4 },
  assists: { Goalkeeper: 4, Defender: 4, Midfielder: 3, Attacker: 2 },
  shots_on_target: { Goalkeeper: 0.5, Defender: 0.5, Midfielder: 0.5, Attacker: 0.5 },
  saves: { Goalkeeper: 1 / 3, Defender: 0, Midfielder: 0, Attacker: 0 },
  penalties_saved: { Goalkeeper: 5, Defender: 0, Midfielder: 0, Attacker: 0 },
  penalties_scored: { Goalkeeper: 3, Defender: 3, Midfielder: 3, Attacker: 3 },
  penalties_missed: { Goalkeeper: -2, Defender: -2, Midfielder: -2, Attacker: -2 },
  yellow_cards: { Goalkeeper: -1, Defender: -1, Midfielder: -1, Attacker: -1 },
  red_cards: { Goalkeeper: -3, Defender: -3, Midfielder: -3, Attacker: -3 },
  goals_conceded: { Goalkeeper: -1, Defender: -0.5, Midfielder: 0, Attacker: 0 },
  interceptions: { Goalkeeper: 0.3, Defender: 0.5, Midfielder: 0.2, Attacker: 0 },
  tackles: { Goalkeeper: 0.3, Defender: 0.5, Midfielder: 0.2, Attacker: 0 },
  duels_won: { Goalkeeper: 0.2, Defender: 0.3, Midfielder: 0.3, Attacker: 0.2 },
  duels_lost: { Goalkeeper: -0.1, Defender: -0.1, Midfielder: -0.1, Attacker: -0.1 },
  dribbles_succeeded: { Goalkeeper: 0, Defender: 0.2, Midfielder: 0.3, Attacker: 0.3 },
  fouls_committed: { Goalkeeper: -0.3, Defender: -0.3, Midfielder: -0.3, Attacker: -0.3 },
  fouls_suffered: { Goalkeeper: 0.2, Defender: 0.2, Midfielder: 0.2, Attacker: 0.2 },
  rating: { Goalkeeper: 1.5, Defender: 1.3, Midfielder: 1.2, Attacker: 1.1 },
}

// Types
type PlayerPosition = 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Attacker'
type PlayerCategory = 'Star' | 'Key' | 'Wild'

interface PlayerMatchStats {
  minutes_played: number
  goals: number
  assists: number
  clean_sheet: boolean
  shots_on_target: number
  saves: number
  penalties_scored: number
  penalties_missed: number
  yellow_cards: number
  red_cards: number
  goals_conceded: number
  interceptions: number
  tackles: number
  duels_won: number
  duels_lost: number
  dribbles_succeeded: number
  fouls_committed: number
  fouls_suffered: number
  penalties_saved: number
  rating: number
}

/**
 * Calculate player points based on match stats
 */
function computePlayerPoints(
  stats: PlayerMatchStats,
  position: PlayerPosition,
  fatigue: number,
  isCaptain: boolean,
  isDoubleImpactActive: boolean
): number {
  let basePoints = 0

  // Minutes played bonus
  if (stats.minutes_played > 60) {
    basePoints += BASE_SCORING_TABLE.minutes_played[position]
  }

  // Clean sheet bonus
  if (stats.clean_sheet && stats.minutes_played > 60) {
    basePoints += BASE_SCORING_TABLE.clean_sheet[position]
  }

  // Action-based scoring
  Object.keys(stats).forEach((action) => {
    if (action === 'minutes_played' || action === 'clean_sheet' || action === 'rating') return

    const value = stats[action as keyof PlayerMatchStats]
    if (typeof value === 'number' && value !== 0) {
      const pointsPerAction = BASE_SCORING_TABLE[action]?.[position]
      if (pointsPerAction) {
        basePoints += pointsPerAction * value
      }
    }
  })

  // Apply rating multiplier
  const ratingMultiplier = BASE_SCORING_TABLE.rating[position]
  const ratingPoints = basePoints * (ratingMultiplier - 1)
  basePoints += ratingPoints

  let finalPoints = basePoints

  // Apply fatigue multiplier (fatigue is 0-100, convert to 0-1)
  const fatigueMultiplier = fatigue / 100
  finalPoints = finalPoints * fatigueMultiplier

  // Apply captain bonus
  if (isCaptain) {
    finalPoints *= FANTASY_CONFIG.captain_passive

    if (isDoubleImpactActive) {
      finalPoints *= FANTASY_CONFIG.boosters.double_impact
    }
  }

  return finalPoints
}

/**
 * Calculate fatigue decay based on player category and whether they played
 */
function calculateFatigue(currentFatigue: number, category: PlayerCategory, played: boolean): number {
  if (!played) {
    return Math.min(100, currentFatigue + FANTASY_CONFIG.fatigue.rest * 100)
  }

  let fatigueReduction = 0
  if (category === 'Star') {
    fatigueReduction = FANTASY_CONFIG.fatigue.star * 100
  } else if (category === 'Key') {
    fatigueReduction = FANTASY_CONFIG.fatigue.key * 100
  }

  return Math.max(0, currentFatigue - fatigueReduction)
}

/**
 * Process a single game week: calculate points and update leaderboard
 */
serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get game week ID from request
    const { game_week_id } = await req.json()

    if (!game_week_id) {
      return new Response(
        JSON.stringify({ error: 'game_week_id is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[process-fantasy-gameweek] Processing game week: ${game_week_id}`)

    // 1. Get game week details
    const { data: gameWeek, error: gwError } = await supabase
      .from('fantasy_game_weeks')
      .select('*, fantasy_games(*)')
      .eq('id', game_week_id)
      .single()

    if (gwError || !gameWeek) {
      throw new Error(`Game week not found: ${gwError?.message}`)
    }

    // 2. Get all user teams for this game week
    const { data: userTeams, error: teamsError } = await supabase
      .from('user_fantasy_teams')
      .select('*')
      .eq('game_week_id', game_week_id)

    if (teamsError) {
      throw new Error(`Failed to fetch user teams: ${teamsError.message}`)
    }

    console.log(`[process-fantasy-gameweek] Found ${userTeams?.length || 0} teams to process`)

    // 3. Get all player match stats for this game week's fixtures
    const { data: matchStats, error: statsError } = await supabase
      .from('player_match_stats')
      .select('*')
      .gte('match_date', gameWeek.start_date)
      .lte('match_date', gameWeek.end_date)

    if (statsError) {
      throw new Error(`Failed to fetch match stats: ${statsError.message}`)
    }

    console.log(`[process-fantasy-gameweek] Found ${matchStats?.length || 0} player match stats`)

    // Create a map of player stats by api_player_id
    const statsMap = new Map<number, PlayerMatchStats>()
    matchStats?.forEach((stat: any) => {
      statsMap.set(stat.api_player_id, {
        minutes_played: stat.minutes_played || 0,
        goals: stat.goals || 0,
        assists: stat.assists || 0,
        clean_sheet: stat.clean_sheet || false,
        shots_on_target: stat.shots_on_target || 0,
        saves: stat.saves || 0,
        penalties_scored: stat.penalties_scored || 0,
        penalties_missed: stat.penalties_missed || 0,
        yellow_cards: stat.yellow_cards || 0,
        red_cards: stat.red_cards || 0,
        goals_conceded: stat.goals_conceded || 0,
        interceptions: stat.interceptions || 0,
        tackles: stat.tackles || 0,
        duels_won: stat.duels_won || 0,
        duels_lost: stat.duels_lost || 0,
        dribbles_succeeded: stat.dribbles_succeeded || 0,
        fouls_committed: stat.fouls_committed || 0,
        fouls_suffered: stat.fouls_suffered || 0,
        penalties_saved: stat.penalties_saved || 0,
        rating: stat.rating || 0,
      })
    })

    // 4. Process each user team
    const leaderboardEntries = []
    const teamUpdates = []
    const playerFatigueUpdates = new Map<string, number>()

    for (const team of userTeams || []) {
      // Get all player IDs (starters + substitutes)
      const allPlayerIds = [...team.starters, ...team.substitutes]

      // Fetch player details
      const { data: players, error: playersError } = await supabase
        .from('fantasy_players')
        .select('*')
        .in('id', allPlayerIds)

      if (playersError) {
        console.error(`Failed to fetch players for team ${team.id}:`, playersError)
        continue
      }

      // Calculate points for each starter
      let teamTotalPoints = 0
      const starterPlayers = players?.filter(p => team.starters.includes(p.id)) || []
      const isDoubleImpactActive = team.booster_used === 1
      const isGoldenGameActive = team.booster_used === 2
      const isRecoveryBoostActive = team.booster_used === 3

      // Check if we need to refund Recovery Boost (if targeted player DNP)
      let shouldRefundBooster = false
      if (isRecoveryBoostActive) {
        const recoveryTarget = team.booster_target_id
        if (recoveryTarget) {
          const targetPlayer = players?.find(p => p.id === recoveryTarget)
          if (targetPlayer) {
            const targetStats = statsMap.get(targetPlayer.api_player_id)
            if (!targetStats || targetStats.minutes_played === 0) {
              shouldRefundBooster = true
              console.log(`[process-fantasy-gameweek] Refunding Recovery Boost for team ${team.id} - player DNP`)
            }
          }
        } else {
          // No target selected, refund booster
          shouldRefundBooster = true
          console.log(`[process-fantasy-gameweek] Refunding Recovery Boost for team ${team.id} - no target selected`)
        }
      }

      for (const player of starterPlayers) {
        const stats = statsMap.get(player.api_player_id)
        const isCaptain = player.id === team.captain_id

        // Get fatigue from fatigue_state or use current player fatigue
        let fatigue = team.fatigue_state?.[player.id] || player.fatigue || 100

        // Apply Recovery Boost if active and this is the targeted player
        if (isRecoveryBoostActive && !shouldRefundBooster && player.id === team.booster_target_id) {
          fatigue = 100 // Restore to full fatigue
          console.log(`[process-fantasy-gameweek] Applied Recovery Boost to player ${player.id}`)
        }

        if (stats) {
          const points = computePlayerPoints(
            stats,
            player.position as PlayerPosition,
            fatigue,
            isCaptain,
            isDoubleImpactActive
          )
          teamTotalPoints += points

          // Calculate new fatigue
          const played = stats.minutes_played > 0
          const newFatigue = calculateFatigue(fatigue, player.status as PlayerCategory, played)

          // Store fatigue update (we'll batch these later)
          if (!playerFatigueUpdates.has(player.id)) {
            playerFatigueUpdates.set(player.id, newFatigue)
          }
        } else {
          // Player didn't play - increase fatigue (rested)
          const newFatigue = calculateFatigue(fatigue, player.status as PlayerCategory, false)
          if (!playerFatigueUpdates.has(player.id)) {
            playerFatigueUpdates.set(player.id, newFatigue)
          }
        }
      }

      // Apply team bonuses
      const isNoStar = starterPlayers.every(p => p.status !== 'Star')
      if (isNoStar) {
        teamTotalPoints *= FANTASY_CONFIG.bonuses.no_star
      }

      const isCrazy = starterPlayers.every(p => p.status === 'Wild')
      if (isCrazy) {
        teamTotalPoints *= FANTASY_CONFIG.bonuses.crazy
      }

      const avgAge = starterPlayers.reduce((sum, p) => sum + calculateAge(p.birthdate), 0) / starterPlayers.length
      if (avgAge >= 30) {
        teamTotalPoints *= FANTASY_CONFIG.bonuses.vintage
      }

      // Apply Golden Game booster
      if (isGoldenGameActive) {
        teamTotalPoints *= FANTASY_CONFIG.boosters.golden_game
      }

      // Get user details for leaderboard
      const { data: user } = await supabase
        .from('users')
        .select('username, avatar')
        .eq('id', team.user_id)
        .single()

      // Update team total points
      teamUpdates.push({
        id: team.id,
        total_points: Math.round(teamTotalPoints * 10) / 10,
        booster_used: shouldRefundBooster ? null : team.booster_used, // Refund if needed
        booster_target_id: shouldRefundBooster ? null : team.booster_target_id, // Clear target if refunded
      })

      // Add to leaderboard
      leaderboardEntries.push({
        game_id: team.game_id,
        game_week_id: team.game_week_id,
        user_id: team.user_id,
        username: user?.username || 'Unknown',
        avatar: user?.avatar,
        total_points: Math.round(teamTotalPoints * 10) / 10,
        booster_used: shouldRefundBooster ? null : team.booster_used,
      })
    }

    // 5. Update user_fantasy_teams with total_points
    for (const update of teamUpdates) {
      await supabase
        .from('user_fantasy_teams')
        .update({
          total_points: update.total_points,
          booster_used: update.booster_used,
          booster_target_id: update.booster_target_id
        })
        .eq('id', update.id)
    }

    // 6. Update player fatigue
    for (const [playerId, fatigue] of playerFatigueUpdates.entries()) {
      await supabase
        .from('fantasy_players')
        .update({ fatigue: Math.round(fatigue) })
        .eq('id', playerId)
    }

    // 7. Clear existing leaderboard for this game week
    await supabase
      .from('fantasy_leaderboard')
      .delete()
      .eq('game_week_id', game_week_id)

    // 8. Insert new leaderboard entries (sorted by points)
    if (leaderboardEntries.length > 0) {
      leaderboardEntries.sort((a, b) => b.total_points - a.total_points)

      // Add rank
      leaderboardEntries.forEach((entry, index) => {
        entry.rank = index + 1
      })

      const { error: leaderboardError } = await supabase
        .from('fantasy_leaderboard')
        .insert(leaderboardEntries)

      if (leaderboardError) {
        throw new Error(`Failed to update leaderboard: ${leaderboardError.message}`)
      }
    }

    console.log(`[process-fantasy-gameweek] Successfully processed ${userTeams?.length || 0} teams`)
    console.log(`[process-fantasy-gameweek] Updated ${playerFatigueUpdates.size} player fatigue values`)
    console.log(`[process-fantasy-gameweek] Created ${leaderboardEntries.length} leaderboard entries`)

    return new Response(
      JSON.stringify({
        success: true,
        teams_processed: userTeams?.length || 0,
        leaderboard_entries: leaderboardEntries.length,
        fatigue_updates: playerFatigueUpdates.size,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('[process-fantasy-gameweek] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
