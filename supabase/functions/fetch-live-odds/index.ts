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
const MARKET_IDS: Record<string, number[]> = {
  result: [59, 48, 72, 19, 35],    // Fulltime Result, DNB, Double Chance, 1X2 1st Half, To Win 2nd Half
  goals: [36, 25, 69, 73, 84, 92], // O/U, Match Goals, BTTS, Next Goal (1st, 2nd, 3rd)
  scorers: [63, 46],              // Anytime Goal Scorer, Goal Scorer
  cards: [119, 210],              // Total Cards, Yellow O/U
  quick: [65, 116, 18, 90, 94],   // Next 10 Min, Action 1 Min, Goal in Interval
  clean_sheet: [66, 57],          // Home/Away Clean Sheet
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
    const markets: Market[] = []
    let marketIdCounter = 1

    for (const oddGroup of fixtureData.odds) {
      // Select preferred bookmaker
      let selectedBookmaker = null
      for (const priorityId of BOOKMAKER_PRIORITY) {
        const found = oddGroup.bookmakers?.find((b: any) => b.id === priorityId)
        if (found) {
          selectedBookmaker = found
          break
        }
      }
      if (!selectedBookmaker && oddGroup.bookmakers?.length > 0) {
        selectedBookmaker = oddGroup.bookmakers[0]
      }

      if (!selectedBookmaker?.bets?.length) continue

      for (const bet of selectedBookmaker.bets) {
        // Determine category from bet ID
        let category = 'result' // default
        for (const [cat, ids] of Object.entries(MARKET_IDS)) {
          if (ids.includes(bet.id)) {
            category = cat
            break
          }
        }

        // Map options
        const options: MarketOption[] = bet.values?.map((v: any) => ({
          label: String(v.value),
          value: String(v.value).toLowerCase().replace(/\s+/g, '_'),
          odds: parseFloat(v.odd) || 0,
        })).filter((o: MarketOption) => o.odds > 0) || []

        if (options.length === 0) continue

        markets.push({
          id: marketIdCounter++,
          apiId: bet.id,
          name: bet.name,
          category,
          bookmaker: selectedBookmaker.name,
          options,
        })
      }
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
