# 🚀 Guide de Déploiement - Système de Progression

## ⚠️ IMPORTANT : Supabase n'est pas configuré localement

Le projet n'a pas de configuration Supabase locale (pas de `.supabase/` ni `config.toml`).

Il y a **2 options** pour déployer :

---

## 📋 OPTION 1 : Déploiement via Dashboard Supabase (RECOMMANDÉ)

Cette méthode est la plus simple et ne nécessite pas de configuration locale.

### Étape 1 : Appliquer les Migrations SQL

1. Ouvrir [Supabase Dashboard](https://supabase.com/dashboard)
2. Sélectionner votre projet Sportime
3. Aller dans **SQL Editor** (menu gauche)
4. Créer un nouveau query

5. **Copier et exécuter les migrations dans l'ordre** :

#### Migration 1/3 : Unified Progression System

Ouvrir le fichier :
```
/Users/sj/Desktop/Sportime/supabase/migrations/20250620000000_unified_progression_system.sql
```

Copier tout le contenu et l'exécuter dans SQL Editor.

#### Migration 2/3 : Activity Tracking

Ouvrir le fichier :
```
/Users/sj/Desktop/Sportime/supabase/migrations/20250620000001_activity_tracking.sql
```

Copier tout le contenu et l'exécuter dans SQL Editor.

#### Migration 3/3 : Real XP Calculation

Ouvrir le fichier :
```
/Users/sj/Desktop/Sportime/supabase/migrations/20250620000002_real_xp_calculation.sql
```

Copier tout le contenu et l'exécuter dans SQL Editor.

### Étape 2 : Vérifier les Tables Créées

Dans SQL Editor, exécuter :

```sql
-- Vérifier que toutes les tables existent
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'levels_config',
  'user_activity_logs',
  'challenge_required_badges',
  'seasons',
  'season_logs'
)
ORDER BY table_name;
```

Vous devriez voir 5 tables.

### Étape 3 : Vérifier les Fonctions SQL

```sql
-- Lister les fonctions créées
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%xp%' OR routine_name LIKE '%badge%'
ORDER BY routine_name;
```

Vous devriez voir :
- `calculate_user_weekly_xp`
- `update_all_weekly_xp`
- `end_of_season_reset`
- `get_user_progression_summary`
- `add_xp_to_user`
- `track_user_activity`
- `track_prediction`
- `track_bet`
- `track_fantasy_game`
- `track_badge_earned`
- `track_game_type`

### Étape 4 : Déployer les Edge Functions

#### 4.1 Edge Function: calculate-weekly-xp

1. Dans Supabase Dashboard → **Edge Functions**
2. Cliquer **Create a new function**
3. Nom : `calculate-weekly-xp`
4. Copier le contenu de :
   ```
   /Users/sj/Desktop/Sportime/supabase/functions/calculate-weekly-xp/index.ts
   ```
5. Coller dans l'éditeur
6. Cliquer **Deploy**

#### 4.2 Edge Function: check-badge-awards

1. Cliquer **Create a new function**
2. Nom : `check-badge-awards`
3. Copier le contenu de :
   ```
   /Users/sj/Desktop/Sportime/supabase/functions/check-badge-awards/index.ts
   ```
4. Coller dans l'éditeur
5. Cliquer **Deploy**

### Étape 5 : Configurer l'Automatisation Hebdomadaire

#### Option A : GitHub Actions (Recommandé)

1. Créer le fichier `.github/workflows/weekly-xp-calculation.yml`

```yaml
name: Weekly XP Calculation

on:
  schedule:
    - cron: '0 0 * * 1' # Tous les lundis à 00:00 UTC
  workflow_dispatch: # Permet exécution manuelle

jobs:
  calculate-xp:
    runs-on: ubuntu-latest
    steps:
      - name: Calculate Weekly XP
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" \
            ${{ secrets.SUPABASE_URL }}/functions/v1/calculate-weekly-xp

      - name: Check Badge Awards
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" \
            ${{ secrets.SUPABASE_URL }}/functions/v1/check-badge-awards
```

2. Ajouter les secrets GitHub :
   - `SUPABASE_URL` : Votre URL Supabase (ex: `https://xxxxx.supabase.co`)
   - `SUPABASE_ANON_KEY` : Votre clé anonyme Supabase

#### Option B : Cron Job externe (si pas GitHub Actions)

Utiliser un service comme [cron-job.org](https://cron-job.org) ou [EasyCron](https://www.easycron.com) :

- **URL 1** : `https://YOUR_PROJECT.supabase.co/functions/v1/calculate-weekly-xp`
- **URL 2** : `https://YOUR_PROJECT.supabase.co/functions/v1/check-badge-awards`
- **Schedule** : Tous les lundis à 00:00 UTC
- **Header** : `Authorization: Bearer YOUR_ANON_KEY`

---

## 📋 OPTION 2 : Configuration Locale Supabase CLI

Si vous préférez configurer Supabase localement :

### Étape 1 : Installer Supabase CLI

```bash
npm install -g supabase
```

### Étape 2 : Lier le Projet

```bash
cd /Users/sj/Desktop/Sportime
npx supabase link --project-ref YOUR_PROJECT_REF
```

Trouver votre `PROJECT_REF` dans Dashboard → Settings → General → Reference ID

### Étape 3 : Appliquer les Migrations

```bash
npx supabase db push
```

### Étape 4 : Déployer les Edge Functions

```bash
npx supabase functions deploy calculate-weekly-xp
npx supabase functions deploy check-badge-awards
```

---

## ✅ VÉRIFICATION POST-DÉPLOIEMENT

### Test 1 : Vérifier les Tables

Dans SQL Editor :

```sql
-- Vérifier les niveaux
SELECT * FROM levels_config ORDER BY level;

-- Vérifier structure user_activity_logs
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'user_activity_logs';
```

### Test 2 : Tester une Fonction

```sql
-- Tester le tracking d'activité
SELECT track_user_activity('USER_ID_EXISTANT');

-- Vérifier que ça a fonctionné
SELECT * FROM user_activity_logs
WHERE user_id = 'USER_ID_EXISTANT'
ORDER BY week_start DESC
LIMIT 1;
```

### Test 3 : Tester Edge Function

Dans votre terminal ou Postman :

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  https://YOUR_PROJECT.supabase.co/functions/v1/calculate-weekly-xp
```

Devrait retourner :
```json
{
  "success": true,
  "usersUpdated": 0,
  "results": []
}
```

---

## 🎯 CRÉER LES PREMIERS BADGES

Une fois les migrations appliquées :

1. Lancer l'app en dev : `npm run dev`
2. Se connecter en tant qu'admin
3. Aller dans **Admin → Progression**
4. Scroll vers le bas → section **Badge Management**
5. Cliquer **+ Create Badge**

### Suggestions de Badges Initiaux :

#### Badge 1 : First Victory 🏆
- **Name** : First Victory
- **Description** : Win your first prediction
- **Icon** : 🏆
- **XP Bonus** : 150
- **Condition Type** : Total Wins
- **Threshold** : 1

#### Badge 2 : Prediction Master 🎯
- **Name** : Prediction Master
- **Description** : Win 10 predictions
- **Icon** : 🎯
- **XP Bonus** : 300
- **Condition Type** : Total Wins
- **Threshold** : 10

#### Badge 3 : Sharp Eye 👁️
- **Name** : Sharp Eye
- **Description** : Maintain 75% accuracy
- **Icon** : 👁️
- **XP Bonus** : 500
- **Condition Type** : Accuracy Threshold
- **Percentage** : 75

#### Badge 4 : High Roller 💰
- **Name** : High Roller
- **Description** : Earn 10,000 coins
- **Icon** : 💰
- **XP Bonus** : 400
- **Condition Type** : Coins Earned
- **Amount** : 10000

#### Badge 5 : Dedicated Player ⭐
- **Name** : Dedicated Player
- **Description** : Play 50 games
- **Icon** : ⭐
- **XP Bonus** : 600
- **Condition Type** : Games Played
- **Threshold** : 50

---

## 🧪 TESTS FINAUX

### Test Frontend

1. Ouvrir l'app
2. Aller sur **Profile**
3. Vérifier que la barre XP s'affiche
4. Vérifier que la section Badges s'affiche

### Test Tracking

Ouvrir DevTools Console :

```javascript
// Devrait logger les appels à track_user_activity
// Toutes les 5 minutes
```

Vérifier dans Supabase → Table Editor → `users` :
- La colonne `last_active_date` doit se mettre à jour

### Test Admin

1. Aller sur **Admin → Progression**
2. Créer un badge test
3. Vérifier qu'il apparaît dans la liste
4. Aller sur **Profile** → vérifier qu'il apparaît dans les badges locked

---

## 🎊 FÉLICITATIONS !

Le système de progression est maintenant déployé ! 🚀

**Prochaines actions** :
- ✅ Les utilisateurs verront leur progression XP en temps réel
- ✅ Le tracking d'activité fonctionne automatiquement
- ✅ Les badges peuvent être créés dynamiquement
- ✅ Le calcul XP hebdomadaire s'exécutera chaque lundi

**Monitoring** :
- Vérifier les logs des Edge Functions dans Dashboard
- Vérifier que `user_activity_logs` se remplit chaque semaine
- Vérifier que les badges sont attribués automatiquement

---

## ❓ TROUBLESHOOTING

### Problème : Migration échoue

**Solution** : Vérifier qu'il n'y a pas de conflit avec les anciennes migrations.
Les anciennes migrations ont été renommées avec préfixe `_OLD_`.

### Problème : Edge Function ne se déploie pas

**Solution** : Vérifier que vous utilisez Deno.land imports (pas npm) dans les Edge Functions.

### Problème : XP ne s'affiche pas dans Profile

**Solution** :
1. Vérifier que les migrations sont appliquées
2. Vérifier que la colonne `xp_total` existe dans table `users`
3. Vérifier console browser pour erreurs

### Problème : Tracking ne fonctionne pas

**Solution** :
1. Vérifier que les fonctions SQL sont créées
2. Vérifier RLS policies sur table `users`
3. Vérifier console browser pour erreurs réseau

---

## 📞 SUPPORT

Si vous rencontrez des problèmes :
1. Vérifier les logs Supabase Dashboard
2. Vérifier console browser DevTools
3. Vérifier que toutes les étapes ont été suivies

Bon déploiement ! 🎯
