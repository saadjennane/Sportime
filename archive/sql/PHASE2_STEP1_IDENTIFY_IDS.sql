-- ============================================================================
-- PHASE 2 STEP 1: IDENTIFY IDS TO KEEP
-- ============================================================================
-- This script identifies the IDs of Liga, FC Barcelona, and Barça players
-- Run this FIRST to know what we're keeping

-- 1. Find Liga in Production
SELECT
  '=== LIGA IN PRODUCTION (leagues) ===' as section,
  id,
  api_league_id,
  name,
  country_id
FROM leagues
WHERE api_league_id = 140 OR name ILIKE '%la liga%' OR name ILIKE '%liga%';

-- 2. Find Liga in Staging (fb_leagues)
SELECT
  '=== LIGA IN STAGING (fb_leagues) ===' as section,
  id,
  api_league_id,
  name,
  country
FROM fb_leagues
WHERE api_league_id = 140 OR name ILIKE '%la liga%' OR name ILIKE '%liga%';

-- 3. Find FC Barcelona in Production
SELECT
  '=== FC BARCELONA IN PRODUCTION (teams) ===' as section,
  id,
  api_team_id,
  name,
  code,
  country
FROM teams
WHERE name ILIKE '%barcelona%' OR name ILIKE '%barça%' OR name ILIKE '%barca%';

-- 4. Find FC Barcelona in Staging (fb_teams)
SELECT
  '=== FC BARCELONA IN STAGING (fb_teams) ===' as section,
  id as fb_team_id,
  name,
  code,
  country
FROM fb_teams
WHERE name ILIKE '%barcelona%' OR name ILIKE '%barça%' OR name ILIKE '%barca%';

-- 5. Count Barça Players in Production
SELECT
  '=== BARÇA PLAYERS COUNT IN PRODUCTION ===' as section,
  COUNT(DISTINCT p.id) as player_count
FROM players p
JOIN player_team_association pta ON p.id = pta.player_id
JOIN teams t ON pta.team_id = t.id
WHERE t.name ILIKE '%barcelona%' OR t.name ILIKE '%barça%' OR t.name ILIKE '%barca%';

-- 6. List Sample Barça Players (first 10)
SELECT
  '=== SAMPLE BARÇA PLAYERS IN PRODUCTION ===' as section,
  p.id,
  p.name,
  p.first_name,
  p.last_name,
  p.position,
  t.name as team_name
FROM players p
JOIN player_team_association pta ON p.id = pta.player_id
JOIN teams t ON pta.team_id = t.id
WHERE t.name ILIKE '%barcelona%' OR t.name ILIKE '%barça%' OR t.name ILIKE '%barca%'
LIMIT 10;

-- 7. Count Other Leagues (will be deleted)
SELECT
  '=== OTHER LEAGUES TO DELETE ===' as section,
  COUNT(*) as leagues_to_delete
FROM leagues
WHERE api_league_id != 140
  AND name NOT ILIKE '%la liga%'
  AND name NOT ILIKE '%liga%';

-- 8. Count Other Teams (will be deleted)
SELECT
  '=== OTHER TEAMS TO DELETE ===' as section,
  COUNT(*) as teams_to_delete
FROM teams
WHERE name NOT ILIKE '%barcelona%'
  AND name NOT ILIKE '%barça%'
  AND name NOT ILIKE '%barca%';

-- 9. Count Other Players (will be deleted)
SELECT
  '=== OTHER PLAYERS TO DELETE ===' as section,
  COUNT(*) as players_to_delete
FROM players
WHERE id NOT IN (
  SELECT DISTINCT pta.player_id
  FROM player_team_association pta
  JOIN teams t ON pta.team_id = t.id
  WHERE t.name ILIKE '%barcelona%' OR t.name ILIKE '%barça%' OR t.name ILIKE '%barca%'
);

-- 10. Check Dependent Data (will be cascade deleted)
SELECT
  '=== DEPENDENT DATA TO BE CASCADE DELETED ===' as section,
  'fixtures' as table_name,
  COUNT(*) as row_count
FROM fixtures
WHERE league_id NOT IN (
  SELECT id FROM leagues
  WHERE api_league_id = 140 OR name ILIKE '%liga%'
)
UNION ALL
SELECT
  'CASCADE SUMMARY',
  'team_league_participation',
  COUNT(*)
FROM team_league_participation
WHERE team_id NOT IN (
  SELECT id FROM teams
  WHERE name ILIKE '%barcelona%'
)
UNION ALL
SELECT
  'CASCADE SUMMARY',
  'player_season_stats',
  COUNT(*)
FROM player_season_stats
WHERE league_id NOT IN (
  SELECT id FROM leagues
  WHERE api_league_id = 140 OR name ILIKE '%liga%'
);
