-- ============================================================================
-- PHASE 3 STEP 1: DROP SYNC TRIGGERS AND FUNCTIONS
-- ============================================================================
-- These triggers sync fb_* staging tables to production tables
-- After Phase 3, we'll only have fb_* tables (renamed from production)
-- So these triggers become unnecessary

-- ============================================================================
-- PREVIEW: List all triggers to be dropped
-- ============================================================================

SELECT
  '=== TRIGGERS TO DROP ===' as section,
  trigger_name,
  event_object_table as table_name,
  action_timing,
  event_manipulation as event
FROM information_schema.triggers
WHERE trigger_name LIKE '%fb_%sync%'
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- PREVIEW: List all functions to be dropped
-- ============================================================================

SELECT
  '=== FUNCTIONS TO DROP ===' as section,
  routine_name as function_name,
  routine_type as type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%sync_fb_%'
ORDER BY routine_name;

-- ============================================================================
-- STEP 1: Drop Triggers
-- ============================================================================

-- Drop trigger for fb_leagues → leagues sync
DROP TRIGGER IF EXISTS on_fb_leagues_sync_to_leagues ON fb_leagues;

-- Drop trigger for fb_teams → teams sync
DROP TRIGGER IF EXISTS on_fb_teams_sync_to_teams ON fb_teams;

-- Drop trigger for fb_fixtures → fixtures sync
DROP TRIGGER IF EXISTS on_fb_fixtures_sync_to_fixtures ON fb_fixtures;

-- ============================================================================
-- STEP 2: Drop Functions
-- ============================================================================

-- Drop sync function for leagues
DROP FUNCTION IF EXISTS sync_fb_leagues_to_leagues();

-- Drop sync function for teams
DROP FUNCTION IF EXISTS sync_fb_teams_to_teams();

-- Drop sync function for fixtures
DROP FUNCTION IF EXISTS sync_fb_fixtures_to_fixtures();

-- ============================================================================
-- VERIFY: Check that triggers and functions are dropped
-- ============================================================================

-- Should return 0 triggers
SELECT
  '=== REMAINING SYNC TRIGGERS ===' as section,
  COUNT(*) as trigger_count
FROM information_schema.triggers
WHERE trigger_name LIKE '%fb_%sync%';

-- Should return 0 functions
SELECT
  '=== REMAINING SYNC FUNCTIONS ===' as section,
  COUNT(*) as function_count
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%sync_fb_%';

-- ============================================================================
-- EXPECTED RESULT
-- ============================================================================
-- After running this script:
-- - 0 sync triggers remaining
-- - 0 sync functions remaining
-- - fb_* tables will no longer automatically sync to production
