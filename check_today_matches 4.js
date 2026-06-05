// Vérifier les matchs d'aujourd'hui dans la DB
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://crypuzduplbzbmvefvzr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyeXB1emR1cGxiemJtdmVmdnpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MjA1NjgsImV4cCI6MjA3NTM5NjU2OH0.jsUTKfIjsLF2wlbBPeJDlFPj2ICozE6VaqYA7egKrsQ'
)

async function checkTodayMatches() {
  const now = new Date()
  console.log('🕐 Heure actuelle:', now.toISOString())
  console.log('🕐 Heure locale:', now.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }))
  console.log('')

  // Simuler ce que fait useMatchesOfTheDay
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  console.log('🌍 Timezone détectée:', userTimezone)
  console.log('')

  // Calculer les bornes du jour local
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)

  const endOfDay = new Date(now)
  endOfDay.setHours(23, 59, 59, 999)

  const startISO = startOfDay.toISOString()
  const endISO = endOfDay.toISOString()

  console.log('📅 Bornes de recherche (timezone locale):')
  console.log('   Début:', startISO, '→', startOfDay.toLocaleString('fr-FR'))
  console.log('   Fin:  ', endISO, '→', endOfDay.toLocaleString('fr-FR'))
  console.log('')

  // Récupérer les leagues importées
  const { data: leagues } = await supabase
    .from('fb_leagues')
    .select('id, name')

  const leagueIds = leagues?.map(l => l.id) || []
  console.log(`🏆 ${leagueIds.length} leagues importées`)
  console.log('')

  // Chercher les matchs du jour
  const { data: todayMatches, error } = await supabase
    .from('fb_fixtures')
    .select(`
      id,
      api_id,
      date,
      status,
      goals_home,
      goals_away,
      league:fb_leagues!fb_fixtures_league_id_fkey(name)
    `)
    .gte('date', startISO)
    .lt('date', endISO)
    .in('league_id', leagueIds)
    .order('date', { ascending: true })

  if (error) {
    console.error('❌ Erreur:', error)
    return
  }

  console.log(`📊 Matchs trouvés dans les bornes ${startISO} à ${endISO}:`)
  console.log(`   Total: ${todayMatches?.length || 0} matchs`)
  console.log('')

  if (todayMatches && todayMatches.length > 0) {
    todayMatches.forEach(match => {
      const matchDate = new Date(match.date)
      console.log(`⚽ ${match.league?.name || 'Unknown'}`)
      console.log(`   ID: ${match.id}`)
      console.log(`   Date DB: ${match.date}`)
      console.log(`   Date locale: ${matchDate.toLocaleString('fr-FR')}`)
      console.log(`   Status: ${match.status}`)
      console.log(`   Score: ${match.goals_home ?? '-'} - ${match.goals_away ?? '-'}`)
      console.log('')
    })
  } else {
    console.log('❌ Aucun match trouvé pour aujourd\'hui')
    console.log('')
    console.log('🔍 Recherche dans les 3 prochains jours...')

    const in3Days = new Date(now)
    in3Days.setDate(in3Days.getDate() + 3)

    const { data: upcomingMatches } = await supabase
      .from('fb_fixtures')
      .select(`
        id,
        date,
        status,
        league:fb_leagues!fb_fixtures_league_id_fkey(name)
      `)
      .gte('date', now.toISOString())
      .lte('date', in3Days.toISOString())
      .in('league_id', leagueIds)
      .order('date', { ascending: true })
      .limit(10)

    console.log(`📊 Matchs à venir (prochains 3 jours): ${upcomingMatches?.length || 0}`)
    console.log('')

    upcomingMatches?.forEach(match => {
      const matchDate = new Date(match.date)
      console.log(`⚽ ${match.league?.name || 'Unknown'}`)
      console.log(`   Date DB: ${match.date}`)
      console.log(`   Date locale: ${matchDate.toLocaleString('fr-FR')}`)
      console.log(`   Status: ${match.status}`)
      console.log('')
    })
  }

  // Vérifier aussi avec les bornes UTC (au cas où)
  console.log('🔍 Vérification alternative (UTC):')
  const nowUTC = new Date()
  const startUTC = new Date(Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), nowUTC.getUTCDate(), 0, 0, 0))
  const endUTC = new Date(Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), nowUTC.getUTCDate(), 23, 59, 59))

  console.log('   Début UTC:', startUTC.toISOString())
  console.log('   Fin UTC:', endUTC.toISOString())
  console.log('')

  const { data: utcMatches } = await supabase
    .from('fb_fixtures')
    .select('id, date, status, league:fb_leagues!fb_fixtures_league_id_fkey(name)')
    .gte('date', startUTC.toISOString())
    .lt('date', endUTC.toISOString())
    .in('league_id', leagueIds)

  console.log(`   Matchs trouvés (UTC): ${utcMatches?.length || 0}`)

  if (utcMatches && utcMatches.length > 0) {
    utcMatches.forEach(match => {
      console.log(`   - ${new Date(match.date).toLocaleString('fr-FR')} - ${match.league?.name}`)
    })
  }
}

checkTodayMatches()
