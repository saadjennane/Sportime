// Vérifier les dates des fixtures dans la DB
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://crypuzduplbzbmvefvzr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyeXB1emR1cGxiemJtdmVmdnpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MjA1NjgsImV4cCI6MjA3NTM5NjU2OH0.jsUTKfIjsLF2wlbBPeJDlFPj2ICozE6VaqYA7egKrsQ'
)

async function checkFixturesDates() {
  console.log('🔍 Analyse des dates des fixtures...\n')

  const { data: leagues } = await supabase
    .from('fb_leagues')
    .select('id, name')

  const leagueIds = leagues?.map(l => l.id) || []

  // Compter les fixtures par année
  const { data: allFixtures } = await supabase
    .from('fb_fixtures')
    .select('date')
    .in('league_id', leagueIds)

  if (!allFixtures) {
    console.log('❌ Aucune fixture trouvée')
    return
  }

  console.log(`📊 Total fixtures: ${allFixtures.length}\n`)

  // Grouper par année
  const byYear = {}
  allFixtures.forEach(f => {
    const year = new Date(f.date).getFullYear()
    byYear[year] = (byYear[year] || 0) + 1
  })

  console.log('📅 Répartition par année:')
  Object.keys(byYear).sort().forEach(year => {
    console.log(`   ${year}: ${byYear[year]} matchs`)
  })
  console.log('')

  // Vérifier les matchs de novembre 2024
  const { data: nov2024 } = await supabase
    .from('fb_fixtures')
    .select('id, date, status, league:fb_leagues!fb_fixtures_league_id_fkey(name)')
    .gte('date', '2024-11-20')
    .lte('date', '2024-11-30')
    .in('league_id', leagueIds)
    .order('date')

  console.log(`📅 Matchs de novembre 2024: ${nov2024?.length || 0}`)
  if (nov2024 && nov2024.length > 0) {
    console.log('   Premiers matchs:')
    nov2024.slice(0, 5).forEach(m => {
      console.log(`   - ${new Date(m.date).toLocaleDateString('fr-FR')}: ${m.league?.name} (${m.status})`)
    })
  }
  console.log('')

  // Vérifier les matchs de novembre 2025
  const { data: nov2025 } = await supabase
    .from('fb_fixtures')
    .select('id, date, status, league:fb_leagues!fb_fixtures_league_id_fkey(name)')
    .gte('date', '2025-11-20')
    .lte('date', '2025-11-30')
    .in('league_id', leagueIds)
    .order('date')

  console.log(`📅 Matchs de novembre 2025: ${nov2025?.length || 0}`)
  if (nov2025 && nov2025.length > 0) {
    console.log('   Tous les matchs:')
    nov2025.forEach(m => {
      const matchDate = new Date(m.date)
      console.log(`   - ${matchDate.toLocaleString('fr-FR')}: ${m.league?.name} (${m.status})`)
    })
  }
  console.log('')

  // Vérifier le match le plus récent
  const { data: latestMatch } = await supabase
    .from('fb_fixtures')
    .select('date, status, league:fb_leagues!fb_fixtures_league_id_fkey(name)')
    .in('league_id', leagueIds)
    .order('date', { ascending: false })
    .limit(1)

  if (latestMatch && latestMatch.length > 0) {
    console.log('🆕 Match le plus récent:')
    console.log(`   Date: ${new Date(latestMatch[0].date).toLocaleString('fr-FR')}`)
    console.log(`   League: ${latestMatch[0].league?.name}`)
    console.log(`   Status: ${latestMatch[0].status}`)
  }
}

checkFixturesDates()
