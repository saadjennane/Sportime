// Vérifier s'il y a des matchs du 24/11 dans la DB
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://crypuzduplbzbmvefvzr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyeXB1emR1cGxiemJtdmVmdnpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MjA1NjgsImV4cCI6MjA3NTM5NjU2OH0.jsUTKfIjsLF2wlbBPeJDlFPj2ICozE6VaqYA7egKrsQ'
)

async function checkNov24Matches() {
  console.log('🔍 Recherche des matchs du 24/11/2025...\n')

  // Jour 24/11 en UTC
  const start = '2025-11-24T00:00:00.000Z'
  const end = '2025-11-24T23:59:59.999Z'

  console.log('📅 Recherche entre:')
  console.log('   Début:', start)
  console.log('   Fin:', end)
  console.log('')

  const { data: leagues } = await supabase
    .from('fb_leagues')
    .select('id, name')

  const leagueIds = leagues?.map(l => l.id) || []

  const { data: matches, error } = await supabase
    .from('fb_fixtures')
    .select(`
      id,
      api_id,
      date,
      status,
      goals_home,
      goals_away,
      league:fb_leagues!fb_fixtures_league_id_fkey(name),
      home_team:fb_teams!fb_fixtures_home_team_id_fkey(name),
      away_team:fb_teams!fb_fixtures_away_team_id_fkey(name)
    `)
    .gte('date', start)
    .lte('date', end)
    .in('league_id', leagueIds)
    .order('date', { ascending: true })

  if (error) {
    console.error('❌ Erreur:', error)
    return
  }

  console.log(`📊 Matchs trouvés: ${matches?.length || 0}\n`)

  if (!matches || matches.length === 0) {
    console.log('❌ Aucun match du 24/11 dans la base de données\n')
    console.log('💡 Solution: Il faut synchroniser les matchs depuis l\'API-Football\n')
    console.log('   Exécutez: node sync_today_matches.js')
    return
  }

  matches.forEach(match => {
    const matchDate = new Date(match.date)
    console.log(`⚽ ${match.league?.name || 'Unknown'}`)
    console.log(`   ${match.home_team?.name || 'Home'} vs ${match.away_team?.name || 'Away'}`)
    console.log(`   Date DB: ${match.date}`)
    console.log(`   Date locale (Casablanca): ${matchDate.toLocaleString('fr-FR', { timeZone: 'Africa/Casablanca' })}`)
    console.log(`   Status: ${match.status}`)
    if (match.goals_home !== null && match.goals_away !== null) {
      console.log(`   Score: ${match.goals_home}-${match.goals_away}`)
    }
    console.log('')
  })
}

checkNov24Matches()
