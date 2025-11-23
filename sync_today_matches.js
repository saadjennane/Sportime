// Synchroniser les matchs d'aujourd'hui avec l'API-Football pour obtenir les vrais scores et cotes
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://crypuzduplbzbmvefvzr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyeXB1emR1cGxiemJtdmVmdnpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTgyMDU2OCwiZXhwIjoyMDc1Mzk2NTY4fQ.KAqS9RRFHu0co0qiqVN5fz9YFscbopmPDvam5ySLem8'
)

// Appeler l'Edge Function pour l'API-Football
async function callApiFootball(path, params = {}) {
  const { data, error } = await supabase.functions.invoke('api-football-proxy', {
    body: { path, params }
  })

  if (error) {
    console.error('API Error:', error)
    throw error
  }

  return data
}

async function syncTodayMatches() {
  console.log('🔄 Synchronisation des matchs d\'aujourd\'hui...\n')

  const today = new Date().toISOString().split('T')[0] // Format: 2025-11-23

  console.log(`📅 Date: ${today}\n`)

  // 1. Récupérer les IDs de nos leagues importées
  const { data: leagues, error: leaguesError } = await supabase
    .from('fb_leagues')
    .select('id, api_league_id, name')

  if (leaguesError) {
    console.error('❌ Erreur lors de la récupération des leagues:', leaguesError)
    return
  }

  console.log(`✅ ${leagues.length} leagues importées trouvées\n`)

  // 2. Pour chaque league, récupérer les matchs du jour depuis l'API
  let totalMatches = 0
  let updatedMatches = 0
  let errors = 0

  for (const league of leagues) {
    if (!league.api_league_id) {
      console.log(`⚠️  ${league.name}: Pas d'api_league_id, skip`)
      continue
    }

    console.log(`\n🏆 ${league.name} (ID: ${league.api_league_id})`)
    console.log('   Récupération des matchs du jour...')

    try {
      // Appeler l'API-Football pour les fixtures du jour
      const response = await callApiFootball('/fixtures', {
        league: league.api_league_id,
        date: today,
        season: 2025
      })

      const fixtures = response?.response || []
      console.log(`   ✅ ${fixtures.length} matchs trouvés`)

      if (fixtures.length === 0) {
        continue
      }

      totalMatches += fixtures.length

      // 3. Mettre à jour chaque match dans notre DB
      for (const fixture of fixtures) {
        const fixtureApiId = fixture.fixture?.id
        const status = fixture.fixture?.status?.short || 'NS'
        const goalsHome = fixture.goals?.home
        const goalsAway = fixture.goals?.away
        const date = fixture.fixture?.date

        console.log(`   📊 Match ${fixtureApiId}: ${status}`)

        // Trouver le match dans notre DB
        const { data: existingFixtures, error: findError } = await supabase
          .from('fb_fixtures')
          .select('id')
          .eq('api_id', fixtureApiId)
          .eq('league_id', league.id)

        if (findError) {
          console.error(`      ❌ Erreur find:`, findError.message)
          errors++
          continue
        }

        if (!existingFixtures || existingFixtures.length === 0) {
          console.log(`      ⚠️  Match non trouvé dans la DB, skip`)
          continue
        }

        const fixtureId = existingFixtures[0].id

        // Mettre à jour le match
        const { error: updateError } = await supabase
          .from('fb_fixtures')
          .update({
            status: status,
            goals_home: goalsHome,
            goals_away: goalsAway,
            date: date,
            updated_at: new Date().toISOString()
          })
          .eq('id', fixtureId)

        if (updateError) {
          console.error(`      ❌ Erreur update:`, updateError.message)
          errors++
        } else {
          console.log(`      ✅ Mis à jour: ${status} ${goalsHome ?? '-'}-${goalsAway ?? '-'}`)
          updatedMatches++
        }

        // 4. Récupérer les cotes pour ce match
        try {
          console.log(`      💰 Récupération des cotes...`)
          const oddsResponse = await callApiFootball('/odds', {
            fixture: fixtureApiId,
            bookmaker: 1 // Bet365
          })

          const oddsData = oddsResponse?.response || []

          if (oddsData.length > 0 && oddsData[0].bookmakers?.length > 0) {
            const bookmaker = oddsData[0].bookmakers[0]
            const bets = bookmaker.bets || []

            // Trouver le marché "Match Winner"
            const matchWinnerBet = bets.find(b => b.name === 'Match Winner')

            if (matchWinnerBet && matchWinnerBet.values) {
              const homeOdd = matchWinnerBet.values.find(v => v.value === 'Home')?.odd
              const drawOdd = matchWinnerBet.values.find(v => v.value === 'Draw')?.odd
              const awayOdd = matchWinnerBet.values.find(v => v.value === 'Away')?.odd

              if (homeOdd && drawOdd && awayOdd) {
                // Insérer/mettre à jour les cotes
                const { error: oddsError } = await supabase
                  .from('fb_odds')
                  .upsert({
                    fixture_id: fixtureId,
                    bookmaker_name: bookmaker.name,
                    home_win: parseFloat(homeOdd),
                    draw: parseFloat(drawOdd),
                    away_win: parseFloat(awayOdd),
                    updated_at: new Date().toISOString()
                  }, {
                    onConflict: 'fixture_id,bookmaker_name'
                  })

                if (oddsError) {
                  console.error(`      ❌ Erreur cotes:`, oddsError.message)
                } else {
                  console.log(`      ✅ Cotes: ${homeOdd} - ${drawOdd} - ${awayOdd}`)
                }
              }
            } else {
              console.log(`      ⚠️  Pas de cotes "Match Winner" disponibles`)
            }
          } else {
            console.log(`      ⚠️  Pas de cotes disponibles`)
          }
        } catch (oddsError) {
          console.error(`      ❌ Erreur récupération cotes:`, oddsError.message)
        }

        // Petit délai pour ne pas surcharger l'API
        await new Promise(resolve => setTimeout(resolve, 500))
      }

    } catch (error) {
      console.error(`   ❌ Erreur pour ${league.name}:`, error.message)
      errors++
    }
  }

  console.log('\n\n📊 RÉSUMÉ:')
  console.log(`   Total matchs trouvés: ${totalMatches}`)
  console.log(`   Matchs mis à jour: ${updatedMatches}`)
  console.log(`   Erreurs: ${errors}`)
  console.log('\n✅ Synchronisation terminée!')
}

syncTodayMatches()
