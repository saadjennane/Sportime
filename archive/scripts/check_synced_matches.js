// Vérifier les matchs synchronisés
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://crypuzduplbzbmvefvzr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyeXB1emR1cGxiemJtdmVmdnpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MjA1NjgsImV4cCI6MjA3NTM5NjU2OH0.jsUTKfIjsLF2wlbBPeJDlFPj2ICozE6VaqYA7egKrsQ'
)

async function checkSyncedMatches() {
  console.log('🔍 Vérification des matchs synchronisés...\n')

  // Récupérer les matchs avec status FT (Finished)
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
      away_team:fb_teams!fb_fixtures_away_team_id_fkey(name),
      odds:fb_odds!odds_fixture_id_fkey(home_win, draw, away_win, bookmaker_name)
    `)
    .eq('status', 'FT')
    .order('date', { ascending: false })
    .limit(10)

  if (error) {
    console.error('❌ Erreur:', error)
    return
  }

  console.log(`✅ ${matches.length} matchs terminés trouvés\n`)
  console.log('═══════════════════════════════════════════════════════════════\n')

  for (const match of matches) {
    console.log(`📅 ${new Date(match.date).toLocaleString('fr-FR')}`)
    console.log(`🏆 ${match.league?.name || 'Unknown'}`)
    console.log(`🏠 ${match.home_team?.name || 'Unknown'} ${match.goals_home ?? '-'}`)
    console.log(`✈️  ${match.away_team?.name || 'Unknown'} ${match.goals_away ?? '-'}`)
    console.log(`📊 Status: ${match.status}`)

    if (match.odds && match.odds.length > 0) {
      const odds = match.odds[0]
      console.log(`💰 Cotes (${odds.bookmaker_name}): ${odds.home_win} - ${odds.draw} - ${odds.away_win}`)
    } else {
      console.log(`💰 Cotes: ❌ Aucune`)
    }

    console.log('─────────────────────────────────────────────────────────────\n')
  }
}

checkSyncedMatches()
