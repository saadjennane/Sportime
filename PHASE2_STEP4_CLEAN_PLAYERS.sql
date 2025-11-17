-- ============================================================================
-- PHASE 2 STEP 4: CLEAN NON-BARCELONA PLAYERS (WITH CASCADE)
-- ============================================================================
-- ⚠️ WARNING: This will CASCADE DELETE:
-- - player_team_association (for other players)
-- - player_season_stats (for other players)
-- - player_match_stats (for other players)
-- - player_transfer_history (for other players)
-- - user_teams fantasy selections (for other players)

-- SAFETY: Run PHASE2_STEP1_IDENTIFY_IDS.sql FIRST!

-- ============================================================================
-- STEP 1: SHOW WHAT WILL BE DELETED (PREVIEW)
-- ============================================================================

-- Show Barcelona players (TO KEEP)
SELECT
  '=== BARCELONA PLAYERS TO KEEP ===' as section,
  p.id,
  p.name,
  p.first_name,
  p.last_name,
  p.position,
  t.name as team_name
FROM players p
JOIN player_team_association pta ON p.id = pta.player_id
JOIN teams t ON pta.team_id = t.id
WHERE t.name ILIKE '%barcelona%'
  OR t.name ILIKE '%barça%'
  OR t.name ILIKE '%barca%'
ORDER BY p.name
LIMIT 20;

-- Count Barcelona players
SELECT
  '=== BARCELONA PLAYERS COUNT ===' as section,
  COUNT(DISTINCT p.id) as players_to_keep
FROM players p
JOIN player_team_association pta ON p.id = pta.player_id
JOIN teams t ON pta.team_id = t.id
WHERE t.name ILIKE '%barcelona%'
  OR t.name ILIKE '%barça%'
  OR t.name ILIKE '%barca%';

-- Count other players (TO DELETE)
SELECT
  '=== OTHER PLAYERS TO DELETE ===' as section,
  COUNT(*) as players_to_delete
FROM players
WHERE id NOT IN (
  SELECT DISTINCT pta.player_id
  FROM player_team_association pta
  JOIN teams t ON pta.team_id = t.id
  WHERE t.name ILIKE '%barcelona%'
    OR t.name ILIKE '%barça%'
    OR t.name ILIKE '%barca%'
);

-- Show sample of players to delete
SELECT
  '=== SAMPLE PLAYERS TO DELETE ===' as section,
  id,
  name,
  first_name,
  last_name,
  position
FROM players
WHERE id NOT IN (
  SELECT DISTINCT pta.player_id
  FROM player_team_association pta
  JOIN teams t ON pta.team_id = t.id
  WHERE t.name ILIKE '%barcelona%'
    OR t.name ILIKE '%barça%'
    OR t.name ILIKE '%barca%'
)
LIMIT 20;

-- Count rows that will be cascade deleted
SELECT
  '=== CASCADE DELETE PREVIEW ===' as section,
  'player_team_association' as table_name,
  COUNT(*) as rows_to_delete
FROM player_team_association pta
WHERE pta.player_id NOT IN (
  SELECT DISTINCT p.id
  FROM players p
  JOIN player_team_association pta2 ON p.id = pta2.player_id
  JOIN teams t ON pta2.team_id = t.id
  WHERE t.name ILIKE '%barcelona%'
    OR t.name ILIKE '%barça%'
    OR t.name ILIKE '%barca%'
)
UNION ALL
SELECT
  'CASCADE PREVIEW',
  'player_season_stats',
  COUNT(*)
FROM player_season_stats pss
WHERE pss.player_id NOT IN (
  SELECT DISTINCT p.id
  FROM players p
  JOIN player_team_association pta ON p.id = pta.player_id
  JOIN teams t ON pta.team_id = t.id
  WHERE t.name ILIKE '%barcelona%'
    OR t.name ILIKE '%barça%'
    OR t.name ILIKE '%barca%'
)
UNION ALL
SELECT
  'CASCADE PREVIEW',
  'player_match_stats',
  COUNT(*)
FROM player_match_stats pms
WHERE pms.player_id NOT IN (
  SELECT DISTINCT p.id
  FROM players p
  JOIN player_team_association pta ON p.id = pta.player_id
  JOIN teams t ON pta.team_id = t.id
  WHERE t.name ILIKE '%barcelona%'
    OR t.name ILIKE '%barça%'
    OR t.name ILIKE '%barca%'
);

-- ============================================================================
-- STEP 2: EXECUTE DELETE (UNCOMMENT TO RUN)
-- ============================================================================

-- ⚠️ DANGER ZONE: Uncomment the line below to execute the deletion
-- This will permanently delete all non-Barcelona players and cascade to dependent tables

-- DELETE FROM players
-- WHERE id NOT IN (
--   SELECT DISTINCT pta.player_id
--   FROM player_team_association pta
--   JOIN teams t ON pta.team_id = t.id
--   WHERE t.name ILIKE '%barcelona%'
--     OR t.name ILIKE '%barça%'
--     OR t.name ILIKE '%barca%'
-- );

-- ============================================================================
-- STEP 3: VERIFY DELETION (RUN AFTER UNCOMMENTING ABOVE)
-- ============================================================================

SELECT
  '=== REMAINING PLAYERS AFTER DELETE ===' as section,
  p.id,
  p.name,
  p.first_name,
  p.last_name,
  p.position,
  t.name as team_name
FROM players p
JOIN player_team_association pta ON p.id = pta.player_id
JOIN teams t ON pta.team_id = t.id
ORDER BY p.name;

-- Count remaining rows
SELECT
  '=== ROW COUNTS AFTER DELETE ===' as section,
  'players' as table_name,
  COUNT(*) as remaining_rows
FROM players
UNION ALL
SELECT
  'COUNTS',
  'player_team_association',
  COUNT(*)
FROM player_team_association
UNION ALL
SELECT
  'COUNTS',
  'player_season_stats',
  COUNT(*)
FROM player_season_stats
UNION ALL
SELECT
  'COUNTS',
  'player_match_stats',
  COUNT(*)
FROM player_match_stats;
