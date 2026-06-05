# Migration Instructions - Challenge System Phase 2

## Overview
You need to apply 3 new SQL migrations to your Supabase remote database to enable the Challenge Admin system.

## Prerequisites
- Access to your Supabase project dashboard at https://supabase.com
- Admin access to SQL Editor

## Steps to Apply Migrations

### Option 1: Using Supabase Dashboard (Recommended)

1. **Navigate to Supabase Dashboard**
   - Go to https://supabase.com
   - Open your Sportime project
   - Click on "SQL Editor" in the left sidebar

2. **Apply Migration 1: Admin Functions**
   - Click "New Query"
   - Copy the entire contents of: `supabase/migrations/20250628000000_challenge_admin_functions.sql`
   - Paste into the SQL Editor
   - Click "Run" or press `Ctrl/Cmd + Enter`
   - Verify success (should see "Success. No rows returned")

3. **Apply Migration 2: Leaderboard Engine**
   - Click "New Query"
   - Copy the entire contents of: `supabase/migrations/20250628000001_challenge_leaderboard_engine.sql`
   - Paste into the SQL Editor
   - Click "Run"
   - Verify success

4. **Apply Migration 3: Prize Distribution**
   - Click "New Query"
   - Copy the entire contents of: `supabase/migrations/20250628000002_challenge_prize_distribution.sql`
   - Paste into the SQL Editor
   - Click "Run"
   - Verify success

5. **Apply Migration 4: Fix Level Names**
   - Click "New Query"
   - Copy the entire contents of: `supabase/migrations/20250628000003_fix_level_names.sql`
   - Paste into the SQL Editor
   - Click "Run"
   - Verify success (fixes Amateur → Rookie for progression levels)

6. **Apply Migration 5: Sync Leagues Data**
   - Click "New Query"
   - Copy the entire contents of: `supabase/migrations/20250701000000_sync_fb_leagues_to_leagues.sql`
   - Paste into the SQL Editor
   - Click "Run"
   - Verify success (syncs fb_leagues → leagues with automatic trigger)

7. **Apply Migration 6: Sync Teams Data**
   - Click "New Query"
   - Copy the entire contents of: `supabase/migrations/20250702000000_sync_fb_teams_to_teams.sql`
   - Paste into the SQL Editor
   - Click "Run"
   - Verify success (syncs fb_teams → teams with automatic trigger)

8. **Apply Migration 7: Sync Fixtures Data**
   - Click "New Query"
   - Copy the entire contents of: `supabase/migrations/20250702000001_sync_fb_fixtures_to_fixtures.sql`
   - Paste into the SQL Editor
   - Click "Run"
   - Verify success (syncs fb_fixtures → fixtures with automatic trigger)

9. **Apply Migration 8: Add Odds Snapshot to Challenge Bets**
   - Click "New Query"
   - Copy the entire contents of: `supabase/migrations/20250703000000_add_odds_to_bets.sql`
   - Paste into the SQL Editor
   - Click "Run"
   - Verify success (adds odds_snapshot JSONB column to challenge_bets)

10. **Apply Migration 9: Fix x3 Booster Penalty**
    - Click "New Query"
    - Copy the entire contents of: `supabase/migrations/20250703000001_fix_x3_penalty.sql`
    - Paste into the SQL Editor
    - Click "Run"
    - Verify success (updates calculate_bet_points with -200 penalty for x3)

11. **Apply Migration 10: Integrate Real Odds from Fixtures**
    - Click "New Query"
    - Copy the entire contents of: `supabase/migrations/20250703000002_integrate_real_odds.sql`
    - Paste into the SQL Editor
    - Click "Run"
    - Verify success (recalculate_challenge_points now uses real odds from database)

12. **Apply Migration 11: Add Challenge Leagues Junction Table**
    - Click "New Query"
    - Copy the entire contents of: `supabase/migrations/20250704000000_add_challenge_leagues_table.sql`
    - Paste into the SQL Editor
    - Click "Run"
    - Verify success (creates challenge_leagues junction table)

13. **Apply Migration 12: Fix Challenge Leagues Foreign Key**
    - Click "New Query"
    - Copy the entire contents of: `supabase/migrations/20250704000001_fix_challenge_leagues_fkey.sql`
    - Paste into the SQL Editor
    - Click "Run"
    - Verify success (adds missing foreign key to leagues table)

14. **Apply Migration 13: Finalize Prize Distribution**
    - Click "New Query"
    - Copy the entire contents of: `supabase/migrations/20250704000002_finalize_prize_distribution.sql`
    - Paste into the SQL Editor
    - Click "Run"
    - Verify success (adds grant_spin function and placeholders for gift cards/masterpass)

### Option 2: Using Supabase CLI (If Available)

If you have Supabase CLI installed:

```bash
# Login to Supabase
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Push migrations
supabase db push
```

## What These Migrations Add

### Migration 1: Admin Functions (20250628000000)
- `create_challenge()` - Create new challenges with configs, leagues, matches
- `update_challenge()` - Update challenge details
- `delete_challenge()` - Delete challenges (admin only)
- `cancel_challenge()` - Cancel challenge with automatic refunds
- `finalize_challenge()` - Finalize challenge (triggers prize distribution)

### Migration 2: Leaderboard Engine (20250628000001)
- `calculate_bet_points()` - Calculate points for individual bets
- `recalculate_challenge_points()` - Recalculate total points for a user
- `update_challenge_rankings()` - Update all participant ranks
- `trigger_recalculate_challenge_points()` - Auto-trigger when matches finish
- **Trigger**: `on_match_finished_recalculate_points` on `matches` table

### Migration 3: Prize Distribution (20250628000002)
- `distribute_reward_to_user()` - Distribute single reward (coins, tickets, XP, etc.)
- `participant_qualifies_for_reward()` - Check if participant qualifies for prize tier
- `distribute_challenge_prizes()` - Distribute all prizes based on rankings
- `trigger_distribute_prizes_on_finalize()` - Auto-trigger when challenge finalized
- **Trigger**: `on_challenge_finalized_distribute_prizes` on `challenges` table

### Migration 4: Fix Level Names (20250628000003)
- Fixes incorrect level name: `Amateur` → `Rookie`
- Updates `levels_config` table (level 1)
- Updates existing users with level_name = 'Amateur'
- Clarifies distinction between **Progression Levels** (Rookie, Rising Star, Pro, Elite, Legend, GOAT) and **Challenge Tiers** (Amateur, Master, Apex)

### Migration 5: Sync Leagues Data (20250701000000)
- **Purpose**: Synchronize `fb_leagues` (API-Football source) with `leagues` (application table)
- Truncates and repopulates `leagues` table from `fb_leagues`
- Creates `sync_fb_leagues_to_leagues()` trigger function
- **Trigger**: `on_fb_leagues_sync_to_leagues` on `fb_leagues` table
- **Data Flow**: API-Football → fb_leagues → leagues (automatic sync)
- Maps `fb_leagues.api_league_id` (BIGINT) to `leagues.api_league_id` (INTEGER)
- Maps `fb_leagues.id` to `leagues.id` (UUID)

### Migration 6: Sync Teams Data (20250702000000)
- **Purpose**: Synchronize `fb_teams` (API-Football source) with `teams` (application table)
- Adds `api_team_id` column to `teams` table
- Populates `teams` from `fb_teams` (preserves existing teams)
- Creates `sync_fb_teams_to_teams()` trigger function
- **Trigger**: `on_fb_teams_sync_to_teams` on `fb_teams` table
- **Data Flow**: API-Football → fb_teams → teams (automatic sync)
- Maps `fb_teams.id` (INTEGER) to `teams.api_team_id` (INTEGER)
- Includes country name lookup from `countries` table

### Migration 7: Sync Fixtures Data (20250702000001)
- **Purpose**: Synchronize `fb_fixtures` (API-Football source) with `fixtures` (application table)
- Adds `api_id` column to `fixtures` table
- Populates `fixtures` from `fb_fixtures` with team/league UUID lookups
- Creates `sync_fb_fixtures_to_fixtures()` trigger function
- **Trigger**: `on_fb_fixtures_sync_to_fixtures` on `fb_fixtures` table
- **Data Flow**: API-Football → fb_fixtures → fixtures (automatic sync)
- Maps `fb_fixtures.id` (INTEGER) to `fixtures.api_id` (INTEGER)
- Performs UUID lookups for:
  - `fb_fixtures.home_team_id` → `teams.api_team_id` → `teams.id` (UUID)
  - `fb_fixtures.away_team_id` → `teams.api_team_id` → `teams.id` (UUID)
  - `fb_fixtures.league_id` → `leagues.api_league_id` → `leagues.id` (UUID)
- Skips fixtures with missing team/league mappings (logs warnings)

### Migration 8: Add Odds Snapshot to Challenge Bets (20250703000000)
- **Purpose**: Capture odds at bet placement time for accurate historical calculations
- Adds `odds_snapshot` JSONB column to `challenge_bets` table
- Format: `{ "teamA": 2.0, "draw": 3.2, "teamB": 2.4 }`
- Creates GIN index on `odds_snapshot` for faster JSON queries
- Ensures points calculation accuracy even if odds change later
- Integrated with `challengeEntryService.saveDailyEntry()` to auto-capture odds

### Migration 9: Fix x3 Booster Penalty (20250703000001)
- **Purpose**: Implement -200 point penalty for x3 booster on losing bets
- Updates `calculate_bet_points()` function with gross gain model
- **Scoring Rules**:
  - Win (no booster): `points = odds × amount`
  - Win (x2 booster): `points = (odds × amount) × 2`
  - Win (x3 booster): `points = (odds × amount) × 3`
  - Loss (no booster/x2): `points = 0`
  - Loss (x3 booster): `points = -200` ⚠️ **PENALTY**
- Includes 6 test cases to verify all scenarios
- Aligns backend logic with frontend implementation

### Migration 10: Integrate Real Odds from Fixtures (20250703000002)
- **Purpose**: Fetch real odds from database instead of hardcoded values
- Creates single-parameter version of `recalculate_challenge_points(p_challenge_id UUID)`
- Coexists with 2-parameter version `(p_challenge_id UUID, p_user_id UUID)`
- **Odds Priority**:
  1. `odds_snapshot` from bet (captured at placement)
  2. Latest odds from `odds` table (via fixtures join)
  3. Default fallback: `{ teamA: 2.0, draw: 3.2, teamB: 2.4 }`
- **Data Flow**: `challenge_matches` → `matches` → `fixtures` → `odds`
- Applies gross gain model with x3 penalty
- Automatically triggered when matches finish

### Migration 11: Add Challenge Leagues Junction Table (20250704000000)
- **Purpose**: Create junction table linking challenges to leagues (many-to-many relationship)
- **Why Needed**: Required by `fetchChallengeCatalog()` which joins challenges → challenge_leagues → leagues
- Creates `challenge_leagues` table with:
  - Foreign keys to `challenges` and `leagues` (CASCADE on delete)
  - Unique constraint on `(challenge_id, league_id)` to prevent duplicates
- **RLS Policies**:
  - Public read access (SELECT for all users)
  - Admin-only write access (INSERT/UPDATE/DELETE requires `is_admin()`)
- **Note**: Migration 12 is required to fix a missing foreign key

### Migration 12: Fix Challenge Leagues Foreign Key (20250704000001)
- **Purpose**: Add missing foreign key constraint from `challenge_leagues` to `leagues`
- **Why Needed**: Migration 11 failed to create the foreign key to `leagues` table
- **Fixes Error**: "Could not find a relationship between 'challenge_leagues' and 'leagues' in the schema cache"
- Uses `ADD CONSTRAINT IF NOT EXISTS` to be idempotent
- Enables Supabase PostgREST to follow the relationship chain properly
- Required for admin panel to load challenges with league information

### Migration 13: Finalize Prize Distribution (20250704000002)
- **Purpose**: Complete prize distribution system with spin granting and placeholders
- **New Functions**:
  - `grant_spin(user_id, tier, quantity)` - Grants spins to users as rewards
  - Supports 5 spin tiers: free, amateur, master, apex, premium
  - Initializes `user_spin_states` if needed
- **Updated Functions**:
  - `distribute_reward_to_user()` - Now handles all reward types
- **Reward Types Supported**:
  - ✅ Coins (working)
  - ✅ Tickets (working - 3 tiers with expiry)
  - ✅ XP (working - via activity_log)
  - ✅ Spins (NEW - via grant_spin)
  - ✅ Premium subscriptions (working - 3d/7d)
  - 🔧 Gift Cards (5000 coins placeholder)
  - 🔧 MasterPass (5000 coins placeholder)
- **Placeholder System**: Gift cards and MasterPass temporarily give 5000 coins with logging
- **Frontend Integration**: `spinService.ts` updated with same placeholders for consistency
- **Complete Flow**: Challenge finishes → trigger fires → prizes distributed → all reward types handled

## Verification

After applying all migrations, verify in SQL Editor:

```sql
-- Check if challenge functions were created
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%challenge%'
ORDER BY routine_name;

-- Should return:
-- calculate_bet_points
-- cancel_challenge
-- create_challenge
-- delete_challenge
-- distribute_challenge_prizes
-- distribute_reward_to_user
-- finalize_challenge
-- participant_qualifies_for_reward
-- recalculate_all_challenge_points
-- recalculate_challenge_points
-- trigger_distribute_prizes_on_finalize
-- trigger_recalculate_challenge_points
-- update_challenge
-- update_challenge_rankings

-- Check if sync functions were created
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%sync%'
ORDER BY routine_name;

-- Should return:
-- sync_fb_fixtures_to_fixtures
-- sync_fb_leagues_to_leagues
-- sync_fb_teams_to_teams

-- Verify triggers are active
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE '%sync%'
ORDER BY trigger_name;

-- Should return:
-- on_fb_fixtures_sync_to_fixtures | fb_fixtures | EXECUTE FUNCTION sync_fb_fixtures_to_fixtures()
-- on_fb_leagues_sync_to_leagues   | fb_leagues  | EXECUTE FUNCTION sync_fb_leagues_to_leagues()
-- on_fb_teams_sync_to_teams       | fb_teams    | EXECUTE FUNCTION sync_fb_teams_to_teams()

-- Verify leagues sync
SELECT COUNT(*) as leagues_count FROM public.leagues WHERE api_league_id IS NOT NULL;

-- Verify teams sync
SELECT COUNT(*) as teams_count FROM public.teams WHERE api_team_id IS NOT NULL;

-- Verify fixtures sync
SELECT COUNT(*) as fixtures_count FROM public.fixtures WHERE api_id IS NOT NULL;
```

## Troubleshooting

### Error: "relation does not exist"
- Make sure previous migrations are applied first
- Check that `challenges`, `challenge_participants`, `challenge_entries`, etc. tables exist

### Error: "function is_admin does not exist"
- You need to apply the user management migrations first
- Or the `is_admin()` function needs to be created

### Error: "permission denied"
- Make sure you're logged in as the database owner/admin
- Check RLS policies are not blocking function creation

### Error: "column api_team_id does not exist" (Migration 6)
- This is normal on first run - the migration creates this column
- Re-run the migration if it failed partway through

### Error: "column api_id does not exist" (Migration 7)
- This is normal on first run - the migration creates this column
- Re-run the migration if it failed partway through

### Warning: "Skipped X fixtures due to missing team/league mappings" (Migration 7)
- This means some fb_fixtures reference teams or leagues that don't exist in teams/leagues tables yet
- This is expected if API data is still being populated
- Fixtures will be created automatically when the missing teams/leagues are synced via triggers

## Next Steps

After migrations are applied:
1. Test game creation in the Admin panel
2. Verify no more "relationship not found" errors
3. Verify no more "invalid UUID" errors (fixed by updating mockLeagues.ts)
4. Test the full challenge workflow:
   - Create challenge
   - Add participants
   - Match finishes → points auto-calculate
   - Finalize challenge → prizes auto-distribute

## Files Modified in This Phase

### Backend (Supabase)
- `supabase/migrations/20250628000000_challenge_admin_functions.sql` (NEW)
- `supabase/migrations/20250628000001_challenge_leaderboard_engine.sql` (NEW)
- `supabase/migrations/20250628000002_challenge_prize_distribution.sql` (NEW)

### Frontend (React/TypeScript)
- `src/services/challengeService.ts` (UPDATED - added admin functions)
- `src/pages/Admin.tsx` (UPDATED - uses Supabase for challenge CRUD)
- `src/data/mockLeagues.ts` (UPDATED - uses real UUIDs)
- `src/store/useMockStore.ts` (UPDATED - removed swipe functions)
- `src/App.tsx` (UPDATED - removed swipe mock dependencies)

## Complete Data Synchronization Pipeline

The migrations establish an automatic data synchronization pipeline from API-Football to your application:

```
API-Football API
      ↓
  (fetch data)
      ↓
┌─────────────────────────────────────────────────┐
│  Source Tables (API ingestion)                  │
│  - fb_leagues  (leagues from API)               │
│  - fb_teams    (teams from API)                 │
│  - fb_fixtures (fixtures/matches from API)      │
└─────────────────────────────────────────────────┘
      ↓
  (triggers fire automatically on INSERT/UPDATE/DELETE)
      ↓
┌─────────────────────────────────────────────────┐
│  Sync Functions (UUID mapping)                  │
│  - sync_fb_leagues_to_leagues()                 │
│  - sync_fb_teams_to_teams()                     │
│  - sync_fb_fixtures_to_fixtures()               │
└─────────────────────────────────────────────────┘
      ↓
  (automatic sync with UUID lookups)
      ↓
┌─────────────────────────────────────────────────┐
│  Application Tables (UUID-based)                │
│  - leagues   (UUIDs, mapped via api_league_id)  │
│  - teams     (UUIDs, mapped via api_team_id)    │
│  - fixtures  (UUIDs, mapped via api_id)         │
└─────────────────────────────────────────────────┘
      ↓
  (used by application)
      ↓
┌─────────────────────────────────────────────────┐
│  Business Logic Tables                          │
│  - challenges (reference leagues via UUID)      │
│  - bets       (reference fixtures via UUID)     │
│  - matches    (reference teams via UUID)        │
└─────────────────────────────────────────────────┘
```

**Key Benefits:**
- Single source of truth: API-Football data
- Automatic synchronization via database triggers
- No manual data management needed
- UUID ↔ INTEGER mapping handled transparently
- Foreign key relationships preserved

## Summary

This migration completes the full Challenge System integration + Data Synchronization + Challenge Betting Mode:

### Phase 1: Swipe Cleanup
- ✅ Removed deprecated swipe game code

### Phase 2: Challenge System Integration
- ✅ Phase 2A: Admin backend functions
- ✅ Phase 2B: Service layer integration
- ✅ Phase 2C: Admin UI migration
- ✅ Phase 2D: Automatic leaderboard calculation
- ✅ Phase 2E: Automatic prize distribution

### Phase 3: Data Synchronization Pipeline
- ✅ Phase 3A: League data synchronization (fb_leagues → leagues)
- ✅ Phase 3B: Team data synchronization (fb_teams → teams)
- ✅ Phase 3C: Fixture data synchronization (fb_fixtures → fixtures)

### Phase 4: Challenge Betting Mode (NEW)
- ✅ **Phase 4A**: Odds snapshot capture (Migration 8)
- ✅ **Phase 4B**: x3 booster penalty implementation (Migration 9)
- ✅ **Phase 4C**: Real odds integration (Migration 10)
- ✅ **Frontend**: Validation + odds capture in `challengeEntryService`
- ✅ **Frontend**: Real odds fetching in `challengeService`
- ✅ **Admin Tools**: `ChallengeMatchSelector` component
- ✅ **Documentation**: Complete implementation guide

### Key Features Delivered
- **Gross Gain Scoring**: `points = odds × amount × booster`
- **x3 Penalty**: -200 points on losing bets with x3 booster
- **Real-Time Odds**: Fetched from database with 3-tier fallback
- **Historical Accuracy**: Odds snapshot captured at bet placement
- **Automatic Sync**: API-Football data flows to application tables via triggers
- **Full Validation**: Challenge status + daily balance checks

All changes are committed locally. After verifying everything works, push to GitHub.
