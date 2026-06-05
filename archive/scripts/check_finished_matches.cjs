/**
 * Script pour vérifier les matchs terminés dans Supabase
 * Usage: node check_finished_matches.cjs
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://crypuzduplbzbmvefvzr.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_ANON_KEY ou VITE_SUPABASE_ANON_KEY non défini');
  console.log('Usage: SUPABASE_ANON_KEY=votre_clé node check_finished_matches.cjs');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'AWARDED', 'W.O', 'CANC', 'ABD', 'POST'];

async function checkFinishedMatches() {
  console.log('🔍 Vérification des matchs terminés dans Supabase...\n');

  // 1. Compter tous les matchs dans fb_fixtures
  const { count: totalCount, error: totalError } = await supabase
    .from('fb_fixtures')
    .select('*', { count: 'exact', head: true });

  if (totalError) {
    console.error('❌ Erreur lors du comptage total:', totalError.message);
  } else {
    console.log(`📊 Total matchs dans fb_fixtures: ${totalCount}`);
  }

  // 2. Vérifier les statuts uniques
  const { data: statusData, error: statusError } = await supabase
    .from('fb_fixtures')
    .select('status')
    .limit(1000);

  if (statusError) {
    console.error('❌ Erreur lors de la récupération des statuts:', statusError.message);
  } else {
    const uniqueStatuses = [...new Set(statusData.map(d => d.status))];
    console.log(`\n📋 Statuts uniques trouvés: ${uniqueStatuses.join(', ') || 'Aucun'}`);

    // Compter par statut
    const statusCounts = {};
    statusData.forEach(d => {
      statusCounts[d.status] = (statusCounts[d.status] || 0) + 1;
    });
    console.log('\n📈 Répartition par statut:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      const isFinished = FINISHED_STATUSES.includes(status);
      console.log(`   ${status}: ${count} ${isFinished ? '✅ (terminé)' : ''}`);
    });
  }

  // 3. Compter les matchs avec statuts "terminés"
  const { count: finishedCount, error: finishedError } = await supabase
    .from('fb_fixtures')
    .select('*', { count: 'exact', head: true })
    .in('status', FINISHED_STATUSES);

  if (finishedError) {
    console.error('❌ Erreur lors du comptage des matchs terminés:', finishedError.message);
  } else {
    console.log(`\n✅ Matchs avec statut terminé (FT, AET, etc.): ${finishedCount}`);
  }

  // 4. Vérifier les matchs des 2 derniers jours
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  twoDaysAgo.setHours(0, 0, 0, 0);

  console.log(`\n📅 Période vérifiée: ${twoDaysAgo.toISOString()} à ${today.toISOString()}`);

  const { data: recentMatches, error: recentError } = await supabase
    .from('fb_fixtures')
    .select(`
      id,
      api_id,
      date,
      status,
      goals_home,
      goals_away,
      home_team_id,
      away_team_id
    `)
    .gte('date', twoDaysAgo.toISOString())
    .lte('date', today.toISOString())
    .in('status', FINISHED_STATUSES)
    .order('date', { ascending: false })
    .limit(10);

  if (recentError) {
    console.error('❌ Erreur lors de la récupération des matchs récents:', recentError.message);
  } else {
    console.log(`\n🏆 Matchs terminés des 2 derniers jours: ${recentMatches?.length || 0}`);

    if (recentMatches && recentMatches.length > 0) {
      console.log('\n📝 Exemples de matchs trouvés:');
      recentMatches.slice(0, 5).forEach((match, i) => {
        console.log(`   ${i + 1}. ID: ${match.api_id || match.id} | ${match.status} | ${match.goals_home}-${match.goals_away} | ${new Date(match.date).toLocaleString()}`);
      });
    } else {
      console.log('\n⚠️  AUCUN MATCH TERMINÉ trouvé dans les 2 derniers jours!');
      console.log('   → C\'est probablement la raison pour laquelle l\'onglet "Finished" est vide.');
    }
  }

  // 5. Vérifier s'il y a des matchs sans date ou avec date future
  const { data: allRecentData, error: allRecentError } = await supabase
    .from('fb_fixtures')
    .select('id, date, status')
    .gte('date', twoDaysAgo.toISOString())
    .lte('date', today.toISOString())
    .limit(20);

  if (!allRecentError && allRecentData) {
    console.log(`\n📆 Tous les matchs des 2 derniers jours (tous statuts): ${allRecentData.length}`);
    if (allRecentData.length > 0) {
      console.log('   Statuts présents:', [...new Set(allRecentData.map(m => m.status))].join(', '));
    }
  }

  // 6. Vérifier les équipes
  const { count: teamsCount } = await supabase
    .from('fb_teams')
    .select('*', { count: 'exact', head: true });

  console.log(`\n👥 Total équipes dans fb_teams: ${teamsCount}`);

  // 7. Vérifier les cotes
  const { count: oddsCount } = await supabase
    .from('fb_odds')
    .select('*', { count: 'exact', head: true });

  console.log(`💰 Total cotes dans fb_odds: ${oddsCount}`);

  console.log('\n✨ Vérification terminée!');
}

checkFinishedMatches().catch(console.error);
