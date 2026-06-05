-- ============================================================================
-- CLEANUP 2024 SEASON DATA - Prepare for fresh 2025 seeding
-- ============================================================================
-- This script removes all data seeded with season 2024 to start fresh with 2025

-- Step 1: Delete player season stats for 2024
DELETE FROM player_season_stats
WHERE season = 2024;

SELECT 'Deleted player_season_stats for 2024' as status,
       (SELECT COUNT(*) FROM player_season_stats WHERE season = 2024) as remaining_count;

-- Step 2: Delete ALL player match stats (no season column, will be re-seeded with 2025 data)
DELETE FROM player_match_stats;

SELECT 'Deleted all player_match_stats' as status,
       (SELECT COUNT(*) FROM player_match_stats) as remaining_count;

-- Step 3: Delete player transfers (all, since they're not season-specific but tied to 2024 data)
DELETE FROM player_transfers;

SELECT 'Deleted all player_transfers' as status,
       (SELECT COUNT(*) FROM player_transfers) as remaining_count;

-- Step 4: Clear staging tables (fb_*) to re-seed with 2025 data
TRUNCATE TABLE fb_leagues CASCADE;
TRUNCATE TABLE fb_teams CASCADE;
TRUNCATE TABLE fb_players CASCADE;

SELECT 'Cleared all staging tables (fb_*)' as status;

-- Step 5: Remove leagues with season 2024 from production
-- IMPORTANT: Only remove auto-generated leagues, not user-created ones
DELETE FROM leagues
WHERE season = '2024'
  AND invite_code LIKE 'AUTO-%';

SELECT 'Deleted auto-generated leagues for 2024' as status,
       (SELECT COUNT(*) FROM leagues WHERE season = '2024') as remaining_count;

-- Step 6: Verification - Show what's left
SELECT '📊 VERIFICATION AFTER CLEANUP' as info;

SELECT
  'Staging Tables' as category,
  (SELECT COUNT(*) FROM fb_leagues) as leagues,
  (SELECT COUNT(*) FROM fb_teams) as teams,
  (SELECT COUNT(*) FROM fb_players) as players

UNION ALL

SELECT
  'Production Stats (2024)' as category,
  NULL as leagues,
  (SELECT COUNT(*) FROM player_season_stats WHERE season = 2024) as teams,
  NULL as players

UNION ALL

SELECT
  'Production Stats (2025)' as category,
  NULL as leagues,
  (SELECT COUNT(*) FROM player_season_stats WHERE season = 2025) as teams,
  NULL as players

UNION ALL

SELECT
  'Match Stats (All)' as category,
  NULL as leagues,
  (SELECT COUNT(*) FROM player_match_stats) as teams,
  NULL as players

UNION ALL

SELECT
  'Transfers' as category,
  NULL as leagues,
  (SELECT COUNT(*) FROM player_transfers) as teams,
  NULL as players;

-- Final message
SELECT '✅ Cleanup complete! Ready for fresh 2025 seeding.' as message;
