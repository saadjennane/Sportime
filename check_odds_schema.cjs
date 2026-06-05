const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://crypuzduplbzbmvefvzr.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('🔍 Vérification du schéma fb_odds...\n');

  // Récupérer quelques lignes de fb_odds pour voir la structure
  const { data: oddsData, error: oddsError } = await supabase
    .from('fb_odds')
    .select('*')
    .limit(3);

  if (oddsError) {
    console.error('❌ Erreur fb_odds:', oddsError);
  } else {
    console.log('📊 Structure fb_odds (colonnes):');
    if (oddsData && oddsData.length > 0) {
      console.log('   Colonnes:', Object.keys(oddsData[0]).join(', '));
      console.log('\n📝 Exemple de données:');
      oddsData.forEach((row, i) => {
        console.log(`   ${i + 1}.`, JSON.stringify(row));
      });
    } else {
      console.log('   Aucune donnée dans fb_odds');
    }
  }

  // Essayer une requête simple sans jointure
  console.log('\n\n🔍 Test requête fb_fixtures SANS jointure odds...\n');

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  twoDaysAgo.setHours(0, 0, 0, 0);

  const { data: fixtures, error: fixError } = await supabase
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
      )
    `)
    .gte('date', twoDaysAgo.toISOString())
    .lte('date', today.toISOString())
    .in('status', ['FT', 'AET', 'PEN'])
    .order('date', { ascending: false })
    .limit(5);

  if (fixError) {
    console.error('❌ Erreur fixtures:', fixError);
  } else {
    console.log(`✅ Requête SANS odds réussie! ${fixtures?.length || 0} matchs trouvés`);
    fixtures?.forEach((f, i) => {
      console.log(`   ${i + 1}. ${f.api_id} | ${f.status} | ${f.goals_home}-${f.goals_away} | League: ${f.league?.name}`);
    });
  }
}

checkSchema().catch(console.error);
