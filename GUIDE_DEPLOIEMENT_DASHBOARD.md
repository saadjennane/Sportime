# 📱 Guide de Déploiement via Dashboard Supabase

## Étape 1 : Accéder à Edge Functions

1. Ouvrez votre navigateur
2. Allez sur : https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr
3. Dans le menu de gauche, cliquez sur **"Edge Functions"**
4. Cliquez sur le bouton **"Create a new function"** ou **"Deploy new function"**

## Étape 2 : Créer la fonction

### Configuration de base :

- **Nom de la fonction** : `sync-fixture-schedules`
  ⚠️ IMPORTANT : Utilisez EXACTEMENT ce nom (avec les tirets)

### Code source :

Copiez **TOUT le code** ci-dessous (lignes 1 à 299) et collez-le dans l'éditeur :

```typescript
/**
 * Sync Fixture Schedules Edge Function
 *
 * Met à jour les dates/heures des fixtures depuis l'API-Football pour les matchs à venir.
 * Cela garantit que l'app affiche des heures de coup d'envoi précises même quand les calendriers changent.
 *
 * Déclenchement:
 * - pg_cron (planifié quotidiennement)
 * - Invocation manuelle depuis le panneau admin
 *
 * Variables d'environnement requises:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - API_SPORTS_KEY
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const API_SPORTS_KEY = Deno.env.get('API_SPORTS_KEY')!

// Rate limiting: 10 requêtes par seconde pour API-Sports
const RATE_LIMIT_MS = 100

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface FixtureChange {
  fixture_id: string
  old_date: string
  new_date: string
  home_team: string
  away_team: string
  league: string
}

/**
 * Récupère les fixtures depuis l'API-Football
 */
async function fetchFixturesFromAPI(
  leagueId: number,
  from: string,
  to: string,
  season?: number
): Promise<any[]> {
  await delay(RATE_LIMIT_MS)

  const url = new URL('https://v3.football.api-sports.io/fixtures')
  url.searchParams.set('league', String(leagueId))
  url.searchParams.set('from', from)
  url.searchParams.set('to', to)
  if (season) {
    url.searchParams.set('season', String(season))
  }

  console.log(`[API] Fetching fixtures for league ${leagueId}: ${from} to ${to}`)

  const response = await fetch(url.toString(), {
    headers: {
      'x-apisports-key': API_SPORTS_KEY,
    },
  })

  if (!response.ok) {
    console.error(`[API] Error for league ${leagueId}:`, response.statusText)
    return []
  }

  const data = await response.json()
  console.log(`[API] Received ${data.response?.length || 0} fixtures for league ${leagueId}`)
  return data.response || []
}

/**
 * Fonction principale
 */
serve(async (req) => {
  // Gestion CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Récupérer les paramètres de la requête (optionnel, pour invocation manuelle)
    const { days_ahead = 14, update_mode = 'upcoming' } = await req.json().catch(() => ({}))

    console.log(`[sync-fixture-schedules] Starting sync (mode: ${update_mode}, days_ahead: ${days_ahead})`)

    // Calculer la plage de dates
    const today = new Date()
    const fromDate = today.toISOString().split('T')[0]
    const futureDate = new Date(today)
    futureDate.setDate(futureDate.getDate() + days_ahead)
    const toDate = futureDate.toISOString().split('T')[0]

    console.log(`[sync-fixture-schedules] Date range: ${fromDate} to ${toDate}`)

    // Récupérer toutes les leagues depuis la DB
    const { data: leagues, error: leaguesError } = await supabase
      .from('fb_leagues')
      .select('id, api_league_id, name, season')

    if (leaguesError) {
      throw new Error(`Failed to fetch leagues: ${leaguesError.message}`)
    }

    console.log(`[sync-fixture-schedules] Found ${leagues?.length || 0} leagues`)

    let totalUpdated = 0
    let totalChecked = 0
    let totalInserted = 0
    const fixturesWithChanges: FixtureChange[] = []

    // Pour chaque league, récupérer les fixtures et mettre à jour
    for (const league of leagues || []) {
      if (!league.api_league_id) {
        console.log(`[sync-fixture-schedules] Skipping ${league.name}: no api_league_id`)
        continue
      }

      console.log(`[sync-fixture-schedules] Processing ${league.name} (API ID: ${league.api_league_id})`)

      // Récupérer les fixtures depuis l'API
      const apiFixtures = await fetchFixturesFromAPI(
        league.api_league_id,
        fromDate,
        toDate,
        league.season
      )

      console.log(`[sync-fixture-schedules] Found ${apiFixtures.length} fixtures from API for ${league.name}`)

      // Mettre à jour chaque fixture
      for (const apiFixture of apiFixtures) {
        const fixtureApiId = apiFixture.fixture?.id
        const newDate = apiFixture.fixture?.date
        const newStatus = apiFixture.fixture?.status?.short || 'NS'
        const homeTeamApiId = apiFixture.teams?.home?.id
        const awayTeamApiId = apiFixture.teams?.away?.id

        if (!fixtureApiId || !newDate) {
          console.log(`[sync-fixture-schedules] Skipping invalid fixture (no ID or date)`)
          continue
        }

        totalChecked++

        // Récupérer la fixture existante depuis la DB
        const { data: existingFixture, error: fetchError } = await supabase
          .from('fb_fixtures')
          .select('id, api_id, date, status, home_team_id, away_team_id')
          .eq('api_id', fixtureApiId)
          .maybeSingle()

        if (fetchError) {
          console.error(`[sync-fixture-schedules] Error fetching fixture ${fixtureApiId}:`, fetchError)
          continue
        }

        if (!existingFixture) {
          // La fixture n'existe pas - on doit d'abord trouver/créer les équipes
          console.log(`[sync-fixture-schedules] Fixture ${fixtureApiId} doesn't exist in DB`)

          // Récupérer les IDs des équipes depuis fb_teams
          const { data: homeTeam } = await supabase
            .from('fb_teams')
            .select('id')
            .eq('api_team_id', homeTeamApiId)
            .maybeSingle()

          const { data: awayTeam } = await supabase
            .from('fb_teams')
            .select('id')
            .eq('api_team_id', awayTeamApiId)
            .maybeSingle()

          if (!homeTeam || !awayTeam) {
            console.log(`[sync-fixture-schedules] Skipping fixture ${fixtureApiId}: teams not in DB`)
            continue
          }

          // Insérer la nouvelle fixture
          const { error: insertError } = await supabase
            .from('fb_fixtures')
            .insert({
              api_id: fixtureApiId,
              date: newDate,
              status: newStatus,
              league_id: league.id,
              home_team_id: homeTeam.id,
              away_team_id: awayTeam.id,
              goals_home: apiFixture.goals?.home,
              goals_away: apiFixture.goals?.away,
            })

          if (!insertError) {
            console.log(`[sync-fixture-schedules] ✓ Inserted new fixture ${fixtureApiId}`)
            totalInserted++
          } else {
            console.error(`[sync-fixture-schedules] Error inserting fixture ${fixtureApiId}:`, insertError)
          }
          continue
        }

        // Vérifier si la date ou le statut a changé
        const dateChanged = existingFixture.date !== newDate
        const statusChanged = existingFixture.status !== newStatus

        if (dateChanged || statusChanged) {
          // Mettre à jour la fixture
          const { error: updateError } = await supabase
            .from('fb_fixtures')
            .update({
              date: newDate,
              status: newStatus,
              goals_home: apiFixture.goals?.home,
              goals_away: apiFixture.goals?.away,
            })
            .eq('api_id', fixtureApiId)

          if (!updateError) {
            const changes = []
            if (dateChanged) changes.push(`date ${existingFixture.date} → ${newDate}`)
            if (statusChanged) changes.push(`status ${existingFixture.status} → ${newStatus}`)

            console.log(`[sync-fixture-schedules] ✓ Updated fixture ${fixtureApiId}: ${changes.join(', ')}`)
            totalUpdated++

            // Tracker les changements significatifs de date
            if (dateChanged) {
              fixturesWithChanges.push({
                fixture_id: String(fixtureApiId),
                old_date: existingFixture.date,
                new_date: newDate,
                home_team: apiFixture.teams?.home?.name || 'Unknown',
                away_team: apiFixture.teams?.away?.name || 'Unknown',
                league: league.name,
              })
            }
          } else {
            console.error(`[sync-fixture-schedules] Error updating fixture ${fixtureApiId}:`, updateError)
          }
        }
      }
    }

    console.log(`[sync-fixture-schedules] Sync complete`)
    console.log(`[sync-fixture-schedules] Checked: ${totalChecked}, Inserted: ${totalInserted}, Updated: ${totalUpdated}`)

    // Logger les changements significatifs de calendrier
    if (fixturesWithChanges.length > 0) {
      console.log(`[sync-fixture-schedules] Schedule changes detected:`)
      fixturesWithChanges.forEach(change => {
        console.log(
          `  ${change.league}: ${change.home_team} vs ${change.away_team} - ` +
          `${change.old_date} → ${change.new_date}`
        )
      })

      // Enregistrer dans la table de log
      await supabase
        .from('fixture_sync_log')
        .insert({
          sync_type: update_mode,
          checked: totalChecked,
          updated: totalUpdated,
          schedule_changes: fixturesWithChanges,
        })
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked: totalChecked,
        inserted: totalInserted,
        updated: totalUpdated,
        schedule_changes: fixturesWithChanges,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('[sync-fixture-schedules] Fatal error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

### Actions :

1. Collez tout le code ci-dessus dans l'éditeur
2. Cliquez sur **"Deploy function"** ou **"Save and Deploy"**
3. Attendez que le déploiement se termine (environ 10-30 secondes)

## Étape 3 : Configurer le Secret API

Une fois la fonction déployée :

1. Restez sur la page de la fonction `sync-fixture-schedules`
2. Cherchez l'onglet **"Settings"** ou **"Secrets"**
3. Cliquez sur **"Add a new secret"** ou **"New secret"**
4. Remplissez :
   - **Name (Nom)** : `API_SPORTS_KEY`
   - **Value (Valeur)** : `8487e1b722b62a4e80e07fcb71a99315`
5. Cliquez sur **"Add secret"** ou **"Save"**

⚠️ Note : `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont **automatiquement disponibles**, pas besoin de les ajouter.

## Étape 4 : Tester la fonction

### Test via l'interface Invoke :

1. Cliquez sur l'onglet **"Invoke"** ou **"Test"**
2. Dans le champ **"Body"** ou **"Request body"**, collez :
   ```json
   {
     "days_ahead": 14,
     "update_mode": "manual"
   }
   ```
3. Cliquez sur **"Send request"** ou **"Invoke function"**

### ✅ Résultat attendu :

Vous devriez voir une réponse **200 OK** avec un JSON comme :

```json
{
  "success": true,
  "checked": 123,
  "inserted": 0,
  "updated": 1,
  "schedule_changes": [
    {
      "fixture_id": "1390943",
      "old_date": "2025-11-23T22:21:02.261+00:00",
      "new_date": "2025-11-24T20:00:00+00:00",
      "home_team": "Espanyol",
      "away_team": "Sevilla",
      "league": "La Liga"
    }
  ]
}
```

### 📊 Voir les logs :

1. Cliquez sur l'onglet **"Logs"**
2. Vous verrez des messages comme :
   ```
   [sync-fixture-schedules] Starting sync (mode: manual, days_ahead: 14)
   [sync-fixture-schedules] Date range: 2025-11-24 to 2025-12-08
   [sync-fixture-schedules] Found 1 leagues
   [API] Fetching fixtures for league 140: 2025-11-24 to 2025-12-08
   [sync-fixture-schedules] ✓ Updated fixture 1390943: date 2025-11-23T22:21:02.261+00:00 → 2025-11-24T20:00:00+00:00
   ```

## Étape 5 : Vérification dans la base de données

Dans l'éditeur SQL de Supabase, exécutez :

```sql
-- Vérifier les logs de synchronisation
SELECT * FROM fixture_sync_log ORDER BY created_at DESC LIMIT 5;

-- Vérifier les changements détectés
SELECT * FROM public.get_recent_fixture_changes(7);

-- Vérifier que la date d'Espanyol vs Sevilla a été corrigée
SELECT api_id, date, status
FROM fb_fixtures
WHERE api_id = 1390943;
```

## ✅ Déploiement Terminé !

Si tout fonctionne :
- ✅ La fonction retourne 200 OK
- ✅ Les logs montrent "Updated fixture..."
- ✅ La table `fixture_sync_log` contient une nouvelle ligne
- ✅ Le match Espanyol vs Sevilla a la bonne date

Votre système de synchronisation automatique est maintenant **100% opérationnel** ! 🎉

Les cron jobs vont automatiquement :
- Synchroniser chaque jour à 3h UTC (14 jours)
- Synchroniser toutes les 2h de 6h à 23h UTC (matchs du jour)

---

**En cas de problème** : Vérifiez les logs dans l'onglet "Logs" de la fonction pour voir les messages d'erreur.
