# Challenge Betting Mode - Implementation Guide

**Status:** ✅ Fully Integrated with Supabase
**Last Updated:** July 3, 2025
**Game Type:** Summer Showdown (Multi-day Betting Tournament)

---

## Overview

The Challenge Betting Mode allows users to compete in multi-day betting tournaments. Users pay a one-time entry fee and receive a fixed daily balance to allocate across match predictions. Points are calculated using a **gross gain model** with optional boosters that can multiply gains or impose penalties.

---

## Features Implemented

### ✅ Phase 1: Database Schema
- **Migration 1:** `20250703000000_add_odds_to_bets.sql`
  - Added `odds_snapshot` JSONB column to `challenge_bets` table
  - Captures odds at bet placement time for accurate historical calculations

- **Migration 2:** `20250703000001_fix_x3_penalty.sql`
  - Updated `calculate_bet_points()` function to apply -200 penalty for x3 booster on losing bets
  - Implements gross gain scoring: `points = odds × amount × booster`

- **Migration 3:** `20250703000002_integrate_real_odds.sql`
  - Updated `recalculate_challenge_points()` to fetch real odds from `odds` table
  - Priority: 1) `odds_snapshot` from bet, 2) latest odds from database, 3) default fallback

### ✅ Phase 2: Service Layer
- **`challengeService.ts`** - Added 3 new functions:
  - `addMatchesToChallenge(challengeId, matches)` - Assign fixtures to challenge with day numbers
  - `fetchFixtureOdds(fixtureId)` - Get latest odds for a single fixture
  - `fetchMultipleFixtureOdds(fixtureIds)` - Batch fetch odds for multiple fixtures
  - Updated `buildMatchesFromChallengeMatches()` to use real odds from database

### ✅ Phase 3: Admin Tools
- **`ChallengeMatchSelector.tsx`** - Admin component for adding fixtures to challenges
  - Filter fixtures by date and league
  - Assign fixtures to specific days
  - Batch add multiple matches to a challenge

### ✅ Phase 4: Validation & Security
- **`challengeEntryService.ts`** - Enhanced `saveDailyEntry()` with:
  - **Challenge Status Verification:** Prevents bets on finished/ongoing challenges
  - **Daily Balance Validation:** Ensures total bets don't exceed daily balance
  - **Odds Snapshot Capture:** Automatically saves odds when bet is placed

---

## Scoring System

### Gross Gain Model

| Scenario | Formula | Example (100 coins, 2.0 odds) |
|----------|---------|-------------------------------|
| **Win (no booster)** | `odds × amount` | `2.0 × 100 = 200 points` |
| **Win (x2 booster)** | `(odds × amount) × 2` | `(2.0 × 100) × 2 = 400 points` |
| **Win (x3 booster)** | `(odds × amount) × 3` | `(2.0 × 100) × 3 = 600 points` |
| **Loss (no booster or x2)** | `0` | `0 points` |
| **Loss (x3 booster)** | `-200` | `-200 points (PENALTY)` |

### Key Rules

1. **Daily Balance:** Each day, users receive a fixed amount (default: 1000 coins)
2. **Balance Allocation:** Total bets per day cannot exceed daily balance
3. **Booster Limit:** Only ONE booster (x2 or x3) can be used per day
4. **Bet Locking:** Once challenge status becomes "Ongoing", all bets are locked
5. **Points Calculation:** Triggered automatically when matches finish (via database trigger)

---

## Data Flow

```
User Places Bet
      ↓
  Validation (status, balance)
      ↓
  Fetch Current Odds
      ↓
  Save Bet + Odds Snapshot
      ↓
  (Challenge Starts - Bets Locked)
      ↓
  Matches Finish
      ↓
  Trigger: recalculate_challenge_points()
      ↓
  Calculate Points (using odds_snapshot)
      ↓
  Update Leaderboard
```

---

## How to Create a Betting Challenge (Admin Guide)

### Step 1: Create Challenge via Admin Panel

1. Navigate to **Admin → Challenges**
2. Click **"Create New Game"**
3. Fill in details:
   - **Name:** e.g., "Summer Showdown"
   - **Game Type:** `betting`
   - **Start Date / End Date:** Define tournament duration
   - **Entry Cost:** Coins required to join
   - **Challenge Balance:** Daily balance (e.g., 1000)
   - **Tier:** Amateur / Master / Apex
   - **Duration Type:** Flash / Series / Season
4. Click **"Create Game"**
5. Note the **Challenge ID** from the result

### Step 2: Add Fixtures to Challenge

**Option A: Using ChallengeMatchSelector Component (Recommended)**

```tsx
import { ChallengeMatchSelector } from '../components/admin/ChallengeMatchSelector'

<ChallengeMatchSelector
  challengeId="your-challenge-id"
  totalDays={2}
  onMatchesAdded={() => console.log('Matches added!')}
/>
```

**Option B: Using Service Function Directly**

```typescript
import { addMatchesToChallenge } from '../services/challengeService'

await addMatchesToChallenge('challenge-id', [
  { fixture_id: 'fixture-uuid-1', day_number: 1 },
  { fixture_id: 'fixture-uuid-2', day_number: 1 },
  { fixture_id: 'fixture-uuid-3', day_number: 2 },
  { fixture_id: 'fixture-uuid-4', day_number: 2 },
])
```

**Option C: Direct SQL (Advanced)**

```sql
-- First, get match_id from fixture_id
INSERT INTO challenge_matches (challenge_id, match_id, day_number)
SELECT
  'your-challenge-id',
  m.id,
  1 -- Day number
FROM matches m
WHERE m.fixture_id IN ('fixture-uuid-1', 'fixture-uuid-2');
```

### Step 3: Verify Setup

```sql
-- Check matches are assigned
SELECT
  cm.day_number,
  f.date,
  ht.name AS home_team,
  at.name AS away_team
FROM challenge_matches cm
JOIN matches m ON m.id = cm.match_id
JOIN fixtures f ON f.id = m.fixture_id
JOIN teams ht ON ht.id = f.home_team_id
JOIN teams at ON at.id = f.away_team_id
WHERE cm.challenge_id = 'your-challenge-id'
ORDER BY cm.day_number, f.date;
```

---

## Frontend Integration

### Displaying Challenge Matches with Real Odds

```typescript
import { fetchChallengeMatches } from '../services/challengeService'

const { challenge, matches } = await fetchChallengeMatches('challenge-id')

// matches array now contains real odds from database
matches.forEach(match => {
  console.log(match.teamA.name, 'vs', match.teamB.name)
  console.log('Odds:', match.odds) // { teamA: 2.0, draw: 3.2, teamB: 2.4 }
})
```

### Saving User Bets

```typescript
import { saveDailyEntry } from '../services/challengeEntryService'

try {
  await saveDailyEntry({
    challengeId: 'challenge-id',
    userId: 'user-id',
    day: 1,
    bets: [
      { challengeMatchId: 'match-1', prediction: 'teamA', amount: 500 },
      { challengeMatchId: 'match-2', prediction: 'draw', amount: 500 },
    ],
    booster: { type: 'x3', matchId: 'match-1' },
  })
} catch (error) {
  // Handle validation errors
  console.error(error.message)
  // Possible errors:
  // - "Challenge has started - bets are locked"
  // - "Total bet amount (1200) exceeds daily balance (1000)"
  // - "Cannot place bets on a finished or cancelled challenge"
}
```

---

## Testing

### Test Scenario 1: Create Challenge & Add Matches

```sql
-- 1. Create a test challenge (via Admin UI or SQL)
-- 2. Add fixtures to challenge
SELECT addMatchesToChallenge('challenge-id',
  ARRAY[
    ROW('fixture-1', 1),
    ROW('fixture-2', 1),
    ROW('fixture-3', 2),
    ROW('fixture-4', 2)
  ]::fixture_day_assignment[]
);

-- 3. Verify odds are fetched
SELECT id, odds FROM challenge_matches_with_odds WHERE challenge_id = 'challenge-id';
```

### Test Scenario 2: Place Bets & Calculate Points

```sql
-- 1. User joins challenge
INSERT INTO challenge_entries (id, challenge_id, user_id, entry_method)
VALUES (gen_random_uuid(), 'challenge-id', 'user-id', 'coins');

-- 2. User places bets (use saveDailyEntry() from frontend)

-- 3. Simulate match finish
UPDATE fixtures SET status = 'FT', goals_home = 2, goals_away = 1
WHERE id = 'fixture-1';

-- 4. Trigger points calculation
SELECT recalculate_challenge_points('challenge-id');

-- 5. Check results
SELECT user_id, day_number, points
FROM challenge_daily_entries cde
JOIN challenge_entries ce ON ce.id = cde.challenge_entry_id
WHERE ce.challenge_id = 'challenge-id';
```

---

## Migration Deployment

### Apply Migrations to Supabase

1. Navigate to **Supabase Dashboard → SQL Editor**
2. Apply migrations in order:

```bash
# Migration 1: Add odds_snapshot column
supabase/migrations/20250703000000_add_odds_to_bets.sql

# Migration 2: Fix x3 penalty
supabase/migrations/20250703000001_fix_x3_penalty.sql

# Migration 3: Integrate real odds
supabase/migrations/20250703000002_integrate_real_odds.sql
```

3. Verify migrations succeeded:

```sql
-- Check odds_snapshot column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'challenge_bets' AND column_name = 'odds_snapshot';

-- Test calculate_bet_points function
SELECT calculate_bet_points('teamA', 'teamB', '{"teamA":2.0,"draw":3.2,"teamB":2.4}'::jsonb, 100, true, 'x3');
-- Expected: -200 (x3 penalty on loss)

-- Test recalculate_challenge_points function
SELECT recalculate_challenge_points('test-challenge-id');
```

---

## Troubleshooting

### Problem: Odds not showing in frontend

**Solution:** Check that:
1. Fixtures have associated odds in `odds` table
2. `fixture_id` is properly set in `matches` table
3. `fetchChallengeMatches()` is being used (not old mock data)

```sql
-- Check if fixtures have odds
SELECT f.id, f.date, o.home_win, o.draw, o.away_win
FROM fixtures f
LEFT JOIN odds o ON o.fixture_id = f.id
WHERE f.id IN (SELECT fixture_id FROM matches WHERE id IN
  (SELECT match_id FROM challenge_matches WHERE challenge_id = 'your-challenge-id')
);
```

### Problem: Points not calculating correctly

**Solution:** Check that:
1. `calculate_bet_points()` function was updated (Migration 2)
2. `odds_snapshot` was captured when bet was placed
3. Match status is set to finished ('FT', 'AET', 'PEN', 'finished')

```sql
-- Check bets have odds_snapshot
SELECT cb.id, cb.odds_snapshot, cb.prediction, cb.amount
FROM challenge_bets cb
WHERE cb.daily_entry_id = 'daily-entry-id';

-- Manually trigger points recalculation
SELECT recalculate_challenge_points('challenge-id');
```

### Problem: "Challenge has started - bets are locked" error

**Solution:** This is expected behavior. Bets cannot be modified after challenge status becomes 'active' or 'ongoing'. To allow changes:

```sql
-- Temporarily set status back to 'upcoming' (TESTING ONLY)
UPDATE challenges SET status = 'upcoming' WHERE id = 'challenge-id';
```

---

## API Reference

### `addMatchesToChallenge(challengeId, matches)`
Adds fixtures to a challenge with day assignments.

**Parameters:**
- `challengeId` (string) - Challenge UUID
- `matches` (array) - Array of `{ fixture_id: string, day_number: number }`

**Returns:** `{ success: boolean, count: number }`

---

### `fetchFixtureOdds(fixtureId)`
Fetches latest odds for a single fixture.

**Parameters:**
- `fixtureId` (string) - Fixture UUID

**Returns:** `{ teamA: number, draw: number, teamB: number } | null`

---

### `saveDailyEntry(params)`
Saves user's bets for a specific day with validation and odds snapshot.

**Parameters:**
- `challengeId` (string)
- `userId` (string)
- `day` (number)
- `bets` (array) - Array of `{ challengeMatchId, prediction, amount }`
- `booster` (object, optional) - `{ type: 'x2' | 'x3', matchId: string }`

**Throws:**
- `"Challenge has started - bets are locked"`
- `"Total bet amount exceeds daily balance"`
- `"Cannot place bets on a finished or cancelled challenge"`

---

## Next Steps

1. **Deploy Migrations:** Apply all 3 migrations to production Supabase
2. **Create Test Challenge:** Use Admin panel to create "Summer Showdown"
3. **Add Fixtures:** Use `ChallengeMatchSelector` to add matches
4. **Test User Flow:** Join challenge, place bets, verify odds snapshot
5. **Monitor Points Calculation:** Check that points update when matches finish

---

## References

- **Audit Report:** `docs/audit/game_betting/ChallengeMode_V2_GrossGain_AuditReport.md`
- **Original Requirements:** `docs/audit/game_betting/SummerShowdown_AuditReport.md`
- **Mock Data:** `src/data/mockGames.ts` (now deprecated for betting challenges)
- **Database Schema:** `supabase/migrations/20250624000000_challenge_betting_entries.sql`
