# 🧪 Testing Checklist - Fonctionnalités Déployées

Guide complet pour tester toutes les fonctionnalités migrées vers Supabase depuis Daily Streaks et Challenges.

---

## 1. 🔥 DAILY STREAKS SYSTEM

**Statut:** ✅ Fully Deployed (Supabase)
**Migration:** `20250627000010_user_streaks_system.sql`
**Service:** `streakService.ts` | **Hook:** `useUserStreak.ts`

### Tests à Effectuer

#### Test 1.1: Claim Daily Streak (Day 1-6)
- [ ] **Action:** Ouvrir l'app et cliquer sur la modale "Daily Streak"
- [ ] **Action:** Cliquer sur "Claim Reward"
- [ ] **🎯 Résultat Attendu:**
  - Coins ajoutés (100 Day 1, 150 Day 2, 200 Day 3, 250 Day 4, 300 Day 5, 400 Day 6)
  - Modale affiche le jour suivant
  - `current_day` incrémenté dans DB
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT * FROM user_streaks WHERE user_id = 'YOUR_USER_ID';
  -- Vérifier current_day, last_claimed_at
  ```

#### Test 1.2: Claim Day 7 Reward (Amateur Ticket)
- [ ] **Action:** Claim reward au Day 7
- [ ] **🎯 Résultat Attendu:**
  - 500 coins + 1 Amateur ticket
  - Streak reset à Day 1
  - Ticket ajouté dans `user_tickets`
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT * FROM user_tickets WHERE user_id = 'YOUR_USER_ID'
  AND ticket_type = 'amateur'
  ORDER BY created_at DESC LIMIT 1;
  ```

#### Test 1.3: Streak Reset (Inactivité > 24h)
- [ ] **Action:** Ne pas claim pendant > 24 heures
- [ ] **🎯 Résultat Attendu:** Streak reset à Day 1
- [ ] **🔍 Vérification:** Modale affiche "Day 1" à la prochaine ouverture

#### Test 1.4: Daily Window Verification
- [ ] **Action:** Claim avant 8:00 AM
- [ ] **🎯 Résultat Attendu:** Ne peut pas claim (still yesterday)
- [ ] **Action:** Claim après 8:00 AM
- [ ] **🎯 Résultat Attendu:** Peut claim (new day)

---

## 2. 🎯 CHALLENGE BETTING SYSTEM

**Statut:** ✅ Fully Deployed (Supabase)
**Migrations:** `20250624000000_challenge_betting_entries.sql`, `20250628000001_challenge_leaderboard_engine.sql`
**Services:** `challengeService.ts`, `challengeEntryService.ts`

### Tests à Effectuer

#### Test 2.1: Join Challenge avec Coins
- [ ] **Action:** Sélectionner un challenge et cliquer "Join with Coins"
- [ ] **Précondition:** Avoir suffisamment de coins (ex: 1000 coins)
- [ ] **🎯 Résultat Attendu:**
  - Coins déduits du balance
  - Entrée créée dans `challenge_participants` et `challenge_entries`
  - Accès aux matchs du challenge
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT * FROM challenge_participants
  WHERE challenge_id = 'CHALLENGE_ID' AND user_id = 'USER_ID';

  SELECT * FROM challenge_entries
  WHERE challenge_id = 'CHALLENGE_ID' AND user_id = 'USER_ID';
  -- Vérifier entry_method = 'coins'
  ```

#### Test 2.2: Join Challenge avec Ticket
- [ ] **Action:** Join avec un Amateur ou Pro ticket
- [ ] **Précondition:** Avoir un ticket disponible (non-used, non-expired)
- [ ] **🎯 Résultat Attendu:**
  - Ticket marqué `is_used = true`
  - Entry method = 'ticket'
  - Pas de déduction de coins
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT * FROM user_tickets WHERE id = 'TICKET_ID';
  -- Vérifier is_used = true
  ```

#### Test 2.3: Place Bet (Single Match)
- [ ] **Action:** Sélectionner un match et placer un pari (Home/Draw/Away)
- [ ] **🎯 Résultat Attendu:**
  - Bet enregistré dans `challenge_bets`
  - Affichage visuel du pari dans l'UI
  - Peut éditer avant deadline
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT * FROM challenge_bets
  WHERE user_id = 'USER_ID' AND match_id = 'MATCH_ID';
  ```

#### Test 2.4: Apply Booster (x2 or x3)
- [ ] **Action:** Sélectionner un booster x2 ou x3 pour un match
- [ ] **Précondition:** Première utilisation du booster ce jour-là
- [ ] **🎯 Résultat Attendu:**
  - Booster enregistré dans `challenge_daily_entries`
  - Points multipliés si pari correct
  - Ne peut plus réutiliser le même booster ce jour
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT * FROM challenge_daily_entries
  WHERE user_id = 'USER_ID' AND challenge_id = 'CHALLENGE_ID' AND day_number = 1;
  -- Vérifier x2_used ou x3_used = true
  ```

#### Test 2.5: Multi-Day Challenge
- [ ] **Action:** Parier sur Day 1, puis Day 2, Day 3
- [ ] **🎯 Résultat Attendu:**
  - Chaque jour a sa propre section de matchs
  - Boosters se réinitialisent chaque jour
  - Leaderboard cumule les points de tous les jours
- [ ] **🔍 Vérification:**
  ```sql
  SELECT day_number, COUNT(*) as bets_count
  FROM challenge_bets
  WHERE user_id = 'USER_ID' AND challenge_id = 'CHALLENGE_ID'
  GROUP BY day_number;
  ```

#### Test 2.6: Leaderboard Calculation
- [ ] **Action:** Vérifier le leaderboard après résultats des matchs
- [ ] **🎯 Résultat Attendu:**
  - Points calculés correctement (1 point par correct, x2/x3 si booster)
  - Classement basé sur total_points, gross_gain, net_gain
  - Rank affiché dans l'UI
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT * FROM challenge_participants
  WHERE challenge_id = 'CHALLENGE_ID'
  ORDER BY total_points DESC, gross_gain DESC;
  ```

#### Test 2.7: Prize Distribution
- [ ] **Action:** Finir dans le top 3 d'un challenge
- [ ] **🎯 Résultat Attendu:**
  - Prizes distribués selon reward_tiers
  - Coins/tickets ajoutés au compte
  - `has_claimed_prize = true`
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT * FROM challenge_participants
  WHERE user_id = 'USER_ID' AND challenge_id = 'CHALLENGE_ID';
  -- Vérifier has_claimed_prize

  SELECT * FROM coin_transactions
  WHERE user_id = 'USER_ID' AND transaction_type = 'prize_won';
  ```

---

## 3. 👥 SQUADS SYSTEM (formerly Leagues)

**Statut:** ✅ Fully Deployed (Supabase)
**Migration:** `20250708000001_create_squads_schema_fixed.sql`
**Service:** `squadService.ts`

### Tests à Effectuer

#### Test 3.1: Create Squad
- [ ] **Action:** Cliquer "Create Squad" et remplir nom + description
- [ ] **🎯 Résultat Attendu:**
  - Squad créé dans `squads` table
  - Utilisateur ajouté comme admin dans `squad_members`
  - Invite code généré (8 caractères)
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT * FROM squads WHERE created_by = 'USER_ID' ORDER BY created_at DESC LIMIT 1;

  SELECT * FROM squad_members WHERE squad_id = 'SQUAD_ID' AND user_id = 'USER_ID';
  -- Vérifier role = 'admin'
  ```

#### Test 3.2: Join Squad via Invite Code
- [ ] **Action:** Entrer un invite code valide et joindre
- [ ] **🎯 Résultat Attendu:**
  - Membre ajouté dans `squad_members` avec role = 'member'
  - Squad apparaît dans "Your Squads"
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT * FROM squad_members WHERE squad_id = 'SQUAD_ID' AND user_id = 'NEW_USER_ID';
  ```

#### Test 3.3: Link Challenge to Squad
- [ ] **Action:** Admin link un challenge au squad
- [ ] **🎯 Résultat Attendu:**
  - Challenge ajouté dans `squad_games`
  - Squad leaderboard affiche les participants du squad
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT * FROM squad_games WHERE squad_id = 'SQUAD_ID' AND game_id = 'CHALLENGE_ID';
  ```

#### Test 3.4: Squad Leaderboard
- [ ] **Action:** Consulter le leaderboard d'un squad game
- [ ] **🎯 Résultat Attendu:**
  - Affiche seulement les membres du squad
  - Classement basé sur les points du challenge
  - Rank visible

#### Test 3.5: Admin Permissions - Kick Member
- [ ] **Action:** Admin kick un membre
- [ ] **🎯 Résultat Attendu:**
  - Membre retiré de `squad_members`
  - Ne peut plus voir le squad
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT * FROM squad_members WHERE squad_id = 'SQUAD_ID';
  -- Membre disparu
  ```

#### Test 3.6: Admin Permissions - Promote Member
- [ ] **Action:** Admin promote un membre en admin
- [ ] **🎯 Résultat Attendu:**
  - `role = 'admin'` dans `squad_members`
  - Nouveau admin peut gérer le squad

#### Test 3.7: Leave Squad
- [ ] **Action:** Membre (non-admin) quitte le squad
- [ ] **🎯 Résultat Attendu:**
  - Supprimé de `squad_members`
  - Squad ne s'affiche plus

#### Test 3.8: Delete Squad
- [ ] **Action:** Admin supprime le squad
- [ ] **🎯 Résultat Attendu:**
  - Squad soft-deleted (is_active = false)
  - Membres ne voient plus le squad
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT * FROM squads WHERE id = 'SQUAD_ID';
  -- Vérifier is_active = false
  ```

#### Test 3.9: Reset Invite Code
- [ ] **Action:** Admin reset le code d'invitation
- [ ] **🎯 Résultat Attendu:**
  - Nouveau code généré
  - Ancien code ne fonctionne plus

---

## 4. 🔔 NOTIFICATIONS SYSTEM (OneSignal + Supabase)

**Statut:** ✅ Fully Deployed
**Migration:** `20250709000000_create_notifications_schema.sql`
**Services:** `notificationService.ts`, `oneSignalService.ts`
**Edge Function:** `send-notification`

### Tests à Effectuer

#### Test 4.1: OneSignal Initialization
- [ ] **Action:** Ouvrir l'app (user non-guest)
- [ ] **🎯 Résultat Attendu:**
  - Console log: `[OneSignal] Initialized successfully`
  - Permission popup apparaît
- [ ] **🔍 Vérification:** Ouvrir console du navigateur

#### Test 4.2: Register Device (Player ID)
- [ ] **Action:** Accepter la permission de notifications
- [ ] **🎯 Résultat Attendu:**
  - Console log: `[OneSignal] Permission granted, player ID: xxx`
  - Player ID enregistré dans `user_onesignal_players`
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT * FROM user_onesignal_players WHERE user_id = 'USER_ID' AND is_active = true;
  ```

#### Test 4.3: Send Test Notification (Push + In-App)
- [ ] **Action:** Appeler l'edge function `send-notification` via SQL:
  ```sql
  SELECT extensions.http_post(
    'https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/send-notification',
    '{"userId": "YOUR_USER_ID", "type": "system", "title": "Test", "message": "Hello!"}'::jsonb
  );
  ```
- [ ] **🎯 Résultat Attendu:**
  - Push notification reçue sur l'appareil
  - Notification sauvegardée dans `notifications` table
  - Badge unread count mis à jour dans header
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT * FROM notifications WHERE user_id = 'USER_ID' ORDER BY created_at DESC LIMIT 1;
  ```

#### Test 4.4: Notification Center Display
- [ ] **Action:** Cliquer sur l'icône de notification dans le header
- [ ] **🎯 Résultat Attendu:**
  - NotificationCenter slide-in s'ouvre
  - Affiche la liste des notifications
  - Unread notifications en surbrillance
  - Loading spinner pendant le fetch

#### Test 4.5: Mark as Read (Single)
- [ ] **Action:** Cliquer sur une notification
- [ ] **🎯 Résultat Attendu:**
  - `is_read = true` dans DB
  - Notification plus en surbrillance
  - Unread count décrémenté
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT * FROM notifications WHERE id = 'NOTIFICATION_ID';
  -- Vérifier is_read = true
  ```

#### Test 4.6: Mark All as Read
- [ ] **Action:** Cliquer "Mark all as read"
- [ ] **🎯 Résultat Attendu:**
  - Toutes les notifications `is_read = true`
  - Unread count = 0
  - Badge disparaît du header

#### Test 4.7: Real-Time Subscription
- [ ] **Action:** Envoyer une notification pendant que l'app est ouverte
- [ ] **🎯 Résultat Attendu:**
  - Notification apparaît instantanément dans le center
  - Unread count mis à jour en temps réel
  - Pas besoin de rafraîchir

#### Test 4.8: Notification Preferences
- [ ] **Action:** Modifier les préférences (désactiver "gameplay_enabled")
- [ ] **Action:** Envoyer une notification type "gameplay"
- [ ] **🎯 Résultat Attendu:**
  - Notification bloquée côté serveur
  - N'apparaît ni en push ni in-app
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT * FROM notification_preferences WHERE user_id = 'USER_ID';
  ```

#### Test 4.9: Pagination (Infinite Scroll)
- [ ] **Précondition:** Avoir > 50 notifications
- [ ] **Action:** Scroller jusqu'en bas du NotificationCenter
- [ ] **🎯 Résultat Attendu:**
  - Charger automatiquement les 50 suivantes
  - Loading spinner en bas
  - Pas de duplication

---

## 5. 📈 PROGRESSION SYSTEM (XP, Levels, Badges)

**Statut:** ✅ Fully Deployed
**Migrations:** `20250620000000_unified_progression_system.sql`, `20250620000001_activity_tracking.sql`, `20250620000002_real_xp_calculation.sql`
**Edge Functions:** `calculate-weekly-xp`, `check-badge-awards`

### Tests à Effectuer

#### Test 5.1: Activity Tracking
- [ ] **Action:** Placer un pari dans un challenge
- [ ] **🎯 Résultat Attendu:**
  - Entry créée dans `user_activity_logs` pour la semaine courante
  - `predictions_count` incrémenté
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT * FROM user_activity_logs
  WHERE user_id = 'USER_ID'
  AND week_start = date_trunc('week', CURRENT_DATE);
  ```

#### Test 5.2: Weekly XP Calculation (Manual Trigger)
- [ ] **Action:** Appeler l'edge function `calculate-weekly-xp` manuellement
- [ ] **🎯 Résultat Attendu:**
  - XP calculé selon la formule:
    - challenges_joined * 50
    - predictions_count * 10
    - correct_predictions * 5
    - badges_earned * 20
  - `total_xp` mis à jour dans `users` table
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT total_xp FROM users WHERE id = 'USER_ID';
  ```

#### Test 5.3: Level Up Trigger
- [ ] **Action:** Gagner assez d'XP pour passer au prochain level
- [ ] **Précondition:** total_xp >= next level threshold
- [ ] **🎯 Résultat Attendu:**
  - `level` incrémenté (ex: "Amateur" → "Rising Star")
  - Notification de level up (optional)
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT level, total_xp FROM users WHERE id = 'USER_ID';
  -- Vérifier level correspond au total_xp
  ```

#### Test 5.4: Badge Award (Dynamic Conditions)
- [ ] **Action:** Remplir une condition de badge (ex: "10 correct predictions")
- [ ] **Action:** Appeler `check-badge-awards` edge function
- [ ] **🎯 Résultat Attendu:**
  - Badge ajouté dans `user_badges`
  - XP bonus ajouté (ex: +500 XP)
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT * FROM user_badges WHERE user_id = 'USER_ID' AND badge_id = 'BADGE_ID';
  ```

#### Test 5.5: GOAT Bonus (+5% XP)
- [ ] **Précondition:** Atteindre level "GOAT" (120k XP)
- [ ] **Action:** Gagner des XP via activité
- [ ] **🎯 Résultat Attendu:**
  - XP gains multipliés par 1.05
  - Visible dans les calculs hebdomadaires

#### Test 5.6: Inactivity Decay
- [ ] **Action:** Ne pas jouer pendant > 2 semaines
- [ ] **🎯 Résultat Attendu:**
  - Decay appliqué (-5% XP par semaine d'inactivité)
  - Level peut descendre si XP tombe sous le seuil
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT total_xp, level FROM users WHERE id = 'USER_ID';
  ```

#### Test 5.7: Admin Badge Management
- [ ] **Action:** Ouvrir Admin Panel → Badge Manager
- [ ] **Action:** Créer un nouveau badge avec conditions
- [ ] **🎯 Résultat Attendu:**
  - Badge créé dans `badges` table
  - Conditions JSON valides
  - XP reward défini
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT * FROM badges WHERE id = 'NEW_BADGE_ID';
  ```

---

## 6. 👆 SWIPE PREDICTIONS GAME

**Statut:** ✅ Fully Deployed
**Migration:** `20250620000000_swipe_predictions_schema.sql`
**Service:** `swipeGameService.ts`

### Tests à Effectuer

#### Test 6.1: Join Swipe Challenge
- [ ] **Action:** Cliquer "Join" sur un swipe game
- [ ] **🎯 Résultat Attendu:**
  - Participant ajouté dans `challenge_participants`
  - Accès aux matchdays
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT * FROM challenge_participants
  WHERE challenge_id = 'SWIPE_CHALLENGE_ID' AND user_id = 'USER_ID';
  ```

#### Test 6.2: Swipe Prediction (Home)
- [ ] **Action:** Swiper à droite pour prédire "Home Win"
- [ ] **🎯 Résultat Attendu:**
  - Prédiction enregistrée dans `swipe_predictions`
  - `prediction = 'home'`
  - Match suivant affiché
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT * FROM swipe_predictions
  WHERE user_id = 'USER_ID' AND fixture_id = 'FIXTURE_ID';
  ```

#### Test 6.3: Swipe Prediction (Away)
- [ ] **Action:** Swiper à gauche pour prédire "Away Win"
- [ ] **🎯 Résultat Attendu:**
  - `prediction = 'away'`

#### Test 6.4: Swipe Prediction (Draw)
- [ ] **Action:** Swiper vers le haut pour prédire "Draw"
- [ ] **🎯 Résultat Attendu:**
  - `prediction = 'draw'`

#### Test 6.5: Edit Prediction Before Deadline
- [ ] **Action:** Re-swiper un match déjà prédit avant le deadline
- [ ] **🎯 Résultat Attendu:**
  - Prédiction mise à jour dans DB
  - Affichage visuel change

#### Test 6.6: Deadline Lock
- [ ] **Action:** Essayer de swiper après le deadline du match
- [ ] **🎯 Résultat Attendu:**
  - Swipe désactivé
  - Message "Deadline passed"

#### Test 6.7: Daily Matchday Leaderboard
- [ ] **Action:** Consulter le leaderboard d'un matchday
- [ ] **🎯 Résultat Attendu:**
  - Affiche les points du jour
  - Classement basé sur correct predictions
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT * FROM matchday_participants
  WHERE matchday_id = 'MATCHDAY_ID'
  ORDER BY correct_predictions DESC;
  ```

#### Test 6.8: Cumulative Leaderboard
- [ ] **Action:** Consulter le leaderboard global du challenge
- [ ] **🎯 Résultat Attendu:**
  - Somme des points de tous les matchdays
  - `total_points` dans `challenge_participants`
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT * FROM challenge_participants
  WHERE challenge_id = 'SWIPE_CHALLENGE_ID'
  ORDER BY total_points DESC;
  ```

#### Test 6.9: Tutorial Flow
- [ ] **Action:** Première utilisation du swipe game
- [ ] **🎯 Résultat Attendu:**
  - Tutorial overlay s'affiche
  - Explications des gestes
  - Skip option disponible

---

## 7. ⚽ MATCHES PAGE (Betting on Live Matches)

**Statut:** ✅ Fully Deployed (Supabase)
**Hook:** `useMatchesOfTheDay.ts`
**Tables:** `fixtures`, `leagues`, `teams`, `odds`

### Tests à Effectuer

#### Test 7.1: Display Today's Matches
- [ ] **Action:** Ouvrir l'onglet "Matches"
- [ ] **🎯 Résultat Attendu:**
  - Affiche les matchs du jour depuis `fixtures` table
  - Groupés par league
  - Logos, noms d'équipes affichés
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT * FROM fixtures
  WHERE DATE(fixture_date) = CURRENT_DATE
  AND status IN ('scheduled', 'live');
  ```

#### Test 7.2: Real-Time Odds Display
- [ ] **Action:** Consulter les cotes d'un match
- [ ] **🎯 Résultat Attendu:**
  - Odds Home/Draw/Away affichés
  - Données depuis `odds` table ou API
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT * FROM odds WHERE fixture_id = 'FIXTURE_ID';
  ```

#### Test 7.3: Place Bet on Single Match
- [ ] **Action:** Cliquer sur un match et placer un pari
- [ ] **🎯 Résultat Attendu:**
  - Bet enregistré (table à créer si n'existe pas)
  - Coins déduits
  - Affichage du pari actif

#### Test 7.4: Upcoming vs Played Tabs
- [ ] **Action:** Basculer entre "Upcoming" et "Played"
- [ ] **🎯 Résultat Attendu:**
  - Upcoming: status = 'scheduled' ou 'live'
  - Played: status = 'finished'

#### Test 7.5: Match Stats Drawer
- [ ] **Action:** Cliquer sur les stats d'un match
- [ ] **🎯 Résultat Attendu:**
  - Drawer s'ouvre avec statistiques
  - Données H2H, form, etc.

#### Test 7.6: League Order Customization
- [ ] **Action:** Ouvrir League Order modal
- [ ] **Action:** Drag & drop leagues pour réorganiser
- [ ] **🎯 Résultat Attendu:**
  - Ordre sauvegardé dans localStorage
  - Matchs affichés dans le nouvel ordre

---

## 8. 💰 SUPPORTING SYSTEMS

### 8.1 Coin Transactions
**Migration:** `20250628000000_coin_transactions_system.sql`

- [ ] **Test:** Vérifier que chaque action (claim streak, win bet, prize) crée une transaction
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT * FROM coin_transactions WHERE user_id = 'USER_ID' ORDER BY created_at DESC;
  ```

### 8.2 Tickets System
**Migration:** `20250629000000_tickets_system.sql`

- [ ] **Test:** Vérifier expiration après 7 jours
- [ ] **Test:** Ticket `is_used = true` après utilisation
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT * FROM user_tickets WHERE user_id = 'USER_ID';
  ```

### 8.3 Prize Distribution
**Migration:** `20250628000002_challenge_prize_distribution.sql`

- [ ] **Test:** Top 3 reçoivent prizes selon reward_tiers
- [ ] **Test:** `has_claimed_prize = true` après claim
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT * FROM challenge_participants WHERE has_claimed_prize = true;
  ```

### 8.4 Real-Time Fixtures Sync
**Migration:** `20250606000000_create_football_schema.sql`

- [ ] **Test:** Fixtures synchronisés depuis API-Football
- [ ] **Test:** Leagues, teams, players peuplés
- [ ] **🔍 Vérification DB:**
  ```sql
  SELECT COUNT(*) FROM fixtures WHERE DATE(fixture_date) = CURRENT_DATE;
  ```

---

## 📊 RÉSUMÉ DES TESTS

| Fonctionnalité | Tests | Priorité | Statut |
|---------------|-------|----------|--------|
| Daily Streaks | 4 tests | HIGH | ⬜ |
| Challenge Betting | 7 tests | HIGH | ⬜ |
| Squads | 9 tests | HIGH | ⬜ |
| Notifications | 9 tests | HIGH | ⬜ |
| Progression | 7 tests | MEDIUM | ⬜ |
| Swipe Game | 9 tests | MEDIUM | ⬜ |
| Matches Page | 6 tests | MEDIUM | ⬜ |
| Supporting | 4 tests | LOW | ⬜ |

**Total:** 55 tests critiques

---

## 🔧 OUTILS DE DÉBOGAGE

### Console Logs à Surveiller
```javascript
// OneSignal
[OneSignal] Initialized successfully
[OneSignal] Permission granted, player ID: xxx

// Notifications
[notificationService] Fetching notifications
[send-notification] Received request

// Streaks
[streakService] Checking daily streak
[streakService] Claiming streak day X

// Challenges
[challengeService] Joining challenge
[challengeEntryService] Saving bet
```

### SQL Queries Utiles

**User Overview:**
```sql
SELECT
  u.username,
  u.coins_balance,
  u.level,
  u.total_xp,
  us.current_day as streak_day,
  COUNT(DISTINCT cp.challenge_id) as challenges_joined
FROM users u
LEFT JOIN user_streaks us ON u.id = us.user_id
LEFT JOIN challenge_participants cp ON u.id = cp.user_id
WHERE u.id = 'YOUR_USER_ID'
GROUP BY u.id, us.current_day;
```

**Activity Summary:**
```sql
SELECT
  week_start,
  challenges_joined,
  predictions_count,
  correct_predictions,
  total_weekly_xp
FROM user_activity_logs
WHERE user_id = 'YOUR_USER_ID'
ORDER BY week_start DESC;
```

---

## ✅ CHECKLIST FINALE

Avant de marquer un feature comme testé:

- [ ] Tous les tests passent
- [ ] DB vérifiée manuellement
- [ ] Logs console propres (pas d'erreurs)
- [ ] UI responsive et fonctionnelle
- [ ] Edge cases testés (deadlines, permissions, etc.)
- [ ] Real-time features fonctionnent
- [ ] Transactions coin/ticket correctes

---

**Date de création:** 2025-11-09
**Dernière mise à jour:** 2025-11-09
**Statut global:** 🟡 En cours de test
