/**
 * Fetch Live Odds Edge Function
 *
 * Fetches live betting odds from API-Football for a specific fixture.
 * Returns odds organized by market category for the Live Betting Game.
 *
 * Endpoint: POST /functions/v1/fetch-live-odds
 * Body: { fixtureApiId: number }
 */

import 'jsr:@supabase/functions-js'

const API_FOOTBALL_KEY = Deno.env.get('API_FOOTBALL_KEY')

// Market IDs from API-Football organized by category
// Based on actual API response structure for /odds/live endpoint
const MARKET_IDS: Record<string, number[]> = {
  result: [19, 35, 41, 64, 21, 33, 17, 26, 29],  // 1X2 1st Half, To Win 2nd Half, 1X2 50min, HT/FT, 3-Way Handicap, Asian Handicap
  goals: [36, 25, 49, 24, 73, 58, 39, 27, 38, 30, 16, 23, 60], // O/U, Match Goals, O/U 1st Half, Next Goal, Team Goals, Score in Both Halves, BTTS, Final Score
  scorers: [46, 148, 60],         // Goal Scorer, Player Shots, To Score 3+
  cards: [119, 115],              // Total Cards, Player to be Booked
  quick: [18],                    // Goal in Interval
  clean_sheet: [57, 66],          // Away/Home Clean Sheet
  corners: [20, 37, 32, 78, 76, 61, 45, 31], // Match Corners, Total Corners, Asian Corners, Corners 1x2, Race to corner
  extra_time: [2, 1, 11, 6, 9],   // 1X2 ET, O/U ET, Handicap ET
  penalties: [107, 101, 10, 8],   // Shootout Winner, Total Penalties, To Qualify
}

// Preferred bookmakers (in priority order)
const BOOKMAKER_PRIORITY = [8, 6, 11, 3] // Bet365, Bwin, 1xBet, Pinnacle

interface MarketOption {
  label: string
  value: string
  odds: number
}

interface Market {
  id: number
  apiId: number
  name: string
  category: string
  bookmaker: string
  options: MarketOption[]
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

Deno.serve(async (req) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors(req) })
  }

  try {
    const { fixtureApiId } = await req.json()

    if (!fixtureApiId) {
      return json({ error: 'fixtureApiId is required' }, 400, req)
    }

    if (!API_FOOTBALL_KEY) {
      return json({ error: 'API key not configured' }, 500, req)
    }

    // Fetch live odds from API-Football
    const url = `https://v3.football.api-sports.io/odds/live?fixture=${fixtureApiId}`
    const response = await fetch(url, {
      headers: {
        'x-rapidapi-key': API_FOOTBALL_KEY,
        'x-rapidapi-host': 'v3.football.api-sports.io',
      },
    })

    if (!response.ok) {
      console.error(`[fetch-live-odds] API error: ${response.status}`)
      return json({ error: 'Failed to fetch odds from API' }, 502, req)
    }

    const data = await response.json()

    if (data.errors && Object.keys(data.errors).length > 0) {
      console.error('[fetch-live-odds] API errors:', data.errors)
      return json({ error: 'API returned errors', details: data.errors }, 502, req)
    }

    const fixtureData = data.response?.[0]

    if (!fixtureData?.odds?.length) {
      return json({ markets: [], message: 'No live odds available' }, 200, req)
    }

    // Process odds into our market structure
    // API-Football /odds/live returns odds directly in an array, not nested in bookmakers
    const markets: Market[] = []
    let marketIdCounter = 1

    for (const odd of fixtureData.odds) {
      // Each odd has: id, name, values[]
      // values[] contains: { value, odd, handicap, main, suspended }

      if (!odd.id || !odd.values?.length) continue

      // Determine category from market ID
      let category = 'result' // default
      for (const [cat, ids] of Object.entries(MARKET_IDS)) {
        if (ids.includes(odd.id)) {
          category = cat
          break
        }
      }

      // Filter out suspended options and map to our format
      const options: MarketOption[] = odd.values
        .filter((v: any) => !v.suspended && parseFloat(v.odd) > 0)
        .map((v: any) => ({
          label: String(v.value),
          value: String(v.value).toLowerCase().replace(/\s+/g, '_'),
          odds: parseFloat(v.odd) || 0,
          handicap: v.handicap || null,
        }))
        // Limit options to avoid overwhelming UI (keep top 10 by odds)
        .slice(0, 20)

      if (options.length === 0) continue

      markets.push({
        id: marketIdCounter++,
        apiId: odd.id,
        name: odd.name,
        category,
        bookmaker: 'API-Football', // Live odds don't specify bookmaker
        options,
      })
    }

    console.log(`[fetch-live-odds] Returning ${markets.length} markets for fixture ${fixtureApiId}`)

    return json({
      success: true,
      fixtureId: fixtureApiId,
      markets,
      totalMarkets: markets.length,
    }, 200, req)

  } catch (e) {
    console.error('[fetch-live-odds] Error:', e)
    return json({ error: (e as Error).message }, 500, req)
  }
})
