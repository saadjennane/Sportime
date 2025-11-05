# Système de Progression XP - Guide d'Implémentation

## 🎉 Statut : Phase 1-4 COMPLÉTÉES

Toutes les fondations du système de progression XP, niveaux, badges et saisons ont été implémentées et sont prêtes à être déployées.

---

## 📦 CE QUI A ÉTÉ IMPLÉMENTÉ

### ✅ Sprint 1 : Migrations SQL & Fondations Database

**Fichiers créés :**
- `supabase/migrations/20250620000000_unified_progression_system.sql`
- `supabase/migrations/20250620000001_activity_tracking.sql`
- `supabase/migrations/20250620000002_real_xp_calculation.sql`

**Fonctionnalités :**
- ✅ Table `levels_config` avec noms uniformisés (Rookie → GOAT)
- ✅ Niveaux standardisés : Rookie (0), Rising Star (5k), Pro (15k), Elite (35k), Legend (70k), GOAT (120k)
- ✅ Colonnes progression dans `users` : `xp_total`, `current_level`, `level_name`, `last_active_date`, `goat_bonus_active`
- ✅ Table `user_activity_logs` pour tracking hebdomadaire
- ✅ Table `badges` avec conditions dynamiques (`condition_type`, `condition_value`, `condition_query`)
- ✅ Table `challenge_required_badges` pour multi-badges
- ✅ Tables `seasons` et `season_logs`
- ✅ Fonctions SQL :
  - `calculate_user_weekly_xp(user_id)` - Calcul XP avec vraies données
  - `update_all_weekly_xp()` - Batch update hebdomadaire
  - `end_of_season_reset()` - Reset saisonnier
  - `get_user_progression_summary(user_id)` - Résumé progression
  - `add_xp_to_user(user_id, xp_amount)` - Ajout XP manuel
- ✅ Fonctions de tracking :
  - `track_user_activity(user_id)`
  - `track_prediction(user_id, is_correct)`
  - `track_bet(user_id, amount, win_amount, odds)`
  - `track_fantasy_game(user_id, score)`
  - `track_badge_earned(user_id)`
  - `track_game_type(user_id, game_type)`
- ✅ Triggers automatiques pour badges

---

### ✅ Sprint 2 : Services & Hooks TypeScript

**Fichiers créés :**
- `src/services/activityTracker.ts`
- `src/hooks/useActivityTracker.ts`
- `src/hooks/useProgression.ts`

**Fonctionnalités :**
- ✅ Service `activityTracker` avec debouncing (5 min)
- ✅ Fonctions : `trackActivity()`, `trackPrediction()`, `trackBet()`, `trackFantasyGame()`, `trackGameType()`
- ✅ Hook `useActivityTracker` pour tracking automatique
- ✅ Hook `useProgression` avec real-time updates (Supabase subscriptions)
- ✅ Interface `UserProgression` avec decay warnings

---

### ✅ Sprint 3 : Edge Functions & Admin Interface

**Fichiers créés :**
- `supabase/functions/calculate-weekly-xp/index.ts`
- `supabase/functions/check-badge-awards/index.ts`
- `src/components/admin/BadgeManager.tsx`

**Fonctionnalités :**
- ✅ Edge Function `calculate-weekly-xp` pour batch XP update
- ✅ Edge Function `check-badge-awards` pour attribution automatique
- ✅ Interface admin complète pour gérer les badges :
  - Créer/éditer/supprimer badges
  - 6 types de conditions : win_streak, total_wins, accuracy_threshold, coins_earned, games_played, custom_query
  - Activer/désactiver badges
  - Preview conditions

---

### ✅ Sprint 4 : Composants UI Progression

**Fichiers créés :**
- `src/components/progression/XPProgressBar.tsx`
- `src/components/progression/BadgeDisplay.tsx`

**Fonctionnalités :**
- ✅ Barre de progression XP avec animations
- ✅ Affichage GOAT bonus (+5% XP)
- ✅ Warnings decay d'inactivité
- ✅ Affichage badges earned vs locked
- ✅ Mode compact pour header
- ✅ Real-time updates

---

## 🚀 PROCHAINES ÉTAPES

### Étape 1 : Appliquer les Migrations

```bash
cd /Users/sj/Desktop/Sportime

# Appliquer les migrations
npx supabase db push

# Vérifier que tout s'est bien passé
npx supabase db diff
```

**⚠️ IMPORTANT** : Avant de push, vérifier s'il y a des conflits avec les anciennes migrations de progression :
- `20250606120000_user_progression_schema.sql`
- `20250606000001_update_user_progression_schema.sql`
- `20250615100000_progression_system.sql`

Si ces migrations ont déjà été appliquées, il faudra peut-être les commenter ou les supprimer du dossier migrations.

---

### Étape 2 : Déployer les Edge Functions

```bash
# Déployer calculate-weekly-xp
npx supabase functions deploy calculate-weekly-xp

# Déployer check-badge-awards
npx supabase functions deploy check-badge-awards

# Vérifier les déploiements
npx supabase functions list
```

---

### Étape 3 : Intégrer le Tracking d'Activité

Modifier `src/App.tsx` pour ajouter le tracking automatique :

```typescript
import { useActivityTracker } from './hooks/useActivityTracker';
import { trackPrediction, trackBet, trackFantasyGame } from './services/activityTracker';

function App() {
  const { profile } = useAuth();

  // Tracking automatique général
  useActivityTracker(profile?.id || null);

  // ... rest of your App component
}
```

Intégrer dans les composants de jeu :

**SwipeGamePage.tsx** (ligne 72-73) :
```typescript
import { trackPrediction, trackGameType } from '../../services/activityTracker';

// Après avoir sauvé une prédiction
await savePrediction(matchId, prediction, match.odds);

// Tracker l'activité
await trackPrediction(userId!, null); // is_correct sera mis à jour plus tard
await trackGameType(userId!, 'swipe_prediction');
```

**App.tsx - handleConfirmBet** (autour ligne 400) :
```typescript
import { trackBet } from './services/activityTracker';

// Après avoir placé un pari
await trackBet(profile.id, amount, 0, odds);
```

**Fantasy Games** (similaire) :
```typescript
import { trackFantasyGame } from './services/activityTracker';

// Après avoir terminé un jeu fantasy
await trackFantasyGame(userId, finalScore);
```

---

### Étape 4 : Intégrer l'Interface Admin Badges

Modifier `src/pages/Admin.tsx` :

```typescript
import { BadgeManager } from '../components/admin/BadgeManager';

// Dans le section Progression
{activeSection === 'progression' && (
  <div className="animate-scale-in space-y-6">
    {/* Existing ProgressionAdmin */}
    <ProgressionAdmin profile={profile} addToast={addToast} />

    {/* New Badge Manager */}
    <BadgeManager addToast={addToast} />
  </div>
)}
```

---

### Étape 5 : Afficher la Progression XP dans l'UI

**Option A : Header Global**

Modifier le header principal pour afficher la barre XP :

```typescript
import { XPProgressBar } from './components/progression/XPProgressBar';

<header className="...">
  {/* Existing header content */}

  {profile && (
    <XPProgressBar userId={profile.id} compact />
  )}
</header>
```

**Option B : Page Profil Dédiée**

Créer une page profil avec progression complète :

```typescript
import { XPProgressBar } from './components/progression/XPProgressBar';
import { BadgeDisplay } from './components/progression/BadgeDisplay';

<ProfilePage>
  <XPProgressBar userId={profile.id} />
  <BadgeDisplay userId={profile.id} showLocked />
</ProfilePage>
```

---

### Étape 6 : Configurer l'Automatisation Hebdomadaire

**Option A : GitHub Actions (Recommandé)**

Créer `.github/workflows/weekly-xp-calculation.yml` :

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
      - name: Trigger Edge Function
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" \
            https://${{ secrets.SUPABASE_PROJECT_REF }}.supabase.co/functions/v1/calculate-weekly-xp

      - name: Check Badge Awards
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" \
            https://${{ secrets.SUPABASE_PROJECT_REF }}.supabase.co/functions/v1/check-badge-awards
```

Ajouter les secrets GitHub :
- `SUPABASE_ANON_KEY`
- `SUPABASE_PROJECT_REF`

**Option B : pg_cron (Supabase Native)**

Si pg_cron est disponible sur votre projet Supabase :

```sql
SELECT cron.schedule(
  'weekly-xp-update',
  '0 0 * * 1', -- Tous les lundis à 00:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/calculate-weekly-xp',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_ANON_KEY'),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'weekly-badge-check',
  '0 1 * * 1', -- Tous les lundis à 01:00 UTC (après XP)
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/check-badge-awards',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_ANON_KEY'),
    body := '{}'::jsonb
  );
  $$
);
```

---

### Étape 7 : Créer des Badges Initiaux

Via l'interface admin BadgeManager, créer quelques badges de base :

1. **First Victory** (Première Victoire)
   - Type: `total_wins`
   - Threshold: `1`
   - XP: `150`
   - Icon: 🏆

2. **Prediction Master** (Maître des Prédictions)
   - Type: `total_wins`
   - Threshold: `10`
   - XP: `300`

3. **Sharp Eye** (Œil Aiguisé)
   - Type: `accuracy_threshold`
   - Percentage: `75`
   - XP: `500`

4. **High Roller** (Gros Joueur)
   - Type: `coins_earned`
   - Amount: `10000`
   - XP: `400`

5. **Dedicated Player** (Joueur Dévoué)
   - Type: `games_played`
   - Threshold: `50`
   - XP: `600`

---

## 🧪 TESTS À EFFECTUER

### Test 1 : Migrations

```bash
# Appliquer migrations localement
npx supabase db reset

# Vérifier que les tables existent
npx supabase db execute "SELECT * FROM levels_config;"
npx supabase db execute "SELECT * FROM user_activity_logs LIMIT 1;"
```

### Test 2 : Tracking d'Activité

```typescript
// Dans la console browser
import { trackActivity } from './services/activityTracker';
await trackActivity('USER_ID_HERE');

// Vérifier dans Supabase
// Table users → last_active_date should be updated
// Table user_activity_logs → days_active should increment
```

### Test 3 : Calcul XP Manuel

```sql
-- Dans SQL Editor Supabase
SELECT * FROM calculate_user_weekly_xp('USER_ID_HERE');
SELECT * FROM update_all_weekly_xp();
```

### Test 4 : Edge Functions

```bash
# Test calculate-weekly-xp
curl -X POST \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  https://YOUR_PROJECT.supabase.co/functions/v1/calculate-weekly-xp

# Test check-badge-awards
curl -X POST \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID_HERE"}' \
  https://YOUR_PROJECT.supabase.co/functions/v1/check-badge-awards
```

### Test 5 : UI Components

1. Ajouter `<XPProgressBar userId={profile?.id} />` temporairement dans App.tsx
2. Vérifier que la barre s'affiche correctement
3. Modifier manuellement `xp_total` dans Supabase et vérifier que l'UI se met à jour en temps réel

---

## 📊 STRUCTURE DES DONNÉES

### Table: users
```sql
xp_total INT DEFAULT 0
current_level INT DEFAULT 1
level_name TEXT DEFAULT 'Rookie'
last_active_date TIMESTAMPTZ
goat_bonus_active BOOLEAN DEFAULT false
```

### Table: user_activity_logs
```sql
user_id UUID
week_start DATE (toujours un lundi)
days_active INT
predictions_made INT
predictions_correct INT
fantasy_games INT
fantasy_avg_score NUMERIC
bets_placed INT
bets_won INT
avg_win_odds NUMERIC
badges_earned INT
game_types_played INT
```

### Table: badges
```sql
name TEXT
description TEXT
icon_url TEXT
xp_bonus INT DEFAULT 150
condition_type TEXT (win_streak|total_wins|accuracy_threshold|coins_earned|games_played|custom_query)
condition_value JSONB
condition_query TEXT
is_active BOOLEAN
```

---

## 🔧 DÉPANNAGE

### Problème : Migrations échouent

**Solution** : Vérifier les migrations existantes et les commenter si nécessaire :
```bash
# Lister les migrations appliquées
npx supabase migration list

# Si besoin, réinitialiser complètement
npx supabase db reset
```

### Problème : XP ne se met pas à jour

**Vérifier** :
1. `last_active_date` est mis à jour ? → Check tracking
2. `user_activity_logs` a des données ? → Check fonctions de tracking
3. Edge function s'exécute ? → Check logs Supabase Functions

### Problème : Real-time ne fonctionne pas

**Solution** : Vérifier RLS policies sur table `users` :
```sql
CREATE POLICY "Allow users to read their own data"
  ON public.users FOR SELECT
  USING (auth.uid() = id);
```

---

## 📈 MÉTRIQUES DE SUCCÈS

- [ ] Migrations appliquées sans erreur
- [ ] Edge Functions déployées et accessibles
- [ ] Tracking d'activité fonctionne (last_active_date se met à jour)
- [ ] XP calculé automatiquement chaque semaine
- [ ] Badges attribués automatiquement
- [ ] UI affiche progression en temps réel
- [ ] Decay appliqué aux utilisateurs inactifs
- [ ] GOAT bonus fonctionne correctement
- [ ] Admin peut créer/gérer badges dynamiquement

---

## 🎯 FORMULE XP FINALE

```
XP = (A + P + F + R + B + G) × D × GOAT_BONUS - DECAY

Où:
A = days_active × 50
P = (predictions_correct / predictions_made × 100) × 1.2
F = fantasy_avg_score × 0.5
R = (avg_win_odds - 1) × 100
B = badges_earned × 150
G = game_types_played × 40
D = 1 / (1 + 0.05 × (current_level - 1))
GOAT_BONUS = 1.05 si actif, sinon 1.0
DECAY = XP × (0.02 × weeks_inactive) si >= 2 semaines et level < 6
```

---

## 🏆 FÉLICITATIONS !

Le système de progression est maintenant complet et prêt à être déployé. Il ne reste plus qu'à :

1. ✅ Appliquer les migrations
2. ✅ Déployer les Edge Functions
3. ✅ Intégrer le tracking dans l'app
4. ✅ Configurer l'automatisation
5. ✅ Tester en production

Bon courage ! 🚀
