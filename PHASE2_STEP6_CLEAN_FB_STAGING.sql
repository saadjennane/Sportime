-- ============================================================================
-- PHASE 2 STEP 6: CLEAN FB_* STAGING TABLES
-- ============================================================================
-- This cleans the staging tables to match production
-- After this, the "Reorder Leagues" modal will show only Liga

-- ============================================================================
-- OPTION A: DELETE NON-LIGA DATA FROM STAGING (Recommended)
-- ============================================================================
-- This keeps the staging tables but removes non-Liga data

-- 1. Clean fb_leagues (keep only Liga)
SELECT
  '=== FB_LEAGUES TO DELETE ===' as section,
  id,
  api_league_id,
  name,
  country
FROM fb_leagues
WHERE api_league_id != 140
  AND name NOT ILIKE '%la liga%'
  AND name NOT ILIKE '%liga%';

-- Uncomment to execute:
DELETE FROM fb_leagues
WHERE api_league_id != 140
  AND name NOT ILIKE '%la liga%'
  AND name NOT ILIKE '%liga%';

-- 2. Clean fb_teams (keep only FC Barcelona)
SELECT
  '=== FB_TEAMS TO DELETE ===' as section,
  id,
  name,
  code,
  country
FROM fb_teams
WHERE name NOT ILIKE '%barcelona%'
  AND name NOT ILIKE '%barça%'
  AND name NOT ILIKE '%barca%'
LIMIT 20;

-- Uncomment to execute:
DELETE FROM fb_teams
WHERE name NOT ILIKE '%barcelona%'
  AND name NOT ILIKE '%barça%'
  AND name NOT ILIKE '%barca%';

-- 3. Clean fb_players (keep only Barcelona players)
-- Note: fb_players table doesn't have team association in staging
-- So we can't filter by team. Options:
-- Option 1: Delete all and re-import Barcelona players (TRUNCATE TABLE fb_players)
-- Option 2: Keep all players (they don't affect the modal issue)
-- We'll choose Option 2 for now

SELECT
  '=== FB_PLAYERS COUNT ===' as section,
  COUNT(*) as total_players
FROM fb_players;

-- If you want to delete all players and re-import, uncomment:
-- TRUNCATE TABLE fb_players;

-- 4. Clean fb_fixtures (keep only Liga fixtures)
WITH liga_league AS (
  SELECT id FROM fb_leagues
  WHERE api_league_id = 140
    OR name ILIKE '%la liga%'
    OR name ILIKE '%liga%'
  LIMIT 1
)
SELECT
  '=== FB_FIXTURES TO DELETE ===' as section,
  COUNT(*) as fixtures_to_delete
FROM fb_fixtures
WHERE league_id NOT IN (SELECT id FROM liga_league);

-- Uncomment to execute:
WITH liga_league AS (
  SELECT id FROM fb_leagues
  WHERE api_league_id = 140 OR name ILIKE '%liga%'
  LIMIT 1
)
DELETE FROM fb_fixtures
WHERE league_id NOT IN (SELECT id FROM liga_league);

-- 5. Clean fb_odds (keep only odds for Liga fixtures)
WITH liga_fixtures AS (
  SELECT f.id
  FROM fb_fixtures f
  JOIN fb_leagues l ON f.league_id = l.id
  WHERE l.api_league_id = 140
    OR l.name ILIKE '%la liga%'
    OR l.name ILIKE '%liga%'
)
SELECT
  '=== FB_ODDS TO DELETE ===' as section,
  COUNT(*) as odds_to_delete
FROM fb_odds
WHERE fixture_id NOT IN (SELECT id FROM liga_fixtures);

-- Uncomment to execute:
WITH liga_fixtures AS (
  SELECT f.id
  FROM fb_fixtures f
  JOIN fb_leagues l ON f.league_id = l.id
  WHERE l.api_league_id = 140 OR l.name ILIKE '%liga%'
)
DELETE FROM fb_odds
WHERE fixture_id NOT IN (SELECT id FROM liga_fixtures);

-- ============================================================================
-- OPTION B: TRUNCATE ALL STAGING TABLES (Nuclear option)
-- ============================================================================
-- This removes ALL data from staging tables
-- Use this if you want to start fresh and re-import only Liga/Barcelona

-- Uncomment to execute:
-- TRUNCATE TABLE fb_odds CASCADE;
-- TRUNCATE TABLE fb_fixtures CASCADE;
-- TRUNCATE TABLE fb_players CASCADE;
-- TRUNCATE TABLE fb_teams CASCADE;
-- TRUNCATE TABLE fb_leagues CASCADE;

-- ============================================================================
-- VERIFY CLEANUP
-- ============================================================================

SELECT
  '=== FINAL FB_LEAGUES (STAGING) ===' as section,
  id,
  api_league_id,
  name,
  country
FROM fb_leagues
ORDER BY name;

SELECT
  '=== FINAL FB_TEAMS (STAGING) ===' as section,
  id,
  name,
  code,
  country
FROM fb_teams
ORDER BY name;

SELECT
  '=== STAGING TABLE COUNTS ===' as section,
  'fb_leagues' as table_name,
  COUNT(*) as row_count
FROM fb_leagues
UNION ALL
SELECT 'STAGING', 'fb_teams', COUNT(*) FROM fb_teams
UNION ALL
SELECT 'STAGING', 'fb_players', COUNT(*) FROM fb_players
UNION ALL
SELECT 'STAGING', 'fb_fixtures', COUNT(*) FROM fb_fixtures
UNION ALL
SELECT 'STAGING', 'fb_odds', COUNT(*) FROM fb_odds;

-- ============================================================================
-- EXPECTED RESULT
-- ============================================================================
-- After cleanup:
-- - fb_leagues: 1 row (Liga)
-- - fb_teams: 1+ rows (Barcelona and possibly opponents)
-- - fb_fixtures: Only Liga fixtures
-- - fb_odds: Only odds for Liga fixtures
-- - fb_players: Can be kept or cleaned as needed
