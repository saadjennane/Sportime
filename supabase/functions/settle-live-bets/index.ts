/**
 * Settle Live Bets Edge Function
 *
 * Automatically resolves confirmed bets based on match results and events.
 * Supports multiple market types: 1X2, Over/Under, BTTS, Next Goal, etc.
 *
 * Endpoint: POST /functions/v1/settle-live-bets
 * Body: { gameId?: string } - Optional, if not provided settles all live/finished games
 */

import 'jsr:@supabase/functions-js'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

interface Bet {
  id: string
  entry_id: string
  category: string
  market_id: number
  market_name: string
  choice: string
  choice_label: string
  amount: number
  odds: number
  placed_at_minute: number | null
}

interface MatchResult {
  homeScore: number
  awayScore: number
  status: string
  events: any[]
}

function cors(req: Request) {
  const origin = req.headers.get('origin') ?? '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': '*',
  }
}

function json(body: unknown, status = 200, req: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...cors(req) },
  })
}

// Settlement logic for different market types
function settleBet(bet: Bet, result: MatchResult): { won: boolean; reason: string } | null {
  const { homeScore, awayScore, status } = result
  const totalGoals = homeScore + awayScore
  const choice = bet.choice.toLowerCase()
  const marketName = bet.market_name.toLowerCase()

  // Only settle when match is finished
  const finishedStatuses = ['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO']
  if (!finishedStatuses.includes(status)) {
    return null // Not ready to settle
  }

  // Match Result (1X2)
  if (marketName.includes('match result') || marketName.includes('1x2') || marketName.includes('match winner')) {
    if (choice === 'home' || choice === 'home_win' || choice === '1') {
      return { won: homeScore > awayScore, reason: `Home ${homeScore > awayScore ? 'won' : 'did not win'}` }
    }
    if (choice === 'draw' || choice === 'x') {
      return { won: homeScore === awayScore, reason: `Match ${homeScore === awayScore ? 'was' : 'was not'} a draw` }
    }
    if (choice === 'away' || choice === 'away_win' || choice === '2') {
      return { won: awayScore > homeScore, reason: `Away ${awayScore > homeScore ? 'won' : 'did not win'}` }
    }
  }

  // Over/Under
  if (marketName.includes('over') || marketName.includes('under') || marketName.includes('o/u')) {
    const lineMatch = bet.choice_label.match(/(\d+\.?\d*)/);
    if (lineMatch) {
      const line = parseFloat(lineMatch[1])
      if (choice.includes('over')) {
        return { won: totalGoals > line, reason: `Total goals (${totalGoals}) ${totalGoals > line ? '>' : '<='} ${line}` }
      }
      if (choice.includes('under')) {
        return { won: totalGoals < line, reason: `Total goals (${totalGoals}) ${totalGoals < line ? '<' : '>='} ${line}` }
      }
    }
  }

  // Both Teams to Score (BTTS)
  if (marketName.includes('both teams') || marketName.includes('btts')) {
    const bothScored = homeScore > 0 && awayScore > 0
    if (choice === 'yes') {
      return { won: bothScored, reason: `Both teams ${bothScored ? 'scored' : 'did not score'}` }
    }
    if (choice === 'no') {
      return { won: !bothScored, reason: `Both teams ${!bothScored ? 'did not score' : 'scored'}` }
    }
  }

  // Double Chance
  if (marketName.includes('double chance')) {
    if (choice === '1x' || choice === 'home_or_draw') {
      return { won: homeScore >= awayScore, reason: `Home or draw: ${homeScore >= awayScore ? 'won' : 'lost'}` }
    }
    if (choice === '12' || choice === 'home_or_away') {
      return { won: homeScore !== awayScore, reason: `No draw: ${homeScore !== awayScore ? 'won' : 'lost'}` }
    }
    if (choice === 'x2' || choice === 'draw_or_away') {
      return { won: awayScore >= homeScore, reason: `Away or draw: ${awayScore >= homeScore ? 'won' : 'lost'}` }
    }
  }

  // Exact Score
  if (marketName.includes('exact score') || marketName.includes('correct score')) {
    const scoreMatch = bet.choice_label.match(/(\d+)\s*[-:]\s*(\d+)/)
    if (scoreMatch) {
      const predictedHome = parseInt(scoreMatch[1])
      const predictedAway = parseInt(scoreMatch[2])
      const won = homeScore === predictedHome && awayScore === predictedAway
      return { won, reason: `Score ${homeScore}-${awayScore} ${won ? 'matches' : 'does not match'} ${predictedHome}-${predictedAway}` }
    }
  }

  // Total Goals (Exact)
  if (marketName.includes('total goals') || marketName.includes('match goals')) {
    const goalsMatch = bet.choice_label.match(/(\d+)/)
    if (goalsMatch) {
      const predictedGoals = parseInt(goalsMatch[1])
      // Check for range (e.g., "2-3 goals")
      const rangeMatch = bet.choice_label.match(/(\d+)\s*[-to]\s*(\d+)/)
      if (rangeMatch) {
        const min = parseInt(rangeMatch[1])
        const max = parseInt(rangeMatch[2])
        return { won: totalGoals >= min && totalGoals <= max, reason: `Total goals (${totalGoals}) ${totalGoals >= min && totalGoals <= max ? 'in' : 'not in'} range ${min}-${max}` }
      }
      // Exact number
      if (choice.includes('+')) {
        return { won: totalGoals >= predictedGoals, reason: `Total goals (${totalGoals}) ${totalGoals >= predictedGoals ? '>=' : '<'} ${predictedGoals}` }
      }
      return { won: totalGoals === predictedGoals, reason: `Total goals (${totalGoals}) ${totalGoals === predictedGoals ? '=' : '!='} ${predictedGoals}` }
    }
  }

  // Home/Away Team Goals
  if (marketName.includes('home team goals') || marketName.includes('home goals')) {
    const lineMatch = bet.choice_label.match(/(\d+\.?\d*)/)
    if (lineMatch) {
      const line = parseFloat(lineMatch[1])
      if (choice.includes('over')) {
        return { won: homeScore > line, reason: `Home goals (${homeScore}) ${homeScore > line ? '>' : '<='} ${line}` }
      }
      if (choice.includes('under')) {
        return { won: homeScore < line, reason: `Home goals (${homeScore}) ${homeScore < line ? '<' : '>='} ${line}` }
      }
    }
  }

  if (marketName.includes('away team goals') || marketName.includes('away goals')) {
    const lineMatch = bet.choice_label.match(/(\d+\.?\d*)/)
    if (lineMatch) {
      const line = parseFloat(lineMatch[1])
      if (choice.includes('over')) {
        return { won: awayScore > line, reason: `Away goals (${awayScore}) ${awayScore > line ? '>' : '<='} ${line}` }
      }
      if (choice.includes('under')) {
        return { won: awayScore < line, reason: `Away goals (${awayScore}) ${awayScore < line ? '<' : '>='} ${line}` }
      }
    }
  }

  // Clean Sheet
  if (marketName.includes('clean sheet')) {
    if (marketName.includes('home')) {
      const homeCleanSheet = awayScore === 0
      if (choice === 'yes') {
        return { won: homeCleanSheet, reason: `Home clean sheet: ${homeCleanSheet ? 'yes' : 'no'}` }
      }
      if (choice === 'no') {
        return { won: !homeCleanSheet, reason: `Home clean sheet: ${!homeCleanSheet ? 'no' : 'yes'}` }
      }
    }
    if (marketName.includes('away')) {
      const awayCleanSheet = homeScore === 0
      if (choice === 'yes') {
        return { won: awayCleanSheet, reason: `Away clean sheet: ${awayCleanSheet ? 'yes' : 'no'}` }
      }
      if (choice === 'no') {
        return { won: !awayCleanSheet, reason: `Away clean sheet: ${!awayCleanSheet ? 'no' : 'yes'}` }
      }
    }
  }

  // Cannot settle this market type automatically
  console.log(`[settle-live-bets] Cannot auto-settle market: ${bet.market_name} (${bet.choice})`)
  return null
}

Deno.serve(async (req) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors(req) })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Missing environment configuration' }, 500, req)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    const body = await req.json().catch(() => ({}))
    let gameFilter = {}

    if (body.gameId) {
      gameFilter = { id: body.gameId }
    }

    // Get all live/finished games with their fixtures
    const { data: games, error: gamesError } = await supabase
      .from('live_games')
      .select(`
        id,
        status,
        fixture:fixture_id (
          id,
          api_id,
          goals_home,
          goals_away,
          status
        )
      `)
      .in('status', ['live', 'finished'])
      .match(gameFilter)

    if (gamesError) {
      console.error('[settle-live-bets] Error fetching games:', gamesError)
      return json({ error: 'Failed to fetch games' }, 500, req)
    }

    if (!games || games.length === 0) {
      return json({ success: true, message: 'No games to settle', betsSettled: 0 }, 200, req)
    }

    console.log(`[settle-live-bets] Processing ${games.length} games`)

    let totalBetsSettled = 0
    let totalWinnings = 0

    for (const game of games) {
      const fixture = game.fixture as any
      if (!fixture || fixture.goals_home === null || fixture.goals_away === null) {
        continue
      }

      // Get match events for more complex settlements
      const { data: events } = await supabase
        .from('live_match_events')
        .select('*')
        .eq('fixture_id', fixture.api_id)
        .order('minute', { ascending: true })

      const result: MatchResult = {
        homeScore: fixture.goals_home,
        awayScore: fixture.goals_away,
        status: fixture.status,
        events: events || [],
      }

      // Get all confirmed bets for this game
      const { data: entries, error: entriesError } = await supabase
        .from('live_game_entries')
        .select('id')
        .eq('live_game_id', game.id)

      if (entriesError || !entries) continue

      const entryIds = entries.map((e: any) => e.id)

      const { data: bets, error: betsError } = await supabase
        .from('live_game_bets')
        .select('*')
        .in('entry_id', entryIds)
        .eq('status', 'confirmed')

      if (betsError || !bets || bets.length === 0) continue

      console.log(`[settle-live-bets] Found ${bets.length} confirmed bets for game ${game.id}`)

      // Settle each bet
      for (const bet of bets) {
        const settlement = settleBet(bet as Bet, result)

        if (settlement === null) {
          // Cannot settle yet or unsupported market
          continue
        }

        const gain = settlement.won ? Math.round(bet.amount * bet.odds) : 0

        // Update bet status
        const { error: updateError } = await supabase
          .from('live_game_bets')
          .update({
            status: settlement.won ? 'won' : 'lost',
            gain: gain,
            resolved_at: new Date().toISOString(),
          })
          .eq('id', bet.id)

        if (updateError) {
          console.error(`[settle-live-bets] Error updating bet ${bet.id}:`, updateError)
          continue
        }

        // If won, credit the winnings
        if (settlement.won && gain > 0) {
          const { error: creditError } = await supabase
            .from('live_game_entries')
            .update({
              balance: supabase.rpc('increment', { x: gain }),
              total_gains: supabase.rpc('increment', { x: gain }),
            })
            .eq('id', bet.entry_id)

          // Alternative: use raw SQL increment
          if (creditError) {
            await supabase.rpc('credit_bet_winnings', {
              p_entry_id: bet.entry_id,
              p_amount: gain,
            })
          }

          totalWinnings += gain
        }

        totalBetsSettled++
        console.log(`[settle-live-bets] Settled bet ${bet.id}: ${settlement.won ? 'WON' : 'LOST'} - ${settlement.reason}`)
      }

      // Update game status to finished if fixture is finished
      const finishedStatuses = ['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO']
      if (finishedStatuses.includes(fixture.status) && game.status !== 'finished') {
        await supabase
          .from('live_games')
          .update({ status: 'finished' })
          .eq('id', game.id)
      }
    }

    return json({
      success: true,
      gamesProcessed: games.length,
      betsSettled: totalBetsSettled,
      totalWinnings,
    }, 200, req)

  } catch (e) {
    console.error('[settle-live-bets] Error:', e)
    return json({ error: (e as Error).message }, 500, req)
  }
})
