/**
 * Sync Live Scores Edge Function
 *
 * Met à jour les scores et statuts des matchs en direct depuis l'API-Football.
 * Deux modes de fonctionnement:
 *   - live: Sync des matchs en cours (toutes les 30 secondes via cron)
 *   - daily_correction: Correction quotidienne des matchs manqués + matchs bloqués
 *
 * Déclenchement:
 * - pg_cron (toutes les minutes pour live, 1x/jour pour correction)
 * - Invocation manuelle depuis le panneau admin
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

// Statuts considérés comme "match terminé"
const FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'AWD', 'WO', 'CANC', 'ABD']

// Statuts considérés comme "match en cours" (pour détecter les matchs bloqués)
const LIVE_STATUSES = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE']

// Délai pour le 2ème appel dans la même invocation (30 secondes)
const SECOND_CALL_DELAY_MS = 30000

// Durée après laquelle un match en cours est considéré comme "bloqué" (4 heures)
const STUCK_THRESHOLD_MS = 4 * 60 * 60 * 1000

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface FixtureUpdate {
  api_id: number
  old_status: string
  new_status: string
  old_score: string
  new_score: string
  home_team: string
  away_team: string
}

/**
 * Récupère tous les matchs en direct depuis l'API-Football
 */
async function fetchLiveFixtures(): Promise<any[]> {
  const url = 'https://v3.football.api-sports.io/fixtures?live=all'

  console.log('[API] Fetching all live fixtures')

  const response = await fetch(url, {
    headers: {
      'x-rapidapi-key': API_FOOTBALL_KEY,
      'x-rapidapi-host': 'v3.football.api-sports.io',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[API] Error fetching live fixtures:', response.status, errorText)
    throw new Error(`API-Football error: ${response.status} - ${response.statusText}`)
  }

  const data = await response.json()

  // Vérifier les erreurs retournées par l'API
  if (data.errors && Object.keys(data.errors).length > 0) {
    console.error('[API] API-Football returned errors:', JSON.stringify(data.errors))
    throw new Error(`API-Football errors: ${JSON.stringify(data.errors)}`)
  }

  console.log(`[API] Received ${data.response?.length || 0} live fixtures`)
  return data.response || []
}

/**
 * Récupère les matchs terminés d'une date donnée depuis l'API-Football
 */
async function fetchFinishedFixturesByDate(date: string): Promise<any[]> {
  // Include FT, AET, PEN statuses
  const url = `https://v3.football.api-sports.io/fixtures?date=${date}&status=FT-AET-PEN`

  console.log(`[API] Fetching finished fixtures for date: ${date}`)

  const response = await fetch(url, {
    headers: {
      'x-rapidapi-key': API_FOOTBALL_KEY,
      'x-rapidapi-host': 'v3.football.api-sports.io',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[API] Error fetching finished fixtures:', response.status, errorText)
    throw new Error(`API-Football error: ${response.status} - ${response.statusText}`)
  }

  const data = await response.json()

  if (data.errors && Object.keys(data.errors).length > 0) {
    console.error('[API] API-Football returned errors:', JSON.stringify(data.errors))
    throw new Error(`API-Football errors: ${JSON.stringify(data.errors)}`)
  }

  console.log(`[API] Received ${data.response?.length || 0} finished fixtures for ${date}`)
  return data.response || []
}

/**
 * Récupère un match spécifique par son ID depuis l'API-Football
 */
async function fetchFixtureById(fixtureId: number): Promise<any | null> {
  const url = `https://v3.football.api-sports.io/fixtures?id=${fixtureId}`

  console.log(`[API] Fetching fixture by ID: ${fixtureId}`)

  const response = await fetch(url, {
    headers: {
      'x-rapidapi-key': API_FOOTBALL_KEY,
      'x-rapidapi-host': 'v3.football.api-sports.io',
    },
  })

  if (!response.ok) {
    console.error(`[API] Error fetching fixture ${fixtureId}:`, response.status)
    return null
  }

  const data = await response.json()

  if (data.errors && Object.keys(data.errors).length > 0) {
    console.error(`[API] API-Football errors for fixture ${fixtureId}:`, data.errors)
    return null
  }

  return data.response?.[0] || null
}

/**
 * Met à jour les fixtures dans la base de données
 */
async function updateFixturesInDB(
  supabase: any,
  apiFixtures: any[]
): Promise<{ updated: number; updates: FixtureUpdate[] }> {
  let updated = 0
  const updates: FixtureUpdate[] = []

  for (const apiFixture of apiFixtures) {
    const fixtureApiId = apiFixture.fixture?.id
    const newStatus = apiFixture.fixture?.status?.short || 'NS'
    const goalsHome = apiFixture.goals?.home
    const goalsAway = apiFixture.goals?.away
    const homeTeamName = apiFixture.teams?.home?.name || 'Unknown'
    const awayTeamName = apiFixture.teams?.away?.name || 'Unknown'

    if (!fixtureApiId) {
      continue
    }

    // Récupérer la fixture existante depuis la DB
    const { data: existingFixture, error: fetchError } = await supabase
      .from('fb_fixtures')
      .select('id, api_id, status, goals_home, goals_away')
      .eq('api_id', fixtureApiId)
      .maybeSingle()

    if (fetchError) {
      console.error(`[DB] Error fetching fixture ${fixtureApiId}:`, fetchError)
      continue
    }

    if (!existingFixture) {
      // La fixture n'existe pas dans notre DB - on l'ignore
      // (elle sera créée par sync-fixture-schedules si c'est une ligue suivie)
      continue
    }

    // Vérifier si quelque chose a changé
    const statusChanged = existingFixture.status !== newStatus
    const scoreChanged =
      existingFixture.goals_home !== goalsHome ||
      existingFixture.goals_away !== goalsAway

    if (statusChanged || scoreChanged) {
      // Mettre à jour la fixture
      const { error: updateError } = await supabase
        .from('fb_fixtures')
        .update({
          status: newStatus,
          goals_home: goalsHome,
          goals_away: goalsAway,
        })
        .eq('api_id', fixtureApiId)

      if (!updateError) {
        const oldScore = `${existingFixture.goals_home ?? '-'}-${existingFixture.goals_away ?? '-'}`
        const newScore = `${goalsHome ?? '-'}-${goalsAway ?? '-'}`

        console.log(
          `[DB] ✓ Updated ${homeTeamName} vs ${awayTeamName}: ` +
          `${existingFixture.status} → ${newStatus}, ${oldScore} → ${newScore}`
        )

        updated++
        updates.push({
          api_id: fixtureApiId,
          old_status: existingFixture.status,
          new_status: newStatus,
          old_score: oldScore,
          new_score: newScore,
          home_team: homeTeamName,
          away_team: awayTeamName,
        })
      } else {
        console.error(`[DB] Error updating fixture ${fixtureApiId}:`, updateError)
      }
    }
  }

  return { updated, updates }
}

/**
 * Mode LIVE: Synchronise les matchs en direct
 * Fait 2 appels espacés de 30 secondes pour atteindre l'intervalle de 30s
 */
async function syncLiveMode(supabase: any): Promise<{
  updated: number
  updates: FixtureUpdate[]
  calls: number
}> {
  let totalUpdated = 0
  const allUpdates: FixtureUpdate[] = []

  // Premier appel
  console.log('[sync-live-scores] First API call')
  const liveFixtures1 = await fetchLiveFixtures()

  if (liveFixtures1.length > 0) {
    const result1 = await updateFixturesInDB(supabase, liveFixtures1)
    totalUpdated += result1.updated
    allUpdates.push(...result1.updates)
  } else {
    console.log('[sync-live-scores] No live fixtures at the moment')
  }

  // Attendre 30 secondes
  console.log('[sync-live-scores] Waiting 30 seconds before second call...')
  await delay(SECOND_CALL_DELAY_MS)

  // Deuxième appel
  console.log('[sync-live-scores] Second API call')
  const liveFixtures2 = await fetchLiveFixtures()

  if (liveFixtures2.length > 0) {
    const result2 = await updateFixturesInDB(supabase, liveFixtures2)
    totalUpdated += result2.updated
    allUpdates.push(...result2.updates)
  } else {
    console.log('[sync-live-scores] No live fixtures at the moment')
  }

  return { updated: totalUpdated, updates: allUpdates, calls: 2 }
}

/**
 * Mode DAILY_CORRECTION: Corrige les matchs manqués de la veille + matchs bloqués
 */
async function syncDailyCorrectionMode(supabase: any): Promise<{
  updated: number
  updates: FixtureUpdate[]
  stuckFixed: number
}> {
  let totalUpdated = 0
  const allUpdates: FixtureUpdate[] = []
  let stuckFixed = 0

  // 1. Calculer la date d'hier
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  console.log(`[sync-live-scores] Daily correction for ${yesterdayStr}`)

  // 2. Récupérer les matchs terminés d'hier
  const finishedFixtures = await fetchFinishedFixturesByDate(yesterdayStr)

  if (finishedFixtures.length > 0) {
    const result = await updateFixturesInDB(supabase, finishedFixtures)
    totalUpdated += result.updated
    allUpdates.push(...result.updates)
  } else {
    console.log('[sync-live-scores] No finished fixtures found for yesterday')
  }

  // 3. NOUVEAU: Trouver les matchs bloqués en statut intermédiaire
  const stuckThreshold = new Date(Date.now() - STUCK_THRESHOLD_MS).toISOString()

  console.log(`[sync-live-scores] Checking for stuck matches (kick_off < ${stuckThreshold})`)

  const { data: stuckFixtures, error: stuckError } = await supabase
    .from('fb_fixtures')
    .select('api_id, status, kick_off')
    .in('status', LIVE_STATUSES)
    .lt('kick_off', stuckThreshold)
    .limit(50) // Limiter pour éviter trop d'appels API

  if (stuckError) {
    console.error('[DB] Error fetching stuck fixtures:', stuckError)
  } else if (stuckFixtures && stuckFixtures.length > 0) {
    console.log(`[sync-live-scores] Found ${stuckFixtures.length} stuck fixtures to check`)

    for (const stuck of stuckFixtures) {
      console.log(`[sync-live-scores] Checking stuck fixture ${stuck.api_id} (status: ${stuck.status}, kick_off: ${stuck.kick_off})`)

      const apiData = await fetchFixtureById(stuck.api_id)

      if (apiData) {
        const result = await updateFixturesInDB(supabase, [apiData])
        if (result.updated > 0) {
          totalUpdated += result.updated
          allUpdates.push(...result.updates)
          stuckFixed++
          console.log(`[sync-live-scores] ✓ Fixed stuck fixture ${stuck.api_id}`)
        }
      }

      // Petit délai entre les appels pour ne pas surcharger l'API
      await delay(100)
    }
  } else {
    console.log('[sync-live-scores] No stuck fixtures found')
  }

  return { updated: totalUpdated, updates: allUpdates, stuckFixed }
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
    // Vérifier que les variables d'environnement sont définies
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !API_FOOTBALL_KEY) {
      throw new Error('Missing required environment variables')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Récupérer le mode depuis les paramètres de la requête
    const { mode = 'live' } = await req.json().catch(() => ({}))

    console.log(`[sync-live-scores] Starting sync (mode: ${mode})`)

    let result: { updated: number; updates: FixtureUpdate[]; calls?: number; stuckFixed?: number }

    if (mode === 'live') {
      // Mode live: sync des matchs en direct (2 appels espacés de 30s)
      result = await syncLiveMode(supabase)
    } else if (mode === 'daily_correction') {
      // Mode correction quotidienne: sync des matchs d'hier + matchs bloqués
      result = await syncDailyCorrectionMode(supabase)
    } else {
      throw new Error(`Unknown mode: ${mode}`)
    }

    console.log(`[sync-live-scores] Sync complete: ${result.updated} fixtures updated`)

    // Logger les mises à jour importantes (matchs terminés)
    const finishedUpdates = result.updates.filter(u =>
      FINISHED_STATUSES.includes(u.new_status)
    )
    if (finishedUpdates.length > 0) {
      console.log('[sync-live-scores] Matches finished:')
      finishedUpdates.forEach(u => {
        console.log(`  ✓ ${u.home_team} ${u.new_score} ${u.away_team} (${u.new_status})`)
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        updated: result.updated,
        api_calls: result.calls || 1,
        stuck_fixed: result.stuckFixed || 0,
        updates: result.updates,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('[sync-live-scores] Fatal error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
