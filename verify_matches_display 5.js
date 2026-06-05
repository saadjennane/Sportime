// Vérifier ce qui sera affiché sur la page Matches
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://crypuzduplbzbmvefvzr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyeXB1emR1cGxiemJtdmVmdnpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MjA1NjgsImV4cCI6MjA3NTM5NjU2OH0.jsUTKfIjsLF2wlbBPeJDlFPj2ICozE6VaqYA7egKrsQ'
)

async function verifyMatchesDisplay() {
  console.log('🔍 Vérification des données qui seront affichées...\n')

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const endOfDay = new Date()
  endOfDay.setHours(23, 59, 59, 999)

  // Requête exacte comme dans useMatchesOfTheDay.ts
  const { data: importedLeagues, error: leaguesError } = await supabase
    .from('fb_leagues')
    .select('id')

  if (leaguesError) {
    console.error('❌ Erreur leagues:', leaguesError)
    return
  }

  const importedLeagueIds = importedLeagues.map(l => l.id)

  const { data: rows, error: dbError } = await supabase
    .from('fb_fixtures')
    .select(`
      id,
      date,
      status,
      goals_home,
      goals_away,
      home_team_id,
      away_team_id,
      league_id,
      league:fb_leagues!fb_fixtures_league_id_fkey (
        id,
        name,
        logo,
        api_league_id,
        season
      ),
      odds:fb_odds!odds_fixture_id_fkey (
        home_win,
        draw,
        away_win,
        bookmaker_name
      )
    `)
    .gte('date', startOfDay.toISOString())
    .lt('date', endOfDay.toISOString())
    .in('league_id', importedLeagueIds)
    .order('date', { ascending: true })

  if (dbError) {
    console.error('❌ Erreur fixtures:', dbError)
    return
  }

  console.log(`✅ ${rows.length} matchs trouvés pour aujourd'hui\n`)

  if (rows.length === 0) {
    console.log('⚠️ Aucun match aujourd\'hui, essayons les 3 prochains jours...\n')

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 3)

    const { data: upcomingRows, error: upcomingError } = await supabase
      .from('fb_fixtures')
      .select(`
        id,
        date,
        status,
        goals_home,
        goals_away,
        home_team_id,
        away_team_id,
        league_id,
        league:fb_leagues!fb_fixtures_league_id_fkey (
          id,
          name,
          logo,
          api_league_id,
          season
        ),
        odds:fb_odds!odds_fixture_id_fkey (
          home_win,
          draw,
          away_win,
          bookmaker_name
        )
      `)
      .gte('date', new Date().toISOString())
      .lte('date', tomorrow.toISOString())
      .in('league_id', importedLeagueIds)
      .order('date', { ascending: true })
      .limit(10)

    if (upcomingError) {
      console.error('❌ Erreur:', upcomingError)
      return
    }

    if (!upcomingRows || upcomingRows.length === 0) {
      console.log('❌ Aucun match trouvé')
      return
    }

    rows.splice(0, rows.length, ...upcomingRows)
    console.log(`✅ ${rows.length} matchs à venir trouvés\n`)
  }

  // Récupérer les infos des équipes
  const teamIds = new Set()
  rows.forEach((r) => {
    if (r.home_team_id) teamIds.add(r.home_team_id)
    if (r.away_team_id) teamIds.add(r.away_team_id)
  })

  const { data: teamsData } = await supabase
    .from('fb_teams')
    .select('id, name, logo_url, api_id')
    .in('id', Array.from(teamIds))

  const teamsMap = new Map()
  ;(teamsData ?? []).forEach((team) => {
    teamsMap.set(team.id, team)
  })

  console.log('═══════════════════════════════════════════════════════════════\n')

  // Afficher chaque match avec toutes ses données
  for (const match of rows) {
    const homeTeam = teamsMap.get(match.home_team_id)
    const awayTeam = teamsMap.get(match.away_team_id)
    const odds = match.odds?.[0]

    console.log(`📅 ${new Date(match.date).toLocaleString('fr-FR')}`)
    console.log(`🆔 Match ID: ${match.id}`)
    console.log(`📊 Status: ${match.status}`)
    console.log(`🏆 League: ${match.league?.name ?? 'Unknown'}`)
    console.log('')
    console.log(`🏠 HOME: ${homeTeam?.name ?? 'Unknown'}`)
    console.log(`   Logo: ${homeTeam?.logo_url ? '✅ ' + homeTeam.logo_url : '❌ Pas de logo'}`)
    console.log(`   Score: ${match.goals_home ?? '-'}`)
    console.log('')
    console.log(`✈️  AWAY: ${awayTeam?.name ?? 'Unknown'}`)
    console.log(`   Logo: ${awayTeam?.logo_url ? '✅ ' + awayTeam.logo_url : '❌ Pas de logo'}`)
    console.log(`   Score: ${match.goals_away ?? '-'}`)
    console.log('')
    if (odds) {
      console.log(`💰 COTES (${odds.bookmaker_name}):`)
      console.log(`   Home: ${odds.home_win}  |  Draw: ${odds.draw}  |  Away: ${odds.away_win}`)
    } else {
      console.log(`💰 COTES: ❌ Aucune cote`)
    }
    console.log('')
    console.log('─────────────────────────────────────────────────────────────')
    console.log('')
  }

  console.log('\n📊 RÉSUMÉ:')
  console.log(`   Total matchs: ${rows.length}`)
  console.log(`   Matchs avec logos: ${rows.filter(m => {
    const home = teamsMap.get(m.home_team_id)
    const away = teamsMap.get(m.away_team_id)
    return home?.logo_url && away?.logo_url
  }).length}`)
  console.log(`   Matchs avec cotes: ${rows.filter(m => m.odds?.length > 0).length}`)
  console.log(`   Matchs avec scores: ${rows.filter(m => m.goals_home !== null && m.goals_away !== null).length}`)
  console.log(`   Matchs "live": ${rows.filter(m => ['1H', 'HT', '2H', 'ET', 'P', 'BT', 'SUSP', 'INT', 'LIVE'].includes(m.status)).length}`)
}

verifyMatchesDisplay()
