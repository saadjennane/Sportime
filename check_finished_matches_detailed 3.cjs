/**
 * Script détaillé pour diagnostiquer pourquoi les matchs ne s'affichent pas
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://crypuzduplbzbmvefvzr.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'AWARDED', 'W.O', 'CANC', 'ABD', 'POST'];

async function checkDetailed() {
  console.log('🔍 Diagnostic détaillé des matchs terminés...\n');

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  twoDaysAgo.setHours(0, 0, 0, 0);

  // Reproduire exactement la requête du hook useFinishedMatches
  const { data: fixturesData, error: fixturesError } = await supabase
    .from('fb_fixtures')
    .select(`
      id,
      api_id,
      date,
      status,
      goals_home,
      goals_away,
      league_id,
      home_team_id,
      away_team_id,
      league:fb_leagues!fb_fixtures_league_id_fkey(
        id,
        name,
        logo
      ),
      fb_odds!fb_odds_fixture_id_fkey(
        home_win,
        draw,
        away_win,
        bookmaker_name
      )
    `)
    .gte('date', twoDaysAgo.toISOString())
    .lte('date', today.toISOString())
    .in('status', FINISHED_STATUSES)
    .order('date', { ascending: false });

  if (fixturesError) {
    console.error('❌ ERREUR de requête:', fixturesError);
    return;
  }

  console.log(`📊 Matchs trouvés par la requête: ${fixturesData?.length || 0}\n`);

  if (!fixturesData || fixturesData.length === 0) {
    console.log('⚠️ Aucun match trouvé!');
    return;
  }

  // Vérifier chaque match
  for (const fixture of fixturesData) {
    console.log(`\n--- Match ID: ${fixture.api_id || fixture.id} ---`);
    console.log(`   Date: ${fixture.date}`);
    console.log(`   Status: ${fixture.status}`);
    console.log(`   Score: ${fixture.goals_home} - ${fixture.goals_away}`);
    console.log(`   home_team_id: ${fixture.home_team_id}`);
    console.log(`   away_team_id: ${fixture.away_team_id}`);
    console.log(`   league_id: ${fixture.league_id}`);
    console.log(`   League data: ${JSON.stringify(fixture.league)}`);
    console.log(`   Odds data: ${JSON.stringify(fixture.fb_odds)}`);

    // Vérifier si les équipes existent
    if (fixture.home_team_id) {
      const { data: homeTeam, error: homeErr } = await supabase
        .from('fb_teams')
        .select('id, name, logo_url')
        .eq('id', fixture.home_team_id)
        .single();

      if (homeErr || !homeTeam) {
        console.log(`   ⚠️ ÉQUIPE DOMICILE MANQUANTE (id: ${fixture.home_team_id})`);
      } else {
        console.log(`   ✅ Équipe domicile: ${homeTeam.name}`);
      }
    } else {
      console.log(`   ⚠️ home_team_id est NULL`);
    }

    if (fixture.away_team_id) {
      const { data: awayTeam, error: awayErr } = await supabase
        .from('fb_teams')
        .select('id, name, logo_url')
        .eq('id', fixture.away_team_id)
        .single();

      if (awayErr || !awayTeam) {
        console.log(`   ⚠️ ÉQUIPE EXTÉRIEUR MANQUANTE (id: ${fixture.away_team_id})`);
      } else {
        console.log(`   ✅ Équipe extérieur: ${awayTeam.name}`);
      }
    } else {
      console.log(`   ⚠️ away_team_id est NULL`);
    }
  }

  console.log('\n\n✨ Diagnostic terminé!');
}

checkDetailed().catch(console.error);
