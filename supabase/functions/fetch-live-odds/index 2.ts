/**
 * Fetch Live Odds Edge Function
 *
 * Fetches live betting odds from API-Football for a specific fixture.
 * Returns all available markets for the Live Game feature.
 *
 * Endpoint: POST /functions/v1/fetch-live-odds
 * Body: { fixtureApiId: number }
 *
 * Returns markets grouped by category for the Live Game betting UI.
 */

import 'jsr:@supabase/functions-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Market IDs we want to fetch for Live Game
// Grouped by category for easy filtering
const MARKET_IDS = {
  result: [59, 48, 72, 19, 35],      // Fulltime, DNB, Double Chance, 1st Half, 2nd Half
  goals: [36, 25, 69, 73, 84, 92],   // O/U, Match Goals, BTTS, Next Goal (1st, 2nd, 3rd)
  scorers: [63, 46],                  // Anytime Scorer, Goal Scorer
  cards: [119, 210],                  // Total Cards, Yellow O/U
  quick: [65, 116, 18, 90, 94],      // Next 10 Min, Action 1 Min, Goal Intervals
  clean_sheet: [66, 57],              // Home/Away Clean Sheet
  extra_time: [2, 1, 11, 6, 9],      // ET markets (knockout only)
  penalties: [107, 101, 10, 8],       // Shootout markets (knockout only)
}

// All market IDs to fetch
const ALL_MARKET_IDS = Object.values(MARKET_IDS).flat()

// Map API bet ID to our category
const CATEGORY_MAP: Record<number, string> = {}
for (const [category, ids] of Object.entries(MARKET_IDS)) {
  for (const id of ids) {
    CATEGORY_MAP[id] = category
  }
}

interface ApiOddsResponse {
  response: Array<{
    fixture: { id: number }
    bookmakers: Array<{
      id: number
      name: string
      bets: Array<{
        id: number
        name: string
        values: Array<{
          value: string
          odd: string
        }>
      }>
    }>
  }>
}

interface Market {
  id: number
  apiId: number
  name: string
  category: string
  bookmaker: string
  options: Array<{
    label: string
    value: string
    odds: number
  }>
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { fixtureApiId } = await req.json()

    if (!fixtureApiId) {
      return new Response(
        JSON.stringify({ error: 'fixtureApiId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const apiKey = Deno.env.get('API_FOOTBALL_KEY')
    if (!apiKey) {
      console.error('[fetch-live-odds] API_FOOTBALL_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[fetch-live-odds] Fetching odds for fixture ${fixtureApiId}`)

    // Fetch live odds from API-Football
    const url = `https://v3.football.api-sports.io/odds/live?fixture=${fixtureApiId}`

    const response = await fetch(url, {
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'v3.football.api-sports.io',
      },
    })

    if (!response.ok) {
      console.error(`[fetch-live-odds] API error: ${response.status}`)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch odds from API' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data: ApiOddsResponse = await response.json()

    if (!data.response || data.response.length === 0) {
      console.log(`[fetch-live-odds] No odds available for fixture ${fixtureApiId}`)
      return new Response(
        JSON.stringify({ markets: [], message: 'No odds available for this match' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract markets from first fixture response
    const fixtureData = data.response[0]
    const bookmakers = fixtureData.bookmakers || []

    // Prefer certain bookmakers: Bet365 (8), Bwin (6), 1xBet (11), Pinnacle (3)
    const PREFERRED_BOOKMAKERS = [8, 6, 11, 3]
    let selectedBookmaker = bookmakers.find(b => PREFERRED_BOOKMAKERS.includes(b.id))
    if (!selectedBookmaker && bookmakers.length > 0) {
      selectedBookmaker = bookmakers[0]
    }

    if (!selectedBookmaker) {
      return new Response(
        JSON.stringify({ markets: [], message: 'No bookmaker data available' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Transform bets to our market format
    const markets: Market[] = []
    let marketIndex = 0

    for (const bet of selectedBookmaker.bets || []) {
      // Only include markets we're interested in
      const category = CATEGORY_MAP[bet.id]
      if (!category) continue

      const options = bet.values.map(v => ({
        label: v.value,
        value: v.value.toLowerCase().replace(/\s+/g, '_'),
        odds: parseFloat(v.odd) || 0,
      })).filter(o => o.odds > 0)

      if (options.length === 0) continue

      markets.push({
        id: marketIndex++,
        apiId: bet.id,
        name: bet.name,
        category,
        bookmaker: selectedBookmaker.name,
        options,
      })
    }

    console.log(`[fetch-live-odds] Found ${markets.length} markets for fixture ${fixtureApiId}`)

    return new Response(
      JSON.stringify({
        markets,
        bookmaker: selectedBookmaker.name,
        fixtureId: fixtureApiId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[fetch-live-odds] Error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
