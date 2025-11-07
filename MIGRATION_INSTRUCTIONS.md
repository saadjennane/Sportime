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

This migration completes Phase 2 of the Challenge System integration + Data Synchronization:
- ✅ Phase 1A: Swipe cleanup
- ✅ Phase 2A: Admin backend functions
- ✅ Phase 2B: Service layer integration
- ✅ Phase 2C: Admin UI migration
- ✅ Phase 2D: Automatic leaderboard calculation
- ✅ Phase 2E: Automatic prize distribution
- ✅ Phase 3A: League data synchronization (fb_leagues → leagues)
- ✅ Phase 3B: Team data synchronization (fb_teams → teams)
- ✅ Phase 3C: Fixture data synchronization (fb_fixtures → fixtures)

All changes are committed locally. After verifying everything works, push to GitHub.
