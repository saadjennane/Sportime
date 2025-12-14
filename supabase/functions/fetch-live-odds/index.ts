/**
 * Fetch Live Odds Edge Function
 *
 * Fetches live betting odds from API-Football for a specific fixture.
 * Markets are categorized using the market_categories table in the database.
 *
 * Endpoint: POST /functions/v1/fetch-live-odds
 * Body: { fixtureApiId: number }
 */

import 'jsr:@supabase/functions-js'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const API_FOOTBALL_KEY = Deno.env.get('API_FOOTBALL_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

interface MarketOption {
  label: string
  value: string
  odds: number
  handicap?: string | null
}

interface Market {
  id: number
  apiId: number
  name: string
  bookmaker: string
  category: string
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

    // Initialize Supabase client for category lookup
    let categoryMap = new Map<number, string>()
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      const { data: categories } = await supabase
        .from('market_categories')
        .select('market_id, category')
        .eq('is_active', true)

      if (categories) {
        categoryMap = new Map(categories.map((c: any) => [c.market_id, c.category]))
        console.log(`[fetch-live-odds] Loaded ${categories.length} market categories from DB`)
      }
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

    // Process ALL odds without category filtering
    // Categorization is done frontend-side for flexibility
    const markets: Market[] = []
    let marketIdCounter = 1

    for (const odd of fixtureData.odds) {
      if (!odd.id || !odd.values?.length) continue

      // Filter out suspended options and map to our format
      const options: MarketOption[] = odd.values
        .filter((v: any) => !v.suspended && parseFloat(v.odd) > 0)
        .map((v: any) => ({
          label: String(v.value),
          value: String(v.value).toLowerCase().replace(/\s+/g, '_'),
          odds: parseFloat(v.odd) || 0,
          handicap: v.handicap || null,
        }))
        .slice(0, 20)

      if (options.length === 0) continue

      markets.push({
        id: marketIdCounter++,
        apiId: odd.id,
        name: odd.name,
        bookmaker: 'API-Football',
        category: categoryMap.get(odd.id) || 'other',
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
