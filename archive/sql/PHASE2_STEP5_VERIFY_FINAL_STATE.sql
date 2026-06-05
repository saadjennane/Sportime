-- ============================================================================
-- PHASE 2 STEP 5: VERIFY FINAL STATE AFTER ALL CLEANUPS
-- ============================================================================
-- Run this after executing all deletion scripts to verify the database
-- contains only Liga, FC Barcelona, and Barcelona players

-- ============================================================================
-- PRODUCTION TABLES VERIFICATION
-- ============================================================================

-- 1. Verify Leagues (should only show Liga)
SELECT
  '=== FINAL LEAGUES ===' as section,
  id,
  api_league_id,
  name,
  country,
  created_at
FROM leagues
ORDER BY name;

-- 2. Verify Teams (should only show FC Barcelona)
SELECT
  '=== FINAL TEAMS ===' as section,
  id,
  api_team_id,
  name,
  code,
  country,
  created_at
FROM teams
ORDER BY name;

-- 3. Verify Players (should only show Barcelona players)
SELECT
  '=== FINAL PLAYERS ===' as section,
  p.id,
  p.name,
  p.first_name,
  p.last_name,
  p.position,
  t.name as team_name
FROM players p
LEFT JOIN player_team_association pta ON p.id = pta.player_id
LEFT JOIN teams t ON pta.team_id = t.id
ORDER BY p.name
LIMIT 30;

-- 4. Count all main tables
SELECT
  '=== FINAL ROW COUNTS ===' as section,
  'leagues' as table_name,
  COUNT(*) as row_count
FROM leagues
UNION ALL
SELECT 'COUNTS', 'teams', COUNT(*) FROM teams
UNION ALL
SELECT 'COUNTS', 'players', COUNT(*) FROM players
UNION ALL
SELECT 'COUNTS', 'team_league_participation', COUNT(*) FROM team_league_participation
UNION ALL
SELECT 'COUNTS', 'player_team_association', COUNT(*) FROM player_team_association
UNION ALL
SELECT 'COUNTS', 'fixtures', COUNT(*) FROM fixtures
UNION ALL
SELECT 'COUNTS', 'odds', COUNT(*) FROM odds
UNION ALL
SELECT 'COUNTS', 'player_season_stats', COUNT(*) FROM player_season_stats
UNION ALL
SELECT 'COUNTS', 'player_match_stats', COUNT(*) FROM player_match_stats;

-- ============================================================================
-- STAGING TABLES VERIFICATION
-- ============================================================================

-- 5. Check fb_leagues (staging) - may still have old data
SELECT
  '=== FB_LEAGUES (STAGING) ===' as section,
  id,
  api_league_id,
  name,
  country
FROM fb_leagues
ORDER BY name;

-- 6. Check fb_teams (staging)
SELECT
  '=== FB_TEAMS (STAGING) ===' as section,
  id,
  name,
  code,
  country
FROM fb_teams
ORDER BY name
LIMIT 10;

-- 7. Check fb_players (staging)
SELECT
  '=== FB_PLAYERS (STAGING) COUNT ===' as section,
  COUNT(*) as staging_player_count
FROM fb_players;

-- 8. Count staging tables
SELECT
  '=== STAGING TABLE COUNTS ===' as section,
  'fb_leagues' as table_name,
  COUNT(*) as row_count
FROM fb_leagues
UNION ALL
SELECT 'STAGING COUNTS', 'fb_teams', COUNT(*) FROM fb_teams
UNION ALL
SELECT 'STAGING COUNTS', 'fb_players', COUNT(*) FROM fb_players
UNION ALL
SELECT 'STAGING COUNTS', 'fb_fixtures', COUNT(*) FROM fb_fixtures
UNION ALL
SELECT 'STAGING COUNTS', 'fb_odds', COUNT(*) FROM fb_odds;

-- ============================================================================
-- INTEGRITY CHECKS
-- ============================================================================

-- 9. Check for orphaned team_league_participation
SELECT
  '=== ORPHANED TEAM_LEAGUE_PARTICIPATION ===' as section,
  COUNT(*) as orphaned_count
FROM team_league_participation tlp
WHERE NOT EXISTS (
  SELECT 1 FROM teams t WHERE t.id = tlp.team_id
)
OR NOT EXISTS (
  SELECT 1 FROM leagues l WHERE l.id = tlp.league_id
);

-- 10. Check for orphaned player_team_association
SELECT
  '=== ORPHANED PLAYER_TEAM_ASSOCIATION ===' as section,
  COUNT(*) as orphaned_count
FROM player_team_association pta
WHERE NOT EXISTS (
  SELECT 1 FROM players p WHERE p.id = pta.player_id
)
OR NOT EXISTS (
  SELECT 1 FROM teams t WHERE t.id = pta.team_id
);

-- 11. Check for orphaned fixtures
SELECT
  '=== ORPHANED FIXTURES ===' as section,
  COUNT(*) as orphaned_count
FROM fixtures f
WHERE NOT EXISTS (
  SELECT 1 FROM leagues l WHERE l.id = f.league_id
)
OR NOT EXISTS (
  SELECT 1 FROM teams t WHERE t.id = f.home_team_id
)
OR NOT EXISTS (
  SELECT 1 FROM teams t WHERE t.id = f.away_team_id
);

-- ============================================================================
-- EXPECTED RESULTS
-- ============================================================================
-- After cleanup, you should see:
-- - 1 league (Liga)
-- - 1 team (FC Barcelona)
-- - ~25-30 players (Barcelona squad)
-- - team_league_participation: 1 row (Barcelona in Liga)
-- - player_team_association: ~25-30 rows (players associated with Barcelona)
-- - fixtures: only Liga fixtures with Barcelona
-- - All orphaned counts should be 0
