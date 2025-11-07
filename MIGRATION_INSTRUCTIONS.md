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

## Verification

After applying all migrations, verify in SQL Editor:

```sql
-- Check if functions were created
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

## Summary

This migration completes Phase 2 of the Challenge System integration:
- ✅ Phase 1A: Swipe cleanup
- ✅ Phase 2A: Admin backend functions
- ✅ Phase 2B: Service layer integration
- ✅ Phase 2C: Admin UI migration
- ✅ Phase 2D: Automatic leaderboard calculation
- ✅ Phase 2E: Automatic prize distribution

All changes are committed locally. After verifying everything works, push to GitHub.
