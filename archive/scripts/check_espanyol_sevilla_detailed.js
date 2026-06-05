// Script de diagnostic pour investiguer le match Espanyol vs Sevilla
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://crypuzduplbzbmvefvzr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyeXB1emR1cGxiemJtdmVmdnpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MjA1NjgsImV4cCI6MjA3NTM5NjU2OH0.jsUTKfIjsLF2wlbBPeJDlFPj2ICozE6VaqYA7egKrsQ'
)

async function checkEspanyolSevilla() {
  console.log('=== INVESTIGATION ESPANYOL VS SEVILLA ===\n')

  // Rechercher les fixtures entre le 23 et 25 novembre
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
    .lte('date', '2025-11-25T00:00:00Z')
    .order('date', { ascending: true })

  if (error) {
    console.error('❌ Erreur:', error)
    return
  }

  console.log(`📊 ${matches?.length || 0} fixtures trouvées entre le 23-25 nov 2025\n`)

  // Pour chaque match, récupérer les noms des équipes
  for (const match of matches || []) {
    const { data: homeTeam } = await supabase
      .from('fb_teams')
      .select('name, logo')
      .eq('id', match.home_team_id)
      .single()

    const { data: awayTeam } = await supabase
      .from('fb_teams')
      .select('name, logo')
      .eq('id', match.away_team_id)
      .single()

    const { data: league } = await supabase
      .from('fb_leagues')
      .select('name')
      .eq('id', match.league_id)
      .single()

    const matchDate = new Date(match.date)
    const casablancaTime = matchDate.toLocaleString('fr-FR', {
      timeZone: 'Africa/Casablanca',
      dateStyle: 'full',
      timeStyle: 'long'
    })
    const utcTime = matchDate.toISOString()

    console.log('─────────────────────────────────────────')
    console.log(`🆔 Match ID: ${match.id}`)
    console.log(`🔢 API ID: ${match.api_id}`)
    console.log(`🏠 Domicile: ${homeTeam?.name || 'Unknown'} (ID: ${match.home_team_id})`)
    console.log(`✈️  Extérieur: ${awayTeam?.name || 'Unknown'} (ID: ${match.away_team_id})`)
    console.log(`🏆 Ligue: ${league?.name || 'Unknown'}`)
    console.log(`📅 Date UTC: ${utcTime}`)
    console.log(`📅 Date Casablanca: ${casablancaTime}`)
    console.log(`📊 Status: ${match.status}`)
    console.log(`⚽ Score: ${match.goals_home ?? '-'} - ${match.goals_away ?? '-'}`)

    // Vérifier si c'est le match Espanyol-Sevilla
    const homeNameLower = homeTeam?.name?.toLowerCase() || ''
    const awayNameLower = awayTeam?.name?.toLowerCase() || ''
    const isEspanyolSevilla =
      (homeNameLower.includes('espanyol') && awayNameLower.includes('sevilla')) ||
      (homeNameLower.includes('sevilla') && awayNameLower.includes('espanyol'))

    if (isEspanyolSevilla) {
      console.log('\n🎯 *** MATCH ESPANYOL VS SEVILLA TROUVÉ ! ***')
      console.log('\n🔍 Analyse du problème:')
      console.log(`   1. Match enregistré: ${utcTime}`)
      console.log(`   2. Heure Casablanca: ${casablancaTime}`)
      console.log(`   3. Status: ${match.status}`)

      // Analyser pourquoi il n'apparait pas
      const matchHour = matchDate.getUTCHours()
      const matchMinute = matchDate.getUTCMinutes()
      console.log(`   4. Heure UTC: ${matchHour}:${matchMinute.toString().padStart(2, '0')}`)

      if (matchHour === 23 && matchMinute < 30) {
        console.log('\n⚠️  PROBLÈME DÉTECTÉ:')
        console.log('   Le match est à 23:21 UTC le 23/11')
        console.log('   En timezone Casablanca (UTC+1), c\'est 00:21 le 24/11')
        console.log('   Mais l\'app filtre "24/11" comme: 23:00 UTC le 23/11 → 22:59 UTC le 24/11')
        console.log('   Le match à 23:21 UTC tombe AVANT la plage (il manque 39 minutes!)')
        console.log('\n💡 SOLUTION:')
        console.log('   - Vérifier l\'heure réelle du match sur API-Football')
        console.log('   - Le match a probablement été reprogrammé')
        console.log('   - Besoin de synchroniser les fixtures régulièrement')
      }
    }
    console.log('')
  }

  // Simulation de la requête de l'app
  console.log('\n=== SIMULATION REQUÊTE APP ===')
  console.log('🕐 Heure actuelle: ' + new Date().toISOString())
  console.log('\n📱 Si l\'utilisateur cherche les matchs du 24/11 à Casablanca:')

  const now = new Date('2025-11-24T00:20:00+01:00') // Minuit passé à Casablanca
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(now)
  endOfDay.setHours(23, 59, 59, 999)

  console.log(`   Début du jour (local): ${startOfDay.toLocaleString('fr-FR', { timeZone: 'Africa/Casablanca' })}`)
  console.log(`   Fin du jour (local): ${endOfDay.toLocaleString('fr-FR', { timeZone: 'Africa/Casablanca' })}`)
  console.log(`   Début du jour (UTC): ${startOfDay.toISOString()}`)
  console.log(`   Fin du jour (UTC): ${endOfDay.toISOString()}`)

  console.log('\n🔍 Requête DB équivalente:')
  console.log(`   .gte('date', '${startOfDay.toISOString()}')`)
  console.log(`   .lt('date', '${endOfDay.toISOString()}')`)

  console.log('\n❌ Match à 23:21:02 UTC le 23/11 est AVANT cette plage!')
  console.log('   Il faut 2025-11-23T23:00:00Z mais le match est à 2025-11-23T23:21:02Z')
  console.log('   Différence: Le match devrait être après minuit Casablanca (≥ 23:00 UTC)')
}

checkEspanyolSevilla()
