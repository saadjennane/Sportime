// Script pour peupler les données de test (cotes et match live)
import { createClient } from '@supabase/supabase-js'

// Utiliser la clé service_role pour contourner les RLS
const supabase = createClient(
  'https://crypuzduplbzbmvefvzr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyeXB1emR1cGxiemJtdmVmdnpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTgyMDU2OCwiZXhwIjoyMDc1Mzk2NTY4fQ.KAqS9RRFHu0co0qiqVN5fz9YFscbopmPDvam5ySLem8'
)

async function addTestOdds() {
  console.log('📊 Ajout des cotes de test...\n')

  // Récupérer les matchs d'aujourd'hui
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const endOfDay = new Date()
  endOfDay.setHours(23, 59, 59, 999)

  const { data: fixtures, error: fixturesError } = await supabase
    .from('fb_fixtures')
    .select('id, date, status')
    .gte('date', startOfDay.toISOString())
    .lte('date', endOfDay.toISOString())

  if (fixturesError) {
    console.error('❌ Erreur lors de la récupération des matchs:', fixturesError)
    return
  }

  console.log(`✅ ${fixtures.length} matchs trouvés pour aujourd'hui\n`)

  if (fixtures.length === 0) {
    console.log('⚠️ Aucun match aujourd\'hui. Essayons pour les prochains jours...\n')

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 3)

    const { data: upcomingFixtures, error: upcomingError } = await supabase
      .from('fb_fixtures')
      .select('id, date, status')
      .gte('date', new Date().toISOString())
      .lte('date', tomorrow.toISOString())
      .limit(10)

    if (upcomingError) {
      console.error('❌ Erreur:', upcomingError)
      return
    }

    if (!upcomingFixtures || upcomingFixtures.length === 0) {
      console.log('❌ Aucun match trouvé dans les 3 prochains jours')
      return
    }

    console.log(`✅ ${upcomingFixtures.length} matchs à venir trouvés\n`)

    // Ajouter les cotes pour ces matchs
    for (const fixture of upcomingFixtures) {
      const odds = {
        fixture_id: fixture.id,
        bookmaker_name: 'Bet365',
        home_win: parseFloat((1.5 + Math.random() * 3).toFixed(2)),
        draw: parseFloat((2.8 + Math.random() * 0.8).toFixed(2)),
        away_win: parseFloat((1.5 + Math.random() * 3).toFixed(2)),
        updated_at: new Date().toISOString()
      }

      const { error: oddsError } = await supabase
        .from('fb_odds')
        .upsert(odds, { onConflict: 'fixture_id,bookmaker_name' })

      if (oddsError) {
        console.error(`❌ Erreur pour le match ${fixture.id}:`, oddsError)
      } else {
        console.log(`✅ Cotes ajoutées pour le match ${fixture.id}: ${odds.home_win} - ${odds.draw} - ${odds.away_win}`)
      }
    }

    return
  }

  // Ajouter les cotes pour les matchs d'aujourd'hui
  for (const fixture of fixtures) {
    const odds = {
      fixture_id: fixture.id,
      bookmaker_name: 'Bet365',
      home_win: parseFloat((1.5 + Math.random() * 3).toFixed(2)),
      draw: parseFloat((2.8 + Math.random() * 0.8).toFixed(2)),
      away_win: parseFloat((1.5 + Math.random() * 3).toFixed(2)),
      updated_at: new Date().toISOString()
    }

    const { error: oddsError } = await supabase
      .from('fb_odds')
      .upsert(odds, { onConflict: 'fixture_id,bookmaker_name' })

    if (oddsError) {
      console.error(`❌ Erreur pour le match ${fixture.id}:`, oddsError)
    } else {
      console.log(`✅ Cotes ajoutées pour le match ${fixture.id}: ${odds.home_win} - ${odds.draw} - ${odds.away_win}`)
    }
  }
}

async function makeMatchLive() {
  console.log('\n\n⚽ Mise d\'un match en "live" pour tester...\n')

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 3)

  const { data: fixtures, error } = await supabase
    .from('fb_fixtures')
    .select('id, date, status')
    .gte('date', new Date().toISOString())
    .lte('date', tomorrow.toISOString())
    .order('date', { ascending: true })
    .limit(1)

  if (error) {
    console.error('❌ Erreur:', error)
    return
  }

  if (!fixtures || fixtures.length === 0) {
    console.log('❌ Aucun match à venir trouvé')
    return
  }

  const fixtureId = fixtures[0].id
  console.log(`📌 Match sélectionné: ${fixtureId}`)

  // Mettre le match en 1H (première mi-temps) avec un score
  const now = new Date()
  const matchStart = new Date(now.getTime() - 30 * 60 * 1000) // Commencé il y a 30 min

  const { data: updated, error: updateError } = await supabase
    .from('fb_fixtures')
    .update({
      date: matchStart.toISOString(),
      status: '1H',
      goals_home: 1,
      goals_away: 0
    })
    .eq('id', fixtureId)
    .select()

  if (updateError) {
    console.error('❌ Erreur lors de la mise à jour:', updateError)
    return
  }

  console.log('✅ Match mis en "live" avec succès!')
  console.log('   Status: 1H (Première mi-temps)')
  console.log('   Score: 1-0')
  console.log('   Commencé il y a: 30 minutes')
  console.log('\n⚠️ Pour revenir en arrière, utilisez force_match_live_for_testing.sql')
}

async function checkOdds() {
  console.log('\n\n📋 Vérification des cotes...\n')

  const { data: odds, error } = await supabase
    .from('fb_odds')
    .select('*')

  if (error) {
    console.error('❌ Erreur:', error)
    return
  }

  console.log(`✅ Total cotes dans la DB: ${odds.length}`)

  if (odds.length > 0) {
    console.log('\nExemple de cotes:')
    console.table(odds.slice(0, 5))
  }
}

// Exécution
const args = process.argv.slice(2)

if (args.includes('--odds-only')) {
  await addTestOdds()
  await checkOdds()
} else if (args.includes('--live-only')) {
  await makeMatchLive()
} else {
  // Par défaut, ajouter les cotes seulement
  await addTestOdds()
  await checkOdds()
}
