// Script pour vérifier la date du match Espanyol vs Sevilla
// À la fois dans la DB et sur l'API-Football

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://crypuzduplbzbmvefvzr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyeXB1emR1cGxiemJtdmVmdnpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MjA1NjgsImV4cCI6MjA3NTM5NjU2OH0.jsUTKfIjsLF2wlbBPeJDlFPj2ICozE6VaqYA7egKrsQ'
)

// REMPLACEZ PAR VOTRE CLÉ API-FOOTBALL
const API_FOOTBALL_KEY = process.env.API_SPORTS_KEY || 'VOTRE_CLE_ICI'

async function investigate() {
  console.log('=== INVESTIGATION ESPANYOL VS SEVILLA ===\n')

  // 1. Chercher le match dans la DB
  console.log('📊 1. Recherche dans la base de données Supabase...\n')

  const { data: matches, error } = await supabase
    .from('fb_fixtures')
    .select(`
      id,
      api_id,
      date,
      status,
      home_team_id,
      away_team_id,
      goals_home,
      goals_away,
      league_id
    `)
    .gte('date', '2025-11-23T00:00:00Z')
    .lte('date', '2025-11-25T23:59:59Z')
    .order('date', { ascending: true })

  if (error) {
    console.error('❌ Erreur DB:', error)
    return
  }

  let espanyolSevillaMatch = null
  let espanyolSevillaApiId = null

  // Trouver le match Espanyol vs Sevilla
  for (const match of matches || []) {
    const { data: homeTeam } = await supabase
      .from('fb_teams')
      .select('name, api_team_id')
      .eq('id', match.home_team_id)
      .single()

    const { data: awayTeam } = await supabase
      .from('fb_teams')
      .select('name, api_team_id')
      .eq('id', match.away_team_id)
      .single()

    const homeNameLower = homeTeam?.name?.toLowerCase() || ''
    const awayNameLower = awayTeam?.name?.toLowerCase() || ''
    const isEspanyolSevilla =
      (homeNameLower.includes('espanyol') && awayNameLower.includes('sevilla')) ||
      (homeNameLower.includes('sevilla') && awayNameLower.includes('espanyol'))

    if (isEspanyolSevilla) {
      espanyolSevillaMatch = {
        ...match,
        homeName: homeTeam?.name,
        awayName: awayTeam?.name,
        homeApiId: homeTeam?.api_team_id,
        awayApiId: awayTeam?.api_team_id
      }
      espanyolSevillaApiId = match.api_id

      console.log('✅ Match trouvé dans la DB:')
      console.log(`   ${homeTeam?.name} vs ${awayTeam?.name}`)
      console.log(`   API ID: ${match.api_id}`)
      console.log(`   Date DB: ${match.date}`)
      console.log(`   Status: ${match.status}`)
      console.log(`   Home Team API ID: ${homeTeam?.api_team_id}`)
      console.log(`   Away Team API ID: ${awayTeam?.api_team_id}`)
      console.log('')
      break
    }
  }

  if (!espanyolSevillaMatch) {
    console.log('❌ Match Espanyol vs Sevilla non trouvé dans la DB\n')
    return
  }

  // 2. Vérifier sur l'API-Football
  console.log('🌐 2. Vérification sur API-Football...\n')

  // Requête 1: Par fixture ID directement
  console.log(`Requête par fixture ID (${espanyolSevillaApiId})...`)
  const fixtureUrl = `https://v3.football.api-sports.io/fixtures?id=${espanyolSevillaApiId}`

  try {
    const response = await fetch(fixtureUrl, {
      headers: {
        'x-apisports-key': API_FOOTBALL_KEY
      }
    })

    const data = await response.json()

    if (data.response && data.response.length > 0) {
      const apiFixture = data.response[0]
      const apiDate = apiFixture.fixture.date
      const apiStatus = apiFixture.fixture.status.short
      const apiHomeTeam = apiFixture.teams.home.name
      const apiAwayTeam = apiFixture.teams.away.name

      console.log('\n✅ Match trouvé sur API-Football:')
      console.log(`   ${apiHomeTeam} vs ${apiAwayTeam}`)
      console.log(`   Date API: ${apiDate}`)
      console.log(`   Status API: ${apiStatus}`)
      console.log(`   Timestamp: ${apiFixture.fixture.timestamp}`)
      console.log(`   Timezone: ${apiFixture.fixture.timezone}`)
      console.log(`   Venue: ${apiFixture.fixture.venue.name}, ${apiFixture.fixture.venue.city}`)
      console.log('')

      // 3. Comparer les dates
      console.log('🔍 3. Comparaison DB vs API:\n')

      const dbDate = new Date(espanyolSevillaMatch.date)
      const apiDateObj = new Date(apiDate)

      console.log(`   Date DB (UTC):  ${espanyolSevillaMatch.date}`)
      console.log(`   Date API (UTC): ${apiDate}`)
      console.log('')

      if (espanyolSevillaMatch.date === apiDate) {
        console.log('✅ Les dates correspondent parfaitement!')
      } else {
        const timeDiff = Math.abs(apiDateObj - dbDate)
        const hoursDiff = timeDiff / (1000 * 60 * 60)
        const minutesDiff = (timeDiff / (1000 * 60)) % 60

        console.log('❌ DIFFÉRENCE DÉTECTÉE!')
        console.log(`   Écart: ${Math.floor(hoursDiff)}h ${Math.floor(minutesDiff)}min`)
        console.log('')
        console.log('💡 SOLUTION:')
        console.log('   La synchronisation devrait détecter ce changement.')
        console.log('   Vérifiez que l\'Edge Function a bien été appelée.')
      }

      // Conversion en heure locale Casablanca
      const dbCasablanca = dbDate.toLocaleString('fr-FR', {
        timeZone: 'Africa/Casablanca',
        dateStyle: 'full',
        timeStyle: 'long'
      })
      const apiCasablanca = apiDateObj.toLocaleString('fr-FR', {
        timeZone: 'Africa/Casablanca',
        dateStyle: 'full',
        timeStyle: 'long'
      })

      console.log('\n📅 Dates en heure locale (Casablanca):')
      console.log(`   DB:  ${dbCasablanca}`)
      console.log(`   API: ${apiCasablanca}`)

      // Vérifier le statut
      console.log('\n📊 Comparaison des statuts:')
      console.log(`   Status DB:  ${espanyolSevillaMatch.status}`)
      console.log(`   Status API: ${apiStatus}`)

      if (espanyolSevillaMatch.status !== apiStatus) {
        console.log('   ⚠️  Le statut a changé!')
      } else {
        console.log('   ✅ Le statut est identique')
      }

    } else {
      console.log('❌ Match non trouvé sur API-Football')
      console.log('Réponse API:', JSON.stringify(data, null, 2))
    }

  } catch (err) {
    console.error('❌ Erreur lors de l\'appel API:', err.message)
    console.log('\n⚠️  Vérifiez que votre clé API_SPORTS_KEY est correcte')
    console.log('   Export avec: export API_SPORTS_KEY=votre-clé')
  }

  // 4. Récupérer la ligue pour vérifier
  console.log('\n📋 4. Informations sur la ligue:\n')
  const { data: league } = await supabase
    .from('fb_leagues')
    .select('*')
    .eq('id', espanyolSevillaMatch.league_id)
    .single()

  if (league) {
    console.log(`   Ligue: ${league.name}`)
    console.log(`   API League ID: ${league.api_league_id}`)
    console.log(`   Saison: ${league.season}`)
  }
}

investigate()
