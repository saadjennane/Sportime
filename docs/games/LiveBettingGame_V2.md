# 🎯 Live Betting Game V2 - Design Document

**Version:** 2.0
**Last Updated:** December 13, 2025
**Status:** Design Approved

---

## 🧠 Concept Overview

Le **Live Betting Game** est un mode de jeu compétitif en temps réel où les joueurs misent avec des **coins virtuels** sur des marchés de paris avant et pendant un match de football.

### Simplifications V2

| Aspect | V1 | V2 |
|--------|----|----|
| Balances | 1000 pré-match + 1000 live séparés | **Balance unique** = Entry |
| Marchés | Pré-match ET live séparés | Pré-match ET live, **même balance** |
| Entry cost | 2000 coins fixe | **500-25000** selon niveau Sportime |
| Scaling | Fixe | **Selon niveau** (Rookie → GOAT) |
| Slots | Illimité | **2-∞ jeux simultanés** selon niveau |
| Social | Non | **Jeu entre amis** (compte comme 1 slot) |

---

## 🎮 Modes de Jeu

### Mode Free (Gratuit)

| Aspect | Détail |
|--------|--------|
| Entry cost | 0 coins |
| Balance | 1000 coins virtuels |
| Gains | Non transférables |
| Récompenses | Tickets, Spinwheel, XP |

**Récompenses selon participation:**

| Joueurs | Récompense |
|---------|------------|
| < 10 | Top 3 récompensés |
| 10-49 | Top 10 récompensés |
| 50+ | Top 50 récompensés |

### Mode Ranked (Payant)

| Aspect | Détail |
|--------|--------|
| Entry cost | 1000 coins (base) |
| Balance | = Entry cost |
| Gains | 100% au joueur |
| Scaling | Selon niveau |

**Entry Scaling par Niveau Sportime:**

| Niveau | XP Requis | Entry Max | Slots Live |
|--------|-----------|-----------|------------|
| 🥉 **Rookie** | 0-99 | 500 | 2 |
| ⭐ **Rising Star** | 100-499 | 1000 | 3 |
| 🏅 **Pro** | 500-1499 | 2000 | 4 |
| 💎 **Elite** | 1500-3999 | 5000 | 5 |
| 🏆 **Legend** | 4000-9999 | 10000 | 6 |
| 👑 **Master** | 10000-24999 | 25000 | 8 |
| 🐐 **GOAT** | 25000+ | ∞ | ∞ |

**Règles des Slots:**
- Chaque jeu Live (Free, Ranked, ou Amis) = 1 slot
- Un joueur peut mixer Free + Ranked + Amis selon ses slots
- Exemple Rookie (2 slots): 1 Free public + 1 jeu amis ✅

---

## 📊 Catégories de Marchés

### 6 Catégories Actives

| Catégorie | Description | API Market IDs |
|-----------|-------------|----------------|
| **Result** | Résultat final, mi-temps | 59, 19, 35, 48, 72, 64 |
| **Goals** | Over/Under, BTTS | 36, 24, 69, 30, 25 |
| **Scorers** | Prochain but (équipe/joueur) | 73, 84, 63, 46 |
| **Cards** | Cartons jaunes/rouges | 119, 210, 203, 115 |
| **Quick** | Actions 1-5 min | 116, 117 |
| **Special** | Prolongations, penalties | 10, 107, 8, 81 |

### Règles de Paris

- **Max 3 paris par marché** (permet hedging/doubling)
- **Mise min:** 50 coins
- **Mise max:** 500 coins par pari
- **Délai confirmation:** 8 secondes (anti-cheat)

---

## 🛡️ Système Anti-Triche

### 1. Délai de Confirmation (8s)

```
[Pari placé] → [8s attente] → [Pari confirmé]
              ↓
    [Événement pendant délai] → [Pari annulé]
```

### 2. Lockout sur Événements

| Événement | Lockout | Marchés affectés |
|-----------|---------|------------------|
| But | 15s | Goals, Scorers, Result |
| Carton rouge | 10s | Cards, Result |
| Penalty | 20s | Goals, Scorers, Special |
| VAR | 30s | Tous |

### 3. Validation Timestamp Cotes

- Cotes doivent être < 5s pour être valides
- Sinon: refresh obligatoire avant pari

---

## 💰 Flux Économique

### Mode Free

```
Joueur → Joue gratuitement (1000 coins virtuels)
       → Classement final
       → Top X reçoivent récompenses (tickets, spins, XP)
       → Coins virtuels disparaissent
```

### Mode Ranked

```
Joueur → Vérifie slots disponibles (selon niveau)
       → Paie entry (500-25000 coins selon niveau)
       → Reçoit balance = entry
       → Mise sur marchés pré-match et live
       → Gains immédiats sur paris résolus
       → Match terminé: garde 100% des gains
       → Slot libéré pour prochain jeu
```

**Exemple Ranked:**
- Entry: 1000 coins
- Balance: 1000 coins
- Pari 200 @ 2.5 → Gagné → +500 coins
- Balance: 1300 coins
- Pari 300 @ 1.8 → Perdu → -300 coins
- Balance finale: 1000 coins
- Gain net: 0 (récupère mise)

---

## 👥 Jeu Entre Amis

### Création

1. Hôte sélectionne un match
2. Choix du mode: Free ou Ranked
3. Génère un code de partie
4. Partage le code aux amis

### Participation

1. Ami entre le code
2. Rejoint la partie
3. Paie entry si Ranked
4. Joue normalement

### Classement

- Leaderboard privé (amis uniquement)
- Même règles que mode public
- Option: "Winner takes all" (Ranked)

---

## 🔄 Cycle de Vie d'un Pari

```
PENDING → CONFIRMING → CONFIRMED → RESOLVED
   ↓          ↓
 VOID      VOIDED (événement pendant délai)
```

### États

| État | Description |
|------|-------------|
| `pending` | Pari soumis, attente validation |
| `confirming` | Dans le délai de 8s |
| `confirmed` | Pari accepté |
| `voided` | Annulé (événement pendant délai) |
| `won` | Résolu gagnant |
| `lost` | Résolu perdant |

---

## 📐 Architecture Technique

### Tables Supabase

```sql
-- Jeu Live
CREATE TABLE live_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id UUID REFERENCES fb_fixtures(id),
  mode TEXT NOT NULL CHECK (mode IN ('free', 'ranked')),
  entry_cost INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'upcoming',
  friend_code TEXT UNIQUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Participations
CREATE TABLE live_game_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_game_id UUID REFERENCES live_games(id),
  user_id UUID REFERENCES auth.users(id),
  balance INT NOT NULL,
  total_gains INT DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(live_game_id, user_id)
);

-- Paris
CREATE TABLE live_game_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID REFERENCES live_game_entries(id),
  category TEXT NOT NULL,
  market_id INT NOT NULL,
  market_name TEXT NOT NULL,
  choice TEXT NOT NULL,
  choice_label TEXT NOT NULL,
  amount INT NOT NULL,
  odds DECIMAL(5,2) NOT NULL,
  placed_at_minute INT,
  placed_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  gain INT
);

-- Index pour performance
CREATE INDEX idx_live_games_fixture ON live_games(fixture_id);
CREATE INDEX idx_live_games_friend_code ON live_games(friend_code);
CREATE INDEX idx_live_game_entries_user ON live_game_entries(user_id);
CREATE INDEX idx_live_game_bets_entry ON live_game_bets(entry_id);
CREATE INDEX idx_live_game_bets_status ON live_game_bets(status);

-- =============================================
-- CONFIGURATION ADMINISTRABLE
-- =============================================

-- Limites par niveau (administrable)
CREATE TABLE live_game_level_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level_name TEXT NOT NULL UNIQUE,  -- 'rookie', 'rising_star', 'pro', etc.
  level_order INT NOT NULL,          -- Pour le tri (1, 2, 3...)
  min_xp INT NOT NULL,
  max_xp INT,                        -- NULL = illimité (GOAT)
  entry_max INT,                     -- NULL = illimité
  slots_max INT,                     -- NULL = illimité
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Valeurs par défaut
INSERT INTO live_game_level_config (level_name, level_order, min_xp, max_xp, entry_max, slots_max) VALUES
  ('rookie', 1, 0, 99, 500, 2),
  ('rising_star', 2, 100, 499, 1000, 3),
  ('pro', 3, 500, 1499, 2000, 4),
  ('elite', 4, 1500, 3999, 5000, 5),
  ('legend', 5, 4000, 9999, 10000, 6),
  ('master', 6, 10000, 24999, 25000, 8),
  ('goat', 7, 25000, NULL, NULL, NULL);

-- Récompenses Free Mode (administrable)
CREATE TABLE live_game_free_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_players INT NOT NULL,          -- Seuil minimum de joueurs
  max_players INT,                   -- Seuil maximum (NULL = illimité)
  top_x INT NOT NULL,                -- Nombre de joueurs récompensés
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Valeurs par défaut
INSERT INTO live_game_free_rewards (min_players, max_players, top_x) VALUES
  (1, 9, 3),      -- < 10 joueurs: Top 3
  (10, 49, 10),   -- 10-49 joueurs: Top 10
  (50, NULL, 50); -- 50+ joueurs: Top 50

-- Détail des récompenses par rang
CREATE TABLE live_game_reward_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  free_reward_id UUID REFERENCES live_game_free_rewards(id) ON DELETE CASCADE,
  rank INT NOT NULL,                 -- 1, 2, 3...
  reward_type TEXT NOT NULL,         -- 'coins', 'xp', 'ticket', 'spin'
  reward_amount INT NOT NULL,
  reward_tier TEXT,                  -- Pour tickets/spins: 'amateur', 'master', 'apex'
  UNIQUE(free_reward_id, rank, reward_type)
);

-- Exemple: récompenses pour < 10 joueurs
-- INSERT INTO live_game_reward_tiers (free_reward_id, rank, reward_type, reward_amount, reward_tier) VALUES
--   ('uuid-top3', 1, 'xp', 500, NULL),
--   ('uuid-top3', 1, 'ticket', 1, 'master'),
--   ('uuid-top3', 2, 'xp', 300, NULL),
--   ('uuid-top3', 2, 'spin', 1, 'amateur'),
--   ('uuid-top3', 3, 'xp', 100, NULL);
```

### Types TypeScript

```typescript
type LiveGameMode = 'free' | 'ranked';
type BetCategory = 'result' | 'goals' | 'scorers' | 'cards' | 'quick' | 'special';
type BetStatus = 'pending' | 'confirming' | 'confirmed' | 'voided' | 'won' | 'lost';
type RewardType = 'coins' | 'xp' | 'ticket' | 'spin';
type RewardTier = 'amateur' | 'master' | 'apex';

// Configuration administrable
interface LevelConfig {
  id: string;
  levelName: string;
  levelOrder: number;
  minXp: number;
  maxXp: number | null;
  entryMax: number | null;
  slotsMax: number | null;
  isActive: boolean;
}

interface FreeRewardConfig {
  id: string;
  minPlayers: number;
  maxPlayers: number | null;
  topX: number;
  isActive: boolean;
  tiers: RewardTierConfig[];
}

interface RewardTierConfig {
  rank: number;
  rewardType: RewardType;
  rewardAmount: number;
  rewardTier?: RewardTier;
}

interface LiveGame {
  id: string;
  fixtureId: string;
  mode: LiveGameMode;
  entryCost: number;
  status: 'upcoming' | 'live' | 'finished';
  friendCode?: string;
  createdBy?: string;
  players: number;
}

interface LiveGameEntry {
  id: string;
  liveGameId: string;
  userId: string;
  balance: number;
  totalGains: number;
  bets: LiveGameBet[];
}

interface LiveGameBet {
  id: string;
  category: BetCategory;
  marketId: number;
  marketName: string;
  choice: string;
  choiceLabel: string;
  amount: number;
  odds: number;
  placedAtMinute?: number;
  placedAt: Date;
  confirmedAt?: Date;
  status: BetStatus;
  gain?: number;
}
```

### Services

```typescript
// liveGameService.ts
export const liveGameService = {
  // Création
  createGame(fixtureId: string, mode: LiveGameMode, entryCost?: number),
  createFriendGame(fixtureId: string, mode: LiveGameMode, entryCost?: number),
  joinByCode(code: string),

  // Paris
  placeBet(entryId: string, bet: PlaceBetRequest),
  confirmBet(betId: string),
  voidBet(betId: string, reason: string),

  // Résolution
  resolveBet(betId: string, won: boolean),
  resolveAllBetsForMarket(marketId: number, winningChoice: string),

  // Queries
  getGameByFixture(fixtureId: string),
  getEntry(gameId: string, userId: string),
  getLeaderboard(gameId: string),
  getAvailableMarkets(fixtureId: string, minute: number),
};

// liveGameConfigService.ts (Admin)
export const liveGameConfigService = {
  // Level Config
  getLevelConfigs(): Promise<LevelConfig[]>,
  updateLevelConfig(id: string, config: Partial<LevelConfig>),
  getLevelForXp(xp: number): Promise<LevelConfig>,

  // Free Rewards Config
  getFreeRewardConfigs(): Promise<FreeRewardConfig[]>,
  updateFreeRewardConfig(id: string, config: Partial<FreeRewardConfig>),
  addRewardTier(freeRewardId: string, tier: RewardTierConfig),
  removeRewardTier(freeRewardId: string, rank: number, type: RewardType),

  // Helpers
  getRewardsForPlayerCount(count: number): Promise<FreeRewardConfig>,
  getUserLimits(userId: string): Promise<{ entryMax: number; slotsMax: number; slotsUsed: number }>,
};
```

---

## 🔧 Administration (Dashboard)

### Page: Live Game Config

L'admin peut modifier en temps réel les paramètres du jeu.

#### Onglet: Limites par Niveau

| Colonne | Éditable | Description |
|---------|----------|-------------|
| Niveau | ❌ | Nom du niveau (Rookie, Pro...) |
| XP Min | ✅ | XP minimum pour ce niveau |
| XP Max | ✅ | XP maximum (vide = illimité) |
| Entry Max | ✅ | Mise maximale autorisée |
| Slots Max | ✅ | Jeux simultanés autorisés |
| Actif | ✅ | Toggle on/off |

**Actions:**
- Bouton "Réinitialiser par défaut"
- Sauvegarde automatique à chaque modification

#### Onglet: Récompenses Free Mode

**Section 1: Seuils de participation**

| Seuil | Top X | Actions |
|-------|-------|---------|
| 1-9 joueurs | Top 3 | Éditer / Supprimer |
| 10-49 joueurs | Top 10 | Éditer / Supprimer |
| 50+ joueurs | Top 50 | Éditer / Supprimer |

Bouton "+ Ajouter un seuil"

**Section 2: Détail des récompenses (par seuil sélectionné)**

| Rang | Type | Montant | Tier | Actions |
|------|------|---------|------|---------|
| 1 | XP | 500 | - | ✏️ 🗑️ |
| 1 | Ticket | 1 | Master | ✏️ 🗑️ |
| 2 | XP | 300 | - | ✏️ 🗑️ |
| 2 | Spin | 1 | Amateur | ✏️ 🗑️ |
| 3 | XP | 100 | - | ✏️ 🗑️ |

Bouton "+ Ajouter une récompense"

### Composant Admin React

```tsx
// apps/admin/src/pages/LiveGameConfigPage.tsx
const LiveGameConfigPage = () => {
  const [levelConfigs, setLevelConfigs] = useState<LevelConfig[]>([]);
  const [rewardConfigs, setRewardConfigs] = useState<FreeRewardConfig[]>([]);
  const [selectedRewardId, setSelectedRewardId] = useState<string | null>(null);

  // CRUD operations via liveGameConfigService
  // ...
};
```

---

## 📱 UI/UX Flow

### Pre-Match

1. **Liste des jeux** → Sélectionne un match avec Live Betting
2. **Entry screen** → Choix Free/Ranked, paiement si nécessaire
3. **Marchés pré-match** → Result, Goals, Scorers disponibles
4. **Place paris** → 8s confirmation, feedback visuel

### Live

1. **Score live** → En-tête avec score temps réel
2. **Marchés dynamiques** → Apparaissent/disparaissent selon événements
3. **Lockout indicators** → Timer visible quand marché verrouillé
4. **Gains en temps réel** → Balance mise à jour instantanément

### Post-Match

1. **Résolution auto** → Tous les paris résolus
2. **Leaderboard final** → Classement par gains totaux
3. **Récompenses** → Distribution selon mode
4. **Récap personnel** → Historique de tous les paris

---

## 🚀 Plan d'Implémentation

### Phase 1: Core (2-3 jours)
- [ ] Tables Supabase
- [ ] Types TypeScript
- [ ] Service de base (create, join, bet)

### Phase 2: Anti-Cheat (1-2 jours)
- [ ] Délai 8s avec timer
- [ ] Lockout sur événements
- [ ] Validation timestamp cotes

### Phase 3: UI (2-3 jours)
- [ ] Écran d'entrée
- [ ] Liste des marchés
- [ ] Placement de pari avec feedback
- [ ] Leaderboard temps réel

### Phase 4: Social (1 jour)
- [ ] Génération code ami
- [ ] Join par code
- [ ] Leaderboard privé

### Phase 5: Polish (1 jour)
- [ ] Animations
- [ ] Notifications
- [ ] Tests E2E

---

## 📝 Notes de Design

### Pourquoi balance unique (pas pré-match/live séparés)?

1. **Simplicité** - Pas de confusion entre balances
2. **Rapidité** - Moins de calculs, UX fluide
3. **Accessibilité** - Entry cost abordable

### Pourquoi max 3 paris par marché?

1. **Stratégie** - Permet hedging et doubling
2. **Contrôle** - Évite spam et manipulation
3. **Équilibre** - Risque vs récompense

### Pourquoi 8s de délai?

1. **Anti-courtsiding** - TV souvent 5-10s en avance
2. **Équitable** - Même délai pour tous
3. **UX acceptable** - Assez court pour rester engageant

### Pourquoi des slots limités par niveau?

1. **Progression** - Récompense les joueurs fidèles
2. **Anti-abus** - Limite le multi-accounting
3. **Équilibre économique** - Les débutants ne peuvent pas tout miser partout
4. **Engagement** - Incite à monter de niveau

### Cas d'usage des slots

| Joueur | Niveau | Slots | Utilisation possible |
|--------|--------|-------|----------------------|
| Débutant | Rookie | 2 | 1 Free + 1 Ranked |
| Régulier | Pro | 4 | 2 Ranked + 1 Free + 1 Amis |
| Hardcore | GOAT | ∞ | Tous les matchs qu'il veut |
