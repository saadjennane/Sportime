-- ============================================================================
-- PHASE 3 STEP 2: DROP STAGING TABLES (fb_*)
-- ============================================================================
-- After Phase 2 cleanup, staging tables contain:
-- - fb_leagues: 1 (Liga)
-- - fb_teams: 1 (Barcelona)
-- - fb_players: 3074 (all players)
-- - fb_fixtures: 0
-- - fb_odds: 0
--
-- We'll drop these and rename production tables to fb_* in next step

-- ============================================================================
-- PREVIEW: Show what will be dropped
-- ============================================================================

-- List all fb_* tables
SELECT
  '=== FB_* TABLES TO DROP ===' as section,
  tablename as table_name,
  schemaname as schema
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'fb_%'
ORDER BY tablename;

-- Show row counts before deletion
SELECT
  '=== FB_* TABLE ROW COUNTS ===' as section,
  'fb_leagues' as table_name,
  COUNT(*) as row_count
FROM fb_leagues
UNION ALL
SELECT 'COUNTS', 'fb_teams', COUNT(*) FROM fb_teams
UNION ALL
SELECT 'COUNTS', 'fb_players', COUNT(*) FROM fb_players
UNION ALL
SELECT 'COUNTS', 'fb_fixtures', COUNT(*) FROM fb_fixtures
UNION ALL
SELECT 'COUNTS', 'fb_odds', COUNT(*) FROM fb_odds;

-- ============================================================================
-- STEP 1: Drop Staging Tables (in reverse dependency order)
-- ============================================================================

-- ⚠️ WARNING: This will permanently delete all fb_* staging tables
-- Make sure you've run PHASE3_STEP1 first to drop triggers!

-- Drop dependent tables first
DROP TABLE IF EXISTS fb_odds CASCADE;
DROP TABLE IF EXISTS fb_fixtures CASCADE;
DROP TABLE IF EXISTS fb_players CASCADE;
DROP TABLE IF EXISTS fb_teams CASCADE;
DROP TABLE IF EXISTS fb_leagues CASCADE;

-- ============================================================================
-- VERIFY: Check that staging tables are dropped
-- ============================================================================

-- Should return 0 tables
SELECT
  '=== REMAINING FB_* TABLES ===' as section,
  COUNT(*) as table_count
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'fb_%';

-- List remaining tables (should be empty)
SELECT
  '=== REMAINING FB_* TABLE LIST ===' as section,
  tablename as table_name
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'fb_%'
ORDER BY tablename;

-- ============================================================================
-- EXPECTED RESULT
-- ============================================================================
-- After running this script:
-- - 0 fb_* tables remaining
-- - Production tables (leagues, teams, players) are untouched
-- - Next step: rename production tables to fb_*
