// Nettoyer les données de test et restaurer les vraies données
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://crypuzduplbzbmvefvzr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyeXB1emR1cGxiemJtdmVmdnpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTgyMDU2OCwiZXhwIjoyMDc1Mzk2NTY4fQ.KAqS9RRFHu0co0qiqVN5fz9YFscbopmPDvam5ySLem8'
)

async function cleanupTestData() {
  console.log('🧹 Nettoyage des données de test...\n')

  // 1. Supprimer toutes les cotes de test
  console.log('📊 Suppression des cotes de test...')
  const { error: oddsError, count: oddsCount } = await supabase
    .from('fb_odds')
    .delete()
    .eq('bookmaker_name', 'Bet365')

  if (oddsError) {
    console.error('❌ Erreur lors de la suppression des cotes:', oddsError)
  } else {
    console.log(`✅ ${oddsCount ?? 0} cotes de test supprimées\n`)
  }

  // 2. Restaurer le match qu'on avait mis en "live"
  console.log('⚽ Restauration du match test (Espanyol vs Sevilla)...')

  // Trouver le match avec status 1H
  const { data: liveMatches } = await supabase
    .from('fb_fixtures')
    .select('id, status, date')
    .eq('status', '1H')

  if (liveMatches && liveMatches.length > 0) {
    for (const match of liveMatches) {
      console.log(`   Restauration du match ${match.id}...`)

      const { error: updateError } = await supabase
        .from('fb_fixtures')
        .update({
          status: 'NS',
          goals_home: null,
          goals_away: null
        })
        .eq('id', match.id)

      if (updateError) {
        console.error(`   ❌ Erreur:`, updateError)
      } else {
        console.log(`   ✅ Match restauré à l'état NS (Not Started)`)
      }
    }
  } else {
    console.log('   ℹ️  Aucun match en 1H trouvé')
  }

  console.log('\n✅ Nettoyage terminé!')
}

cleanupTestData()
