/**
 * Sync Odds Edge Function
 *
 * Synchronise les cotes 1X2 (Match Winner) depuis l'API-Football vers fb_odds.
 * Un trigger existant synchronise automatiquement fb_odds → odds (production).
 *
 * Modes:
 *   - upcoming: Sync des matchs à venir (NS) dans les X prochains jours
 *   - live: Sync des matchs en cours uniquement
 *
 * Variables d'environnement requises:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - API_FOOTBALL_KEY
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const API_FOOTBALL_KEY = Deno.env.get('API_FOOTBALL_KEY')!

// Rate limiting: 10 requêtes par seconde pour API-Sports
const RATE_LIMIT_MS = 120

// Bookmakers prioritaires (IDs API-Football)
// 8 = Bet365, 6 = Bwin, 11 = 1xBet, 3 = Pinnacle
const BOOKMAKER_PRIORITY = [8, 6, 11, 3]

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface OddsResult {
  fixtureApiId: number
  bookmaker: string
  homeWin: number
  draw: number
  awayWin: number
}

/**
 * Récupère les cotes d'un match depuis l'API-Football
 */
async function fetchOddsForFixture(fixtureApiId: number): Promise<OddsResult | null> {
  await delay(RATE_LIMIT_MS)

  const url = `https://v3.football.api-sports.io/odds?fixture=${fixtureApiId}&bet=1`

  if (!API_FOOTBALL_KEY) {
    console.error(`[API] API_FOOTBALL_KEY is not configured!`)
    return null
  }

  const response = await fetch(url, {
    headers: {
      'x-rapidapi-key': API_FOOTBALL_KEY,
      'x-rapidapi-host': 'v3.football.api-sports.io',
    },
  })

  if (!response.ok) {
    console.error(`[API] Error fetching odds for fixture ${fixtureApiId}: ${response.status} ${response.statusText}`)
    return null
  }

  const data = await response.json()

  // Check for API errors
  if (data.errors && Object.keys(data.errors).length > 0) {
    console.error(`[API] API error for fixture ${fixtureApiId}:`, JSON.stringify(data.errors))
    return null
  }

  const fixtureData = data.response?.[0]

  if (!fixtureData?.bookmakers?.length) {
    console.log(`[API] No odds found for fixture ${fixtureApiId} (results: ${data.results || 0})`)
    return null
  }

  // Trouver le bookmaker prioritaire
  const bookmakers = fixtureData.bookmakers
  let selectedBookmaker = null

  for (const priorityId of BOOKMAKER_PRIORITY) {
    selectedBookmaker = bookmakers.find((b: any) => b.id === priorityId)
    if (selectedBookmaker) break
  }

  // Si aucun bookmaker prioritaire, prendre le premier
  if (!selectedBookmaker) {
    selectedBookmaker = bookmakers[0]
  }

  // Trouver le bet "Match Winner" (bet id = 1)
  const matchWinnerBet = selectedBookmaker.bets?.find((b: any) => b.id === 1)

  if (!matchWinnerBet?.values?.length) {
    console.log(`[API] No Match Winner odds for fixture ${fixtureApiId}`)
    return null
  }

  // Extraire les cotes
  let homeWin = 0
  let draw = 0
  let awayWin = 0

  for (const value of matchWinnerBet.values) {
    const label = String(value.value).toLowerCase()
    const odd = parseFloat(value.odd)

    if (label === 'home') homeWin = odd
    else if (label === 'draw') draw = odd
    else if (label === 'away') awayWin = odd
  }

  if (!homeWin || !draw || !awayWin) {
    console.log(`[API] Incomplete odds for fixture ${fixtureApiId}`)
    return null
  }

  return {
    fixtureApiId,
    bookmaker: selectedBookmaker.name,
    homeWin,
    draw,
    awayWin,
  }
}

/**
 * Synchronise les cotes des matchs à venir (statut NS)
 */
async function syncUpcomingOdds(
  supabase: any,
  daysAhead: number
): Promise<{ synced: number; skipped: number; errors: number }> {
  // Calculer la date limite
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + daysAhead)
  const toDate = futureDate.toISOString()

  console.log(`[sync-odds] Fetching fixtures with status NS until ${toDate.split('T')[0]}`)

  // Récupérer tous les matchs avec statut NS (pas encore joués)
  // On ne filtre pas sur la date minimum car certains matchs peuvent avoir des dates passées
  // mais un statut NS (en attente de mise à jour par sync-live-scores)
  const { data: fixtures, error: fixturesError } = await supabase
    .from('fb_fixtures')
    .select('id, api_id, date')
    .eq('status', 'NS')
    .lte('date', toDate)
    .order('date', { ascending: true })
    .limit(100)

  if (fixturesError) {
    console.error('[sync-odds] Error fetching fixtures:', fixturesError)
    throw fixturesError
  }

  console.log(`[sync-odds] Found ${fixtures?.length || 0} upcoming fixtures`)

  let synced = 0
  let skipped = 0
  let errors = 0

  for (const fixture of fixtures || []) {
    if (!fixture.api_id) {
      skipped++
      continue
    }

    // Vérifier si on a déjà des cotes pour ce match (fixture_id = UUID dans fb_odds)
    const { data: existingOdds } = await supabase
      .from('fb_odds')
      .select('id')
      .eq('fixture_id', fixture.id)
      .maybeSingle()

    if (existingOdds) {
      console.log(`[sync-odds] Odds already exist for fixture ${fixture.api_id}, skipping`)
      skipped++
      continue
    }

    // Récupérer les cotes depuis l'API
    try {
      const odds = await fetchOddsForFixture(fixture.api_id)

      if (odds) {
        // Insérer dans fb_odds (fixture_id = UUID de fb_fixtures)
        const { error: insertError } = await supabase
          .from('fb_odds')
          .insert({
            fixture_id: fixture.id,
            bookmaker_name: odds.bookmaker,
            home_win: odds.homeWin,
            draw: odds.draw,
            away_win: odds.awayWin,
            updated_at: new Date().toISOString(),
          })

        if (insertError) {
          console.error(`[sync-odds] Error inserting odds for fixture ${fixture.api_id}:`, insertError)
          errors++
        } else {
          console.log(`[sync-odds] ✓ Synced odds for fixture ${fixture.api_id}: ${odds.homeWin}/${odds.draw}/${odds.awayWin} (${odds.bookmaker})`)
          synced++
        }
      } else {
        skipped++
      }
    } catch (err) {
      console.error(`[sync-odds] Error processing fixture ${fixture.api_id}:`, err)
      errors++
    }
  }

  return { synced, skipped, errors }
}

/**
 * Synchronise les cotes des matchs en cours (live)
 */
async function syncLiveOdds(supabase: any): Promise<{ synced: number; skipped: number; errors: number }> {
  const liveStatuses = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE']

  // Récupérer les matchs en cours
  const { data: fixtures, error: fixturesError } = await supabase
    .from('fb_fixtures')
    .select('id, api_id')
    .in('status', liveStatuses)

  if (fixturesError) {
    console.error('[sync-odds] Error fetching live fixtures:', fixturesError)
    throw fixturesError
  }

  console.log(`[sync-odds] Found ${fixtures?.length || 0} live fixtures`)

  let synced = 0
  let skipped = 0
  let errors = 0

  for (const fixture of fixtures || []) {
    if (!fixture.api_id) {
      skipped++
      continue
    }

    try {
      const odds = await fetchOddsForFixture(fixture.api_id)

      if (odds) {
        // Upsert dans fb_odds (fixture_id = UUID de fb_fixtures)
        const { error: upsertError } = await supabase
          .from('fb_odds')
          .upsert({
            fixture_id: fixture.id,
            bookmaker_name: odds.bookmaker,
            home_win: odds.homeWin,
            draw: odds.draw,
            away_win: odds.awayWin,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'fixture_id,bookmaker_name',
          })

        if (upsertError) {
          console.error(`[sync-odds] Error upserting odds for fixture ${fixture.api_id}:`, upsertError)
          errors++
        } else {
          console.log(`[sync-odds] ✓ Updated live odds for fixture ${fixture.api_id}`)
          synced++
        }
      } else {
        skipped++
      }
    } catch (err) {
      console.error(`[sync-odds] Error processing live fixture ${fixture.api_id}:`, err)
      errors++
    }
  }

  return { synced, skipped, errors }
}

/**
 * Fonction principale
 */
serve(async (req) => {
  // Gestion CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Récupérer les paramètres
    const { mode = 'upcoming', days_ahead = 7 } = await req.json().catch(() => ({}))

    console.log(`[sync-odds] Starting sync (mode: ${mode}, days_ahead: ${days_ahead})`)

    let result: { synced: number; skipped: number; errors: number }

    if (mode === 'upcoming') {
      result = await syncUpcomingOdds(supabase, days_ahead)
    } else if (mode === 'live') {
      result = await syncLiveOdds(supabase)
    } else {
      throw new Error(`Unknown mode: ${mode}`)
    }

    console.log(`[sync-odds] Sync complete: ${result.synced} synced, ${result.skipped} skipped, ${result.errors} errors`)

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        ...result,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('[sync-odds] Fatal error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
