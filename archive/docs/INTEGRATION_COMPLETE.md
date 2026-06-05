# ✅ Intégration Complète du Système de Progression

## 📍 OÙ SONT INTÉGRÉS LES COMPOSANTS ?

### 1. **Tracking Automatique d'Activité**

**Fichier** : `src/App.tsx` (ligne ~106)

```typescript
// ✅ Auto-track user activity for XP calculation
useActivityTracker(profile?.id || null);
```

**Fonction** :
- Track automatiquement l'activité utilisateur toutes les 5 minutes
- Met à jour `last_active_date` dans la table `users`
- Incrémente `days_active` dans `user_activity_logs`
- Évite le decay d'inactivité

---

### 2. **Barre de Progression XP**

**Fichier** : `src/pages/ProfilePage.tsx` (ligne ~189)

**Emplacement** : Page Profile → Onglet "Overview" → Section XP Progress

```typescript
{/* ✅ New XP Progress Component with real-time updates */}
<XPProgressBar userId={profile.id} />
```

**Affiche** :
- Niveau actuel (Rookie, Rising Star, Pro, Elite, Legend, GOAT)
- XP total et progression vers prochain niveau
- Barre de progression animée
- Badge GOAT Bonus (+5% XP) si actif
- Warning decay d'inactivité

---

### 3. **Affichage des Badges**

**Fichier** : `src/pages/ProfilePage.tsx` (ligne ~212)

**Emplacement** : Page Profile → Onglet "Overview" → Section Badges

```typescript
{/* ✅ New Badge Display Component with dynamic badge loading */}
<div className="card-base p-5">
  <h3 className="text-lg font-bold text-text-secondary flex items-center gap-2 mb-4">
    <Shield size={20} className="text-neon-cyan" /> Badges
  </h3>
  <BadgeDisplay userId={profile.id} showLocked={true} />
</div>
```

**Affiche** :
- Badges gagnés avec dates d'obtention
- Badges locked (non gagnés) en grisé
- Bonus XP de chaque badge
- Descriptions détaillées

---

### 4. **Interface Admin pour Badges**

**Fichier** : `src/pages/Admin.tsx` (ligne ~130)

**Emplacement** : Page Admin → Onglet "Progression" → Bas de page

```typescript
{/* ✅ New Dynamic Badge Manager */}
<BadgeManager addToast={addToast} />
```

**Permet** :
- Créer de nouveaux badges dynamiquement
- 6 types de conditions : win_streak, total_wins, accuracy_threshold, coins_earned, games_played, custom_query
- Éditer badges existants
- Activer/désactiver badges
- Supprimer badges
- Configurer XP bonus (par défaut 150)
- Upload icon (emoji ou URL)

---

## 🎮 COMMENT UTILISER LE SYSTÈME

### Pour les Utilisateurs

1. **Voir sa progression** :
   - Aller sur la page Profile
   - L'onglet "Overview" montre automatiquement :
     - Niveau actuel et progression XP
     - Badges gagnés et locked
     - Warnings de decay si inactif

2. **Gagner de l'XP** :
   - Jouer aux jeux (predictions, fantasy, swipe)
   - Faire des paris précis
   - Maintenir une bonne accuracy
   - Gagner des badges
   - Varier les types de jeux
   - L'XP est calculé automatiquement chaque lundi

3. **Éviter le decay** :
   - Se connecter et jouer au moins 1x toutes les 2 semaines
   - Le système track automatiquement `last_active_date`

---

### Pour les Admins

1. **Créer un badge** :
   - Aller sur Admin → Progression
   - Cliquer "Create Badge"
   - Remplir le formulaire :
     - Nom du badge
     - Description
     - Icon (emoji ou URL)
     - XP Bonus (défaut: 150)
     - Type de condition
     - Valeur seuil
   - Cliquer "Create Badge"

2. **Types de conditions disponibles** :

| Type | Description | Exemple |
|------|-------------|---------|
| `win_streak` | X victoires consécutives | Threshold: 5 |
| `total_wins` | X victoires totales | Threshold: 10 |
| `accuracy_threshold` | Précision minimale % | Percentage: 75 |
| `coins_earned` | Coins gagnés total | Amount: 10000 |
| `games_played` | Nb de jeux joués | Threshold: 50 |
| `custom_query` | Requête SQL custom | Query SQL |

3. **Gérer les badges** :
   - Éditer : Modifier nom, description, conditions
   - Activer/Désactiver : Toggle pour activer/désactiver sans supprimer
   - Supprimer : Suppression définitive

---

## 🔄 FLUX DE DONNÉES

### Tracking d'Activité

```
User Action (play game, bet, etc.)
        ↓
trackActivity(userId) / trackPrediction() / trackBet()
        ↓
Supabase RPC function (track_user_activity, etc.)
        ↓
Updates:
  - users.last_active_date
  - user_activity_logs (weekly aggregation)
```

### Calcul XP Hebdomadaire

```
Every Monday 00:00 UTC
        ↓
GitHub Actions OR pg_cron
        ↓
Edge Function: calculate-weekly-xp
        ↓
SQL Function: update_all_weekly_xp()
        ↓
For each user:
  - calculate_user_weekly_xp()
  - Reads user_activity_logs
  - Applies formula: (A+P+F+R+B+G) × D × GOAT_BONUS - DECAY
  - Updates users.xp_total, current_level, level_name
        ↓
Real-time update via Supabase subscriptions
        ↓
UI updates automatically (useProgression hook)
```

### Attribution de Badges

```
Every Monday 01:00 UTC (after XP calculation)
        ↓
Edge Function: check-badge-awards
        ↓
For each active badge:
  - Evaluate condition (win_streak, accuracy, etc.)
  - If met → Insert into user_badges
        ↓
Trigger: auto_award_badge_xp
        ↓
Add XP bonus immediately via add_xp_to_user()
        ↓
UI updates via BadgeDisplay component
```

---

## 📱 INTERFACE UTILISATEUR

### ProfilePage - Overview Tab

```
┌─────────────────────────────────────┐
│  [Avatar] [Name] [Level]            │
├─────────────────────────────────────┤
│  [Overview] [Stats] [Squad]         │
├─────────────────────────────────────┤
│  📊 XP Progress Bar                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━ 75%      │
│  Level 3: Pro                       │
│  12,500 / 15,000 XP                 │
│  2,500 XP to Elite                  │
│                                     │
│  🎯 GOAT Bonus Active: +5% XP       │ (if applicable)
│  ⚠️ Inactivity Warning: 3 weeks     │ (if inactive)
├─────────────────────────────────────┤
│  🎖️ Badges                          │
│                                     │
│  Earned Badges (3)                  │
│  🏆 🔥 ⭐                            │
│                                     │
│  Locked Badges (12)                 │
│  🔒 🔒 🔒 ...                       │
└─────────────────────────────────────┘
```

### AdminPage - Progression Tab

```
┌─────────────────────────────────────┐
│  [Challenges] [Swipe] [Feed]        │
│  [Progression] [DataSync] [Dev]     │
├─────────────────────────────────────┤
│  📊 Levels & XP System              │
│  (Existing ProgressionAdmin)        │
├─────────────────────────────────────┤
│  🎖️ Badge Management                │
│  [+ Create Badge]                   │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 🏆 First Victory               │ │
│  │ +150 XP                        │ │
│  │ Type: Total Wins (1)           │ │
│  │ [Active]                       │ │
│  │ [Edit] [Deactivate] [Delete]  │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 🎯 Sharp Eye                   │ │
│  │ +500 XP                        │ │
│  │ Type: Accuracy (75%)           │ │
│  │ [Active]                       │ │
│  │ [Edit] [Deactivate] [Delete]  │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## 🚦 ÉTAT D'IMPLÉMENTATION

| Composant | Fichier | Statut | Ligne |
|-----------|---------|--------|-------|
| Activity Tracker Hook | App.tsx | ✅ Intégré | ~106 |
| XP Progress Bar | ProfilePage.tsx | ✅ Intégré | ~189 |
| Badge Display | ProfilePage.tsx | ✅ Intégré | ~212 |
| Badge Manager Admin | Admin.tsx | ✅ Intégré | ~130 |

---

## 🔧 DÉPENDANCES MANQUANTES

Aucun package npm supplémentaire requis ! Tous les composants utilisent :
- ✅ React hooks existants
- ✅ Supabase client existant
- ✅ Lucide icons existants
- ✅ Tailwind CSS existant

---

## 🎯 PROCHAINES ÉTAPES

Pour activer complètement le système :

1. **Appliquer les migrations**
   ```bash
   npx supabase db push
   ```

2. **Déployer les Edge Functions**
   ```bash
   npx supabase functions deploy calculate-weekly-xp
   npx supabase functions deploy check-badge-awards
   ```

3. **Configurer l'automatisation** (GitHub Actions ou pg_cron)
   - Voir PROGRESSION_IMPLEMENTATION.md étape 6

4. **Créer des badges initiaux** via l'interface admin

5. **Tester le système** :
   - Jouer à un jeu → vérifier que last_active_date se met à jour
   - Vérifier ProfilePage affiche bien la progression
   - Tester création de badge via Admin

---

## 💡 ASTUCES

- **Real-time updates** : La progression XP se met à jour automatiquement grâce aux Supabase subscriptions
- **Debouncing** : Le tracking d'activité est debounced à 5 minutes pour éviter spam DB
- **Compact mode** : XPProgressBar peut être utilisé en mode compact dans le header :
  ```typescript
  <XPProgressBar userId={profile.id} compact />
  ```
- **Sans locked badges** : Badge Display peut cacher les badges non gagnés :
  ```typescript
  <BadgeDisplay userId={profile.id} showLocked={false} />
  ```

---

## ✅ VALIDATION

Pour vérifier que tout fonctionne :

1. Ouvrir la page Profile → voir la barre XP et les badges
2. Ouvrir Admin → Progression → voir Badge Manager
3. Ouvrir la console browser → vérifier les appels à `track_user_activity`
4. Jouer à un jeu → vérifier que `last_active_date` se met à jour dans Supabase

---

Tout est prêt ! 🎉
