-- ============================================================================
-- PHASE 2 STEP 3: CLEAN NON-BARCELONA TEAMS (WITH CASCADE)
-- ============================================================================
-- ⚠️ WARNING: This will CASCADE DELETE:
-- - player_team_association (for other teams)
-- - team_league_participation (for other teams)
-- - fixtures (home_team_id / away_team_id)
-- - matches (home_team_id / away_team_id) - SET NULL
-- - player_match_stats (team_id)
-- - player_season_stats (team_id)
-- - player_transfer_history (from_team_id / to_team_id) - SET NULL

-- SAFETY: Run PHASE2_STEP1_IDENTIFY_IDS.sql FIRST!

-- ============================================================================
-- STEP 1: SHOW WHAT WILL BE DELETED (PREVIEW)
-- ============================================================================

SELECT
  '=== TEAMS TO DELETE ===' as section,
  id,
  api_team_id,
  name,
  code,
  country
FROM teams
WHERE name NOT ILIKE '%barcelona%'
  AND name NOT ILIKE '%barça%'
  AND name NOT ILIKE '%barca%'
ORDER BY name;

-- Count teams to keep
SELECT
  '=== TEAMS TO KEEP (FC BARCELONA) ===' as section,
  id,
  api_team_id,
  name,
  code,
  country
FROM teams
WHERE name ILIKE '%barcelona%'
  OR name ILIKE '%barça%'
  OR name ILIKE '%barca%';

-- Count rows that will be cascade deleted
SELECT
  '=== CASCADE DELETE PREVIEW ===' as section,
  'player_team_association' as table_name,
  COUNT(*) as rows_to_delete
FROM player_team_association pta
WHERE pta.team_id IN (
  SELECT id FROM teams
  WHERE name NOT ILIKE '%barcelona%'
    AND name NOT ILIKE '%barça%'
    AND name NOT ILIKE '%barca%'
)
UNION ALL
SELECT
  'CASCADE PREVIEW',
  'team_league_participation',
  COUNT(*)
FROM team_league_participation tlp
WHERE tlp.team_id IN (
  SELECT id FROM teams
  WHERE name NOT ILIKE '%barcelona%'
    AND name NOT ILIKE '%barça%'
    AND name NOT ILIKE '%barca%'
)
UNION ALL
SELECT
  'CASCADE PREVIEW',
  'fixtures (as home_team)',
  COUNT(*)
FROM fixtures f
WHERE f.home_team_id IN (
  SELECT id FROM teams
  WHERE name NOT ILIKE '%barcelona%'
    AND name NOT ILIKE '%barça%'
    AND name NOT ILIKE '%barca%'
)
UNION ALL
SELECT
  'CASCADE PREVIEW',
  'fixtures (as away_team)',
  COUNT(*)
FROM fixtures f
WHERE f.away_team_id IN (
  SELECT id FROM teams
  WHERE name NOT ILIKE '%barcelona%'
    AND name NOT ILIKE '%barça%'
    AND name NOT ILIKE '%barca%'
)
UNION ALL
SELECT
  'CASCADE PREVIEW',
  'player_season_stats',
  COUNT(*)
FROM player_season_stats pss
WHERE pss.team_id IN (
  SELECT id FROM teams
  WHERE name NOT ILIKE '%barcelona%'
    AND name NOT ILIKE '%barça%'
    AND name NOT ILIKE '%barca%'
);

-- ============================================================================
-- STEP 2: EXECUTE DELETE (UNCOMMENT TO RUN)
-- ============================================================================

-- ⚠️ DANGER ZONE: Uncomment the line below to execute the deletion
-- This will permanently delete all non-Barcelona teams and cascade to dependent tables

DELETE FROM teams
WHERE name NOT ILIKE '%barcelona%'
  AND name NOT ILIKE '%barça%'
  AND name NOT ILIKE '%barca%';

-- ============================================================================
-- STEP 3: VERIFY DELETION (RUN AFTER UNCOMMENTING ABOVE)
-- ============================================================================

SELECT
  '=== REMAINING TEAMS AFTER DELETE ===' as section,
  id,
  api_team_id,
  name,
  code,
  country
FROM teams
ORDER BY name;

-- Count remaining rows
SELECT
  '=== ROW COUNTS AFTER DELETE ===' as section,
  'teams' as table_name,
  COUNT(*) as remaining_rows
FROM teams
UNION ALL
SELECT
  'COUNTS',
  'player_team_association',
  COUNT(*)
FROM player_team_association
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
FROM fixtures;
