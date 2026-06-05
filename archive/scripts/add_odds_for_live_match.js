// Ajouter des cotes pour le match live
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://crypuzduplbzbmvefvzr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyeXB1emR1cGxiemJtdmVmdnpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTgyMDU2OCwiZXhwIjoyMDc1Mzk2NTY4fQ.KAqS9RRFHu0co0qiqVN5fz9YFscbopmPDvam5ySLem8'
)

async function addOddsForLiveMatch() {
  const odds = {
    fixture_id: 'd4b5b02b-b3d1-4bc0-b318-845c483990a0',
    bookmaker_name: 'Bet365',
    home_win: 2.15,
    draw: 3.20,
    away_win: 3.50,
    updated_at: new Date().toISOString()
  }

  const { error } = await supabase
    .from('fb_odds')
    .upsert(odds, { onConflict: 'fixture_id,bookmaker_name' })

  if (error) {
    console.error('❌ Erreur:', error)
    return
  }

  console.log('✅ Cotes ajoutées pour le match live!')
  console.log(`   Home: ${odds.home_win}  |  Draw: ${odds.draw}  |  Away: ${odds.away_win}`)
}

addOddsForLiveMatch()
