-- ============================================================================
-- PHASE 2 STEP 2: CLEAN NON-LIGA LEAGUES (WITH CASCADE)
-- ============================================================================
-- ⚠️ WARNING: This will CASCADE DELETE:
-- - team_league_participation (for other leagues)
-- - challenge_leagues (for other leagues)
-- - fixtures (for other leagues)
-- - player_season_stats (for other leagues)
-- - odds (via fixtures CASCADE)
-- - matchday_fixtures (via fixtures CASCADE)
-- - swipe_predictions (via fixtures CASCADE)
-- - player_match_stats (via fixtures CASCADE)

-- SAFETY: Run PHASE2_STEP1_IDENTIFY_IDS.sql FIRST to see what will be kept!

-- ============================================================================
-- STEP 1: SHOW WHAT WILL BE DELETED (PREVIEW)
-- ============================================================================

SELECT
  '=== LEAGUES TO DELETE ===' as section,
  id,
  api_league_id,
  name,
  country
FROM leagues
WHERE api_league_id != 140
  AND name NOT ILIKE '%la liga%'
  AND name NOT ILIKE '%liga%'
ORDER BY name;

-- Count rows that will be cascade deleted
SELECT
  '=== CASCADE DELETE PREVIEW ===' as section,
  'team_league_participation' as table_name,
  COUNT(*) as rows_to_delete
FROM team_league_participation tlp
WHERE tlp.league_id IN (
  SELECT id FROM leagues
  WHERE api_league_id != 140
    AND name NOT ILIKE '%la liga%'
    AND name NOT ILIKE '%liga%'
)
UNION ALL
SELECT
  'CASCADE PREVIEW',
  'challenge_leagues',
  COUNT(*)
FROM challenge_leagues cl
WHERE cl.league_id IN (
  SELECT id FROM leagues
  WHERE api_league_id != 140
    AND name NOT ILIKE '%la liga%'
    AND name NOT ILIKE '%liga%'
)
UNION ALL
SELECT
  'CASCADE PREVIEW',
  'fixtures',
  COUNT(*)
FROM fixtures f
WHERE f.league_id IN (
  SELECT id FROM leagues
  WHERE api_league_id != 140
    AND name NOT ILIKE '%la liga%'
    AND name NOT ILIKE '%liga%'
)
UNION ALL
SELECT
  'CASCADE PREVIEW',
  'player_season_stats',
  COUNT(*)
FROM player_season_stats pss
WHERE pss.league_id IN (
  SELECT id FROM leagues
  WHERE api_league_id != 140
    AND name NOT ILIKE '%la liga%'
    AND name NOT ILIKE '%liga%'
);

-- ============================================================================
-- STEP 2: EXECUTE DELETE (UNCOMMENT TO RUN)
-- ============================================================================

-- ⚠️ DANGER ZONE: Uncomment the line below to execute the deletion
-- This will permanently delete all non-Liga leagues and cascade to dependent tables

-- DELETE FROM leagues
-- WHERE api_league_id != 140
--   AND name NOT ILIKE '%la liga%'
--   AND name NOT ILIKE '%liga%';

-- ============================================================================
-- STEP 3: VERIFY DELETION (RUN AFTER UNCOMMENTING ABOVE)
-- ============================================================================

SELECT
  '=== REMAINING LEAGUES AFTER DELETE ===' as section,
  id,
  api_league_id,
  name,
  country
FROM leagues
ORDER BY name;

-- Count remaining rows
SELECT
  '=== ROW COUNTS AFTER DELETE ===' as section,
  'leagues' as table_name,
  COUNT(*) as remaining_rows
FROM leagues
UNION ALL
SELECT
  'COUNTS',
  'team_league_participation',
  COUNT(*)
FROM team_league_participation
UNION ALL
SELECT
  'COUNTS',
  'fixtures',
  COUNT(*)
FROM fixtures
UNION ALL
SELECT
  'COUNTS',
  'player_season_stats',
  COUNT(*)
FROM player_season_stats;
