# Guide de Déploiement : Import des Stats Fantasy La Liga

## Vue d'ensemble

Ce guide explique comment déployer et utiliser le nouveau système d'import des stats joueurs via les fixtures API-Football. Ce système permet d'importer TOUS les joueurs de La Liga (~500) avec leurs stats en ~400 appels API au lieu de 500+.

## Architecture

```
API-Football /fixtures/players
         ↓
  player_match_stats (match-by-match)
         ↓ (agrégation SQL)
  player_season_stats (saison complète)
         ↓ (trigger automatique)
  PGS calculé + statut (Star/Key/Wild)
         ↓
  fantasy_league_players
```

## Fichiers Créés/Modifiés

### 1. Migration SQL
**Fichier** : `supabase/migrations/20251120000001_add_aggregate_season_stats.sql`

**Fonction** : `aggregate_player_season_stats(p_league_id, p_season)`
- Agrège `player_match_stats` → `player_season_stats`
- Calcule automatiquement (via trigger) : impact_score, consistency_score, PGS, pgs_category

### 2. Edge Function
**Fichier** : `supabase/functions/sync-player-match-stats/index.ts`

**Fonctionnalité** :
- Récupère tous les matches terminés (status='FT') de la ligue
- Pour chaque match, appelle `/fixtures/players?fixture={id}`
- Insère les stats dans `player_match_stats`
- Agrège automatiquement vers `player_season_stats`

**Paramètres** :
```json
{
  "league_id": "uuid-de-la-league",
  "season": 2025,
  "batch_size": 50
}
```

### 3. Interface Admin
**Fichier** : `apps/admin/src/components/FantasyManualSync.tsx`

**Nouveau bouton** : "Import All Match Stats" (⚡ jaune)
- Demande la saison (défaut: 2025)
- Demande la taille du batch (défaut: 50)
- Affiche la progression dans les logs

---

## Étapes de Déploiement

### Étape 1 : Déployer la Migration SQL

1. Connectez-vous à [Supabase Dashboard](https://supabase.com/dashboard)
2. Sélectionnez votre projet Sportime
3. Allez dans **SQL Editor**
4. Cliquez sur **New Query**
5. Copiez-collez le contenu de `supabase/migrations/20251120000001_add_aggregate_season_stats.sql`
6. Cliquez sur **Run** (en bas à droite)
7. Vérifiez le message de succès : "Fantasy season stats aggregation function created successfully!"

**Vérification** :
```sql
-- Test de la fonction
SELECT * FROM aggregate_player_season_stats(
  'league-uuid-here'::UUID,
  2025
);
```

---

### Étape 2 : Déployer l'Edge Function

#### Option A : Via Dashboard (Recommandé)

1. Dans Supabase Dashboard, allez dans **Edge Functions**
2. Cliquez sur **Create Function**
3. Nom : `sync-player-match-stats`
4. Copiez-collez le contenu de `supabase/functions/sync-player-match-stats/index.ts`
5. Cliquez sur **Deploy**

#### Option B : Via CLI

```bash
# Installer Supabase CLI (si pas déjà fait)
npm install -g supabase

# Se connecter
supabase login

# Lier le projet
supabase link --project-ref crypuzduplbzbmvefvzr

# Déployer la fonction
supabase functions deploy sync-player-match-stats
```

**Configuration des Secrets** :

L'Edge Function nécessite la clé API-Football. Si pas déjà configurée :

```bash
# Via CLI
supabase secrets set API_SPORTS_KEY=votre_cle_api_football_ici

# Ou via Dashboard > Project Settings > Edge Functions > Secrets
```

**Vérification** :
```bash
curl -X POST \
  https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/sync-player-match-stats \
  -H "Authorization: Bearer VOTRE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"league_id":"test","season":2025}'
```

---

### Étape 3 : Déployer l'Admin UI

Les modifications dans `FantasyManualSync.tsx` sont déjà dans le code. Il suffit de rebuild et déployer l'admin app :

```bash
# Si déployé sur Vercel (automatique via git push)
git add .
git commit -m "feat(fantasy): add Import All Match Stats functionality

- Add aggregate_player_season_stats SQL function
- Add sync-player-match-stats Edge Function
- Add Import All Match Stats button in admin UI
- Import all players via fixtures/players endpoint (400 calls vs 500+)
- Auto-aggregate to player_season_stats with PGS calculation"

git push origin Sportime-clean-nov5
```

Vercel va automatiquement détecter le push et redéployer l'admin.

---

## Utilisation

### Flow Complet : Premier Import La Liga

1. **Ouvrir l'admin** : https://admin-sportime.vercel.app (ou votre URL)
2. **Aller dans "Fantasy Manual Sync"**
3. **Sélectionner "La Liga"** dans le dropdown
4. **Cliquer sur "Import All Match Stats"** (⚡ bouton jaune)
   - Saison : `2025`
   - Batch size : `50`
5. **Attendre 2-3 heures** (suivre les logs en temps réel)
6. **Résultat attendu** :
   ```json
   {
     "success": true,
     "fixtures_processed": 380,
     "total_fixtures": 380,
     "player_match_stats_inserted": 4200,
     "player_season_stats_created": 520,
     "errors": 0,
     "message": "Successfully synced 380 fixtures with 4200 player stats. Aggregated 520 player season stats."
   }
   ```

7. **Cliquer sur "Sync League Players"**
   - Min appearances : `5`
8. **Résultat attendu** :
   ```json
   {
     "success": true,
     "synced": 280,
     "message": "Successfully synced 280 players for league",
     "breakdown": {
       "star": 45,
       "key": 110,
       "wild": 125
     }
   }
   ```

---

## Vérification des Données

### SQL Queries de Vérification

```sql
-- 1. Vérifier les fixtures de La Liga
SELECT COUNT(*), status
FROM fixtures
WHERE league_id = (SELECT id FROM leagues WHERE name = 'La Liga')
GROUP BY status;
-- Attendu: ~380 fixtures avec status 'FT'

-- 2. Vérifier player_match_stats
SELECT COUNT(*)
FROM player_match_stats pms
JOIN fixtures f ON f.id = pms.fixture_id
WHERE f.league_id = (SELECT id FROM leagues WHERE name = 'La Liga');
-- Attendu: ~4000-4500 entrées

-- 3. Vérifier player_season_stats avec PGS
SELECT
  COUNT(*) AS total_players,
  COUNT(*) FILTER (WHERE pgs IS NOT NULL) AS players_with_pgs,
  COUNT(*) FILTER (WHERE pgs_category = 'star') AS stars,
  COUNT(*) FILTER (WHERE pgs_category = 'key') AS keys,
  COUNT(*) FILTER (WHERE pgs_category = 'wild') AS wilds,
  AVG(pgs) AS avg_pgs,
  MIN(pgs) AS min_pgs,
  MAX(pgs) AS max_pgs
FROM player_season_stats
WHERE league_id = (SELECT id FROM leagues WHERE name = 'La Liga')
  AND season = 2025;
-- Attendu:
-- total_players: ~520
-- players_with_pgs: ~520
-- stars: ~40-60
-- keys: ~100-150
-- wilds: ~300-400

-- 4. Vérifier fantasy_league_players
SELECT
  status,
  COUNT(*) AS count,
  AVG(pgs) AS avg_pgs
FROM fantasy_league_players
WHERE league_id = (SELECT id FROM leagues WHERE name = 'La Liga')
GROUP BY status
ORDER BY status;
-- Attendu:
-- Star: 45 joueurs, avg PGS ~8.2
-- Key: 110 joueurs, avg PGS ~6.8
-- Wild: 125 joueurs, avg PGS ~5.5

-- 5. Top 10 joueurs La Liga par PGS
SELECT
  p.first_name,
  p.last_name,
  pss.pgs,
  pss.pgs_category,
  pss.goals,
  pss.assists,
  pss.appearances,
  pss.rating
FROM player_season_stats pss
JOIN players p ON p.id = pss.player_id
WHERE pss.league_id = (SELECT id FROM leagues WHERE name = 'La Liga')
  AND pss.season = 2025
ORDER BY pss.pgs DESC NULLS LAST
LIMIT 10;
-- Attendu: Messi, Benzema, Vinicius Jr, etc. avec PGS > 8.0
```

---

## Troubleshooting

### Problème 1 : Edge Function retourne 400

**Causes possibles** :
- `league_id` manquant ou invalide
- `API_SPORTS_KEY` non configuré
- Fixtures pas importés

**Solution** :
```sql
-- Vérifier que la league existe
SELECT id, name FROM leagues WHERE name = 'La Liga';

-- Vérifier les fixtures
SELECT COUNT(*) FROM fixtures WHERE league_id = 'league-uuid-here';
```

---

### Problème 2 : Timeout après 2 minutes

**Cause** : Supabase Edge Functions ont un timeout de 120 secondes par défaut.

**Solution** : Réduire le `batch_size` à 20-30 au lieu de 50.

---

### Problème 3 : PGS est NULL

**Cause** : Le trigger `update_player_season_stats()` ne s'est pas exécuté.

**Solution** :
```sql
-- Forcer le recalcul
UPDATE player_season_stats
SET updated_at = NOW()
WHERE league_id = (SELECT id FROM leagues WHERE name = 'La Liga')
  AND season = 2025;
```

---

### Problème 4 : API Rate Limit

**Cause** : API-Football limite à 100-300 requests/minute selon votre plan.

**Solution** : Augmenter le délai entre appels (actuellement 500ms) :

Modifier dans `sync-player-match-stats/index.ts` ligne 244 :
```typescript
// Rate limiting: 1000ms au lieu de 500ms
await new Promise(resolve => setTimeout(resolve, 1000))
```

---

## Coûts API

### Calcul pour La Liga

- **Fixtures** : 380 matches terminés
- **Appels API** : 380 × 1 = **380 requests**
- **Durée** : 380 × 0.5s = **3.2 minutes** (juste les appels API)
- **Durée réelle** : ~2-3h (avec processing et inserts DB)

### Limites API-Football

| Plan | Requests/jour | Requests/minute | Coût |
|------|---------------|-----------------|------|
| Free | 100 | 10 | Gratuit |
| Basic | 5,000 | 300 | 25€/mois |
| Pro | 15,000 | 600 | 50€/mois |

**Recommandation** : Plan Basic minimum pour importer La Liga en une seule fois.

---

## Maintenance

### Import Incrémental (après chaque journée)

Au lieu de réimporter TOUS les matches, importer uniquement les nouveaux :

```typescript
// Modifier la requête dans l'Edge Function pour filtrer par date
.gte('date', '2025-01-01') // Matches après cette date
.lte('date', '2025-01-07') // Matches avant cette date
```

### Automatisation avec Cron

Créer un cron job Supabase pour exécuter tous les lundis :

```sql
-- Via pg_cron extension
SELECT cron.schedule(
  'sync-liga-stats-weekly',
  '0 2 * * 1', -- Tous les lundis à 2h du matin
  $$
    SELECT net.http_post(
      url := 'https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/sync-player-match-stats',
      headers := '{"Authorization": "Bearer SERVICE_ROLE_KEY"}'::jsonb,
      body := '{"league_id":"liga-uuid","season":2025}'::jsonb
    );
  $$
);
```

---

## Prochaines Étapes

### Pour Tester Immédiatement

1. ✅ Déployer migration SQL (5 min)
2. ✅ Déployer Edge Function (10 min)
3. ✅ Push vers Vercel (automatique)
4. ⏳ Lancer l'import La Liga (2-3h)
5. ✅ Créer une Fantasy Game
6. ✅ Tester la sélection de joueurs Star/Key/Wild

### Pour Aller Plus Loin

- Ajouter d'autres ligues (Premier League, Bundesliga, etc.)
- Créer un dashboard de monitoring des imports
- Implémenter un système de queue pour les gros imports
- Ajouter des notifications email quand l'import est terminé

---

## Support

En cas de problème :
1. Vérifier les logs dans Supabase Dashboard > Edge Functions > Logs
2. Vérifier les données avec les SQL queries de vérification
3. Consulter la documentation API-Football : https://www.api-football.com/documentation-v3

---

**Dernière mise à jour** : 2025-11-20
**Auteur** : Claude Code
