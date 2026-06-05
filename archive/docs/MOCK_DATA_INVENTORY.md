# 📦 Mock Data Inventory - Fonctionnalités Non-Migrées

Inventaire complet des fonctionnalités encore en mock data et roadmap de migration vers Supabase.

---

## 🎯 RÉSUMÉ EXÉCUTIF

### Statut Global de Migration

| Catégorie | Supabase ✅ | Mock Data ❌ | Hybride ⚠️ | Total |
|-----------|------------|-------------|-----------|-------|
| **Core Features** | 7 | 0 | 0 | 7 |
| **Games & Betting** | 3 | 2 | 1 | 6 |
| **Social & Community** | 1 | 2 | 0 | 3 |
| **Supporting** | 5 | 2 | 1 | 8 |
| **TOTAL** | **16 (67%)** | **6 (25%)** | **2 (8%)** | **24** |

### Fonctionnalités Complètement Migrées ✅

1. ✅ **Daily Streaks** - Supabase `user_streaks`
2. ✅ **Challenge Betting** - Supabase `challenges`, `challenge_bets`, etc.
3. ✅ **Squads (ex-Leagues)** - Supabase `squads`, `squad_members`
4. ✅ **Notifications** - Supabase + OneSignal
5. ✅ **Progression System** - Supabase `users`, `badges`, `user_activity_logs`
6. ✅ **Swipe Predictions** - Supabase `swipe_predictions`, `matchday_participants`
7. ✅ **Matches Page** - Supabase `fixtures`, `leagues`, `teams`
8. ✅ **Coin Transactions** - Supabase `coin_transactions`
9. ✅ **Tickets System** - Supabase `user_tickets`
10. ✅ **Prize Distribution** - Supabase automated
11. ✅ **User Authentication** - Supabase Auth
12. ✅ **Leaderboards** - Supabase `challenge_participants`
13. ✅ **Real-time Fixtures Data** - Supabase `fixtures` synced from API
14. ✅ **Weekly XP Automation** - Supabase Edge Functions
15. ✅ **Badge Awards** - Supabase Edge Functions
16. ✅ **Activity Tracking** - Supabase `user_activity_logs`

---

## 🔴 FONCTIONNALITÉS ENCORE EN MOCK DATA

### 1. 🎮 FANTASY GAMES SYSTEM

**Priorité:** 🔴 HIGH
**Complexité:** 🟠 High (4-6 semaines)
**Statut Supabase:** ✅ Tables existent mais UI utilise mock data

#### Fichiers Mock Actuels
- `src/data/mockFantasy.ts` - Player database, teams
- `src/data/mockPlayerStats.ts` - Gameweek statistics
- `src/data/mockFantasyLive.tsx` - Live boosters

#### Utilisation Actuelle
```typescript
// src/pages/FantasyGameWeekPage.tsx
import { mockFantasyPlayers, mockUserFantasyTeams } from '../data/mockFantasy.tsx';
import { mockPlayerGameWeekStats } from '../data/mockPlayerStats';
```

#### Tables Supabase Existantes ✅
```sql
-- Depuis migration 20250606000002_fantasy_module.sql
fantasy_players          -- Player database
fantasy_gameweeks        -- Weekly periods
fantasy_teams            -- User fantasy teams
fantasy_team_players     -- Team composition
fantasy_player_stats     -- Performance stats
fantasy_live_boosters    -- Booster system
```

#### Ce Qui Manque
1. **Populate Data** - Tables vides, besoin de seed data
2. **Service Layer** - `fantasyService.ts` utilise encore mock
3. **UI Integration** - Pages Fantasy lisent mock au lieu de Supabase
4. **Auto Scoring** - Edge Function pour calculer points automatiquement
5. **Player Stats Sync** - Sync stats depuis API-Football

#### Path de Migration

**Phase 1: Data Population (1 semaine)**
```sql
-- Peupler fantasy_players avec vrais joueurs
INSERT INTO fantasy_players (...)
SELECT ... FROM players; -- Depuis table players existante

-- Créer gameweeks pour la saison
INSERT INTO fantasy_gameweeks (...);
```

**Phase 2: Service Layer (1 semaine)**
```typescript
// src/services/fantasyService.ts
// Remplacer mock queries par Supabase
export async function getFantasyPlayers() {
  const { data } = await supabase
    .from('fantasy_players')
    .select('*');
  return data;
}
```

**Phase 3: UI Migration (2 semaines)**
- Mettre à jour `FantasyGameWeekPage.tsx`
- Créer hook `useFantasyGameWeek.ts`
- Migrer team selection vers Supabase
- Real-time scoring updates

**Phase 4: Automation (1 semaine)**
- Edge Function `calculate-fantasy-points`
- Cron job pour updates hebdomadaires
- Sync player stats depuis API

#### Estimation
- **Temps:** 4-6 semaines
- **Difficulté:** Moyenne-Haute
- **Bloqueurs:** Besoin d'API-Football player stats

---

### 2. 🎰 LIVE GAMES (Real-time Prediction/Betting)

**Priorité:** 🟡 MEDIUM
**Complexité:** 🔴 Very High (6-8 semaines)
**Statut Supabase:** ❌ Aucune table n'existe

#### Fichiers Mock Actuels
- `src/data/mockLiveGames.ts` - Active game sessions
- `src/data/mockLiveGameMarkets.ts` - Betting markets
- `src/data/mockLiveGameTypes.ts` - Game templates
- `src/data/marketTemplates.ts` - Market definitions

#### Utilisation Actuelle
```typescript
// src/pages/live-game/*
// Tous les Live Game pages utilisent mock store
import { mockLiveGames } from '../data/mockLiveGames';
```

#### Complexité Technique
- **Real-time State Management** - Besoin de Supabase Realtime
- **Market Generation** - Logique complexe pour créer markets dynamiquement
- **Betting Logic** - Validation, deadlines, payouts en temps réel
- **PIN System** - Sessions privées avec codes PIN
- **Bonus Questions** - Système de questions dynamiques

#### Tables Nécessaires
```sql
-- Migration à créer
CREATE TABLE live_game_sessions (
  id UUID PRIMARY KEY,
  match_id UUID REFERENCES fixtures(id),
  host_user_id UUID REFERENCES users(id),
  pin_code TEXT UNIQUE,
  status TEXT, -- 'waiting', 'active', 'finished'
  created_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

CREATE TABLE live_game_participants (
  session_id UUID REFERENCES live_game_sessions(id),
  user_id UUID REFERENCES users(id),
  joined_at TIMESTAMPTZ,
  points INTEGER,
  rank INTEGER
);

CREATE TABLE live_game_markets (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES live_game_sessions(id),
  market_type TEXT, -- 'next_goal', 'corners', 'cards', etc.
  question TEXT,
  options JSONB,
  deadline TIMESTAMPTZ,
  result TEXT,
  created_at TIMESTAMPTZ
);

CREATE TABLE live_game_predictions (
  id UUID PRIMARY KEY,
  market_id UUID REFERENCES live_game_markets(id),
  user_id UUID REFERENCES users(id),
  selected_option TEXT,
  is_correct BOOLEAN,
  points_earned INTEGER,
  created_at TIMESTAMPTZ
);

CREATE TABLE live_game_bets (
  id UUID PRIMARY KEY,
  market_id UUID REFERENCES live_game_markets(id),
  user_id UUID REFERENCES users(id),
  bet_amount INTEGER,
  selected_option TEXT,
  odds DECIMAL,
  payout INTEGER,
  is_won BOOLEAN,
  created_at TIMESTAMPTZ
);
```

#### Path de Migration

**Phase 1: Database Schema (2 semaines)**
- Créer toutes les tables
- Définir RLS policies
- Indexes pour performance
- Triggers pour auto-updates

**Phase 2: Edge Functions (2 semaines)**
```typescript
// supabase/functions/create-live-game/index.ts
// Create session, generate PIN, setup markets

// supabase/functions/join-live-game/index.ts
// Join with PIN, add participant

// supabase/functions/generate-markets/index.ts
// Auto-generate markets based on match state

// supabase/functions/resolve-market/index.ts
// Resolve market, calculate payouts
```

**Phase 3: Real-time Integration (2 semaines)**
```typescript
// src/hooks/useLiveGameSession.ts
const channel = supabase
  .channel(`live-game:${sessionId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'live_game_markets'
  }, (payload) => {
    // New market available
  })
  .subscribe();
```

**Phase 4: UI Migration (2 semaines)**
- Refactor all Live Game pages
- Replace mock store with Supabase hooks
- Real-time market updates
- Leaderboard updates

#### Estimation
- **Temps:** 6-8 semaines
- **Difficulté:** Très Haute
- **Bloqueurs:** Besoin de match state API (goals, cards, corners en temps réel)

---

### 3. 🎯 FUN ZONE (Mini-Games)

**Priorité:** 🟢 LOW
**Complexité:** 🟡 Medium (3-4 semaines)
**Statut Supabase:** ❌ Aucune table

#### Fichiers Mock Actuels
- `src/data/mockFunZone.ts` - Game definitions, rewards
- `src/components/funzone/*` - Game components

#### Mini-Games Actuels
1. **Guess the Player** - Deviner joueur avec indices
2. **Tic-Tac-Foot** - Grille avec équipes/pays
3. **Formation Builder** - Créer formation tactique
4. **Quick Quiz** - Questions football rapides

#### Tables Nécessaires
```sql
CREATE TABLE fun_zone_games (
  id UUID PRIMARY KEY,
  game_type TEXT, -- 'guess_player', 'tic_tac_foot', etc.
  title TEXT,
  description TEXT,
  difficulty TEXT,
  reward_coins INTEGER,
  created_at TIMESTAMPTZ
);

CREATE TABLE user_fun_zone_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  game_id UUID REFERENCES fun_zone_games(id),
  score INTEGER,
  time_taken INTEGER,
  is_completed BOOLEAN,
  reward_claimed BOOLEAN,
  created_at TIMESTAMPTZ
);

CREATE TABLE fun_zone_leaderboards (
  game_id UUID REFERENCES fun_zone_games(id),
  user_id UUID REFERENCES users(id),
  best_score INTEGER,
  total_plays INTEGER,
  avg_score DECIMAL
);
```

#### Path de Migration
**Phase 1:** Créer schema + RLS (1 semaine)
**Phase 2:** Migrer game logic vers Supabase (2 semaines)
**Phase 3:** Leaderboards + rewards integration (1 semaine)

#### Estimation
- **Temps:** 3-4 semaines
- **Difficulté:** Moyenne

---

### 4. 👥 SOCIAL PLAYER GRAPH

**Priorité:** 🟢 LOW
**Complexité:** 🟡 Medium (2-3 semaines)
**Statut Supabase:** ❌ Aucune table

#### Fichiers Mock Actuels
- `src/data/mockPlayerGraph.ts` - Social connections

#### Utilisation Actuelle
```typescript
// src/store/useMockStore.ts
playerGraph: mockPlayerGraph,
incrementInteraction(user1Id, user2Id) { ... }
```

#### Fonctionnalités
- **Friend Recommendations** - Basé sur interactions
- **Player Interactions** - Track qui joue avec qui
- **Mutual Squads** - Squads en commun

#### Tables Nécessaires
```sql
CREATE TABLE user_follows (
  follower_id UUID REFERENCES users(id),
  following_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ,
  PRIMARY KEY (follower_id, following_id)
);

CREATE TABLE user_interactions (
  user1_id UUID REFERENCES users(id),
  user2_id UUID REFERENCES users(id),
  interaction_type TEXT, -- 'played_together', 'same_squad', etc.
  interaction_count INTEGER,
  last_interaction TIMESTAMPTZ,
  PRIMARY KEY (user1_id, user2_id)
);

CREATE VIEW friend_recommendations AS
SELECT ... -- Based on mutual squads, interactions, etc.
```

#### Path de Migration
**Phase 1:** Schema + indexes (1 semaine)
**Phase 2:** Service layer + hooks (1 semaine)
**Phase 3:** UI components (1 semaine)

#### Estimation
- **Temps:** 2-3 semaines
- **Difficulté:** Moyenne

---

### 5. 📊 PROFILE STATISTICS AGGREGATION

**Priorité:** 🟡 MEDIUM
**Complexité:** 🟢 Low (1 semaine)
**Statut Supabase:** ✅ Data exists, need aggregation

#### Fichiers Mock Actuels
- `src/data/mockProfileStats.ts`

#### Données Déjà Disponibles ✅
```sql
-- Données dispersées dans plusieurs tables
SELECT
  COUNT(DISTINCT cp.challenge_id) as challenges_joined,
  COUNT(cb.id) as total_bets,
  SUM(CASE WHEN cb.is_correct THEN 1 ELSE 0 END) as correct_bets,
  u.total_xp,
  u.level
FROM users u
LEFT JOIN challenge_participants cp ON u.id = cp.user_id
LEFT JOIN challenge_bets cb ON u.id = cb.user_id
WHERE u.id = 'USER_ID';
```

#### Solution Simple
**Créer une Vue SQL:**
```sql
CREATE VIEW user_statistics AS
SELECT
  u.id as user_id,
  u.username,
  u.level,
  u.total_xp,
  COUNT(DISTINCT cp.challenge_id) as challenges_joined,
  COUNT(DISTINCT cb.id) as total_predictions,
  SUM(CASE WHEN cb.is_correct THEN 1 ELSE 0 END) as correct_predictions,
  ROUND(100.0 * SUM(CASE WHEN cb.is_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(cb.id), 0), 2) as accuracy,
  COUNT(DISTINCT ub.badge_id) as badges_count,
  cp_stats.avg_rank as average_rank
FROM users u
LEFT JOIN challenge_participants cp ON u.id = cp.user_id
LEFT JOIN challenge_bets cb ON u.id = cb.user_id
LEFT JOIN user_badges ub ON u.id = ub.user_id
LEFT JOIN (
  SELECT user_id, AVG(rank) as avg_rank
  FROM challenge_participants
  GROUP BY user_id
) cp_stats ON u.id = cp_stats.user_id
GROUP BY u.id, u.username, u.level, u.total_xp, cp_stats.avg_rank;
```

**Ensuite:**
```typescript
// src/services/profileService.ts
export async function getUserStatistics(userId: string) {
  const { data } = await supabase
    .from('user_statistics')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data;
}
```

#### Path de Migration
**Phase 1:** Créer view SQL (1 jour)
**Phase 2:** Update ProfilePage.tsx (2 jours)
**Phase 3:** Remove mockProfileStats (1 jour)

#### Estimation
- **Temps:** 1 semaine
- **Difficulté:** Faible

---

### 6. 🌍 ONBOARDING DATA (Countries/Teams)

**Priorité:** 🟡 MEDIUM
**Complexité:** 🟢 Low (1 semaine)
**Statut Supabase:** ⚠️ Partial (user data saved, selection data mock)

#### Fichiers Mock Actuels
- `src/data/mockCountries.ts` - Country/team selection data
- `src/data/mockOnboarding.ts` - Onboarding flow content

#### Utilisation Actuelle
```typescript
// src/pages/onboarding/TeamSelectionStep.tsx
import { mockCountries } from '../../data/mockCountries';
```

#### Solution
**Créer Tables:**
```sql
CREATE TABLE countries (
  id UUID PRIMARY KEY,
  name TEXT,
  code TEXT, -- 'FRA', 'ENG', etc.
  flag_url TEXT,
  region TEXT -- 'Europe', 'Africa', etc.
);

CREATE TABLE national_teams (
  id UUID PRIMARY KEY,
  country_id UUID REFERENCES countries(id),
  name TEXT,
  logo_url TEXT,
  fifa_rank INTEGER
);

CREATE TABLE club_teams (
  id UUID PRIMARY KEY,
  name TEXT,
  logo_url TEXT,
  league_id UUID REFERENCES leagues(id),
  country_id UUID REFERENCES countries(id)
);
```

**Seed Data:**
```sql
INSERT INTO countries (name, code, flag_url, region)
VALUES
  ('France', 'FRA', 'https://...', 'Europe'),
  ('England', 'ENG', 'https://...', 'Europe'),
  -- etc.
```

#### Path de Migration
**Phase 1:** Create tables + seed data (2 jours)
**Phase 2:** Update TeamSelectionStep (2 jours)
**Phase 3:** Keep mock as fallback (1 jour)

#### Estimation
- **Temps:** 1 semaine
- **Difficulté:** Faible

---

## 📊 TABLEAU RÉCAPITULATIF DE MIGRATION

| # | Feature | Mock Files | Supabase Status | Priority | Complexity | Estimated Time | Blockers |
|---|---------|-----------|----------------|----------|-----------|----------------|----------|
| 1 | **Fantasy Games** | mockFantasy.ts, mockPlayerStats.ts | ✅ Tables exist | 🔴 HIGH | 🟠 High | 4-6 weeks | API player stats |
| 2 | **Live Games** | mockLiveGames.ts, mockLiveGameMarkets.ts | ❌ No tables | 🟡 MEDIUM | 🔴 Very High | 6-8 weeks | Real-time match API |
| 3 | **Profile Stats** | mockProfileStats.ts | ✅ Data exists | 🟡 MEDIUM | 🟢 Low | 1 week | None |
| 4 | **Onboarding** | mockCountries.ts, mockOnboarding.ts | ⚠️ Partial | 🟡 MEDIUM | 🟢 Low | 1 week | None |
| 5 | **Fun Zone** | mockFunZone.ts | ❌ No tables | 🟢 LOW | 🟡 Medium | 3-4 weeks | None |
| 6 | **Social Graph** | mockPlayerGraph.ts | ❌ No tables | 🟢 LOW | 🟡 Medium | 2-3 weeks | None |

---

## 🗺️ ROADMAP DE MIGRATION

### Phase 1: Quick Wins (3 semaines) 🎯

**Objectif:** Migrer les features simples pour gains rapides

**Semaine 1-2: Profile Stats**
- Créer vue SQL `user_statistics`
- Update ProfilePage.tsx
- Remove mockProfileStats
- **Impact:** Stats utilisateur en temps réel

**Semaine 2-3: Onboarding Data**
- Créer tables countries/teams
- Seed data
- Update TeamSelectionStep
- **Impact:** Data centralisée, facile à maintenir

**Livrables:**
- ✅ 2 features migrées
- ✅ 0 mock data pour profile & onboarding
- ✅ Meilleure UX avec données réelles

---

### Phase 2: Major Features (6 semaines) 🚀

**Objectif:** Migrer Fantasy (feature complexe mais tables existent)

**Semaine 1-2: Data Population**
- Peupler `fantasy_players` avec vrais joueurs
- Créer gameweeks pour saison en cours
- Seed player stats historiques

**Semaine 3-4: Service Layer + Hooks**
- Refactor `fantasyService.ts` pour Supabase
- Créer `useFantasyGameWeek.ts` hook
- Migrer team selection logic

**Semaine 5-6: UI + Automation**
- Update FantasyGameWeekPage.tsx
- Edge Function `calculate-fantasy-points`
- Real-time scoring updates
- Testing end-to-end

**Livrables:**
- ✅ Fantasy 100% Supabase
- ✅ Auto-scoring hebdomadaire
- ✅ Real-time points updates

---

### Phase 3: Complex Features (12 semaines) 💪

**Objectif:** Migrer Live Games (très complexe)

**Semaine 1-3: Database + Edge Functions**
- Créer toutes les tables Live Games
- Edge Functions pour sessions/markets
- RLS policies et indexes

**Semaine 4-6: Real-time Integration**
- Supabase Realtime channels
- Market generation logic
- Betting validation
- PIN system

**Semaine 7-9: UI Migration**
- Refactor tous les Live Game pages
- Replace mock store
- Real-time leaderboard

**Semaine 10-12: Social + Fun Zone**
- Social Graph tables + logic
- Fun Zone games migration
- Leaderboards integration

**Livrables:**
- ✅ Live Games 100% Supabase
- ✅ Social features
- ✅ Fun Zone games

---

### Phase 4: Cleanup (2 semaines) 🧹

**Objectif:** Supprimer tout le mock data et simplifier le code

**Semaine 1: Remove Mock Files**
```bash
rm src/data/mockFantasy.ts
rm src/data/mockLiveGames.ts
rm src/data/mockProfileStats.ts
rm src/data/mockCountries.ts
rm src/data/mockFunZone.ts
rm src/data/mockPlayerGraph.ts
# etc.
```

**Semaine 2: Store Cleanup**
- Simplifier `useMockStore.ts`
- Migrer vers React Query pour client state
- Remove USE_SUPABASE flag (always true)
- Update documentation

**Livrables:**
- ✅ 0 mock data dans le projet
- ✅ Code simplifié
- ✅ 100% Supabase

---

## 📁 FICHIERS MOCK À SUPPRIMER (LEGACY)

Ces fichiers ne sont plus utilisés car features déjà migrées:

```bash
# SAFE TO DELETE (Already migrated)
src/data/mockNotifications.ts      # ✅ Replaced by Supabase
src/data/mockUserStreaks.ts        # ✅ Replaced by Supabase
src/data/mockTickets.ts            # ✅ Replaced by Supabase
src/data/mockChallenges.ts         # ✅ Replaced by Supabase
src/data/mockUserChallengeEntries.ts # ✅ Replaced by Supabase
src/data/mockLeagues.ts            # ✅ Replaced by Squads in Supabase
src/data/mockUserLeagues.ts        # ✅ Replaced by Supabase
src/data/mockLeagueMembers.ts      # ✅ Replaced by Supabase
src/data/mockLeagueGames.ts        # ✅ Replaced by Supabase
src/data/mockSwipeGames.ts         # ✅ Replaced by Supabase
src/data/mockMatches.ts            # ✅ Replaced by fixtures table
src/data/mockProgression.ts        # ⚠️ Partially (levels config still used)
```

**Action recommandée:** Créer un dossier `_deprecated/` et y déplacer ces fichiers avant suppression définitive.

---

## ⚠️ NOTES IMPORTANTES

### Backward Compatibility
- Garder mock files comme fallback pendant migration
- Flag `USE_SUPABASE` permet de toggle entre mock et Supabase
- Une fois 100% migré, supprimer flag et mocks

### Performance Considerations
- Créer indexes sur toutes les foreign keys
- Views materialized pour aggregations lourdes
- Edge Functions pour calculs complexes côté serveur

### Testing Strategy
Pour chaque feature migrée:
1. ✅ Unit tests des services Supabase
2. ✅ Integration tests des hooks
3. ✅ E2E tests de l'UI
4. ✅ Load testing pour performance
5. ✅ Migration script pour data existante

### Rollback Plan
En cas de problème:
1. Revert flag `USE_SUPABASE = false`
2. Mock data fallback automatique
3. Fix issue en production
4. Re-enable Supabase

---

## 📈 MÉTRIQUES DE SUCCÈS

### Objectifs
- [ ] 100% des features core migrées (Done ✅)
- [ ] 100% des features games migrées
- [ ] 0 fichiers mock* dans src/data/ (sauf config)
- [ ] Performance >= mock data (target: <100ms queries)
- [ ] 0 regressions fonctionnelles

### KPIs à Tracker
- **Migration Progress:** % features migrées
- **Query Performance:** Avg response time Supabase vs Mock
- **Error Rate:** Errors Supabase queries
- **User Impact:** Complaints/bugs post-migration
- **Code Coverage:** % tests passant avec Supabase

---

## 🎯 RECOMMANDATIONS

### Priorité Immédiate (Next Sprint)
1. **Profile Stats** - 1 semaine, low complexity, high impact
2. **Onboarding Data** - 1 semaine, low complexity, better UX

### Priorité Court Terme (Q1 2025)
3. **Fantasy Games** - Tables ready, juste besoin d'UI migration
4. **Social Graph** - Améliore engagement utilisateur

### Priorité Long Terme (Q2 2025)
5. **Live Games** - Feature complexe mais high value
6. **Fun Zone** - Nice to have, pas critique

### Ne Pas Toucher (Keep Mock)
- **Game Templates** (marketTemplates.ts) - Config statique, OK en mock
- **Reward Packs** (BASE_REWARD_PACKS) - Config statique
- **Coin Packs** (COIN_PACKS) - Config statique

---

**Date de création:** 2025-11-09
**Dernière mise à jour:** 2025-11-09
**Statut global:** 🟡 67% migré vers Supabase
**Objectif:** 🎯 100% migration d'ici Q2 2025
