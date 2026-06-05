-- ============================================================================
-- DEBUG PLAYERS DISPLAY ISSUE
-- ============================================================================

-- 1. Check if players exist
SELECT COUNT(*) as total_players FROM players;

-- 2. Check first 5 players
SELECT id, name, first_name, last_name, nationality, position
FROM players
LIMIT 5;

-- 3. Check RLS policies on players table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'players';

-- 4. Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'players';

-- 5. Test direct query (should work if RLS is not blocking)
SELECT COUNT(*) as visible_players FROM players WHERE true;

-- 6. Check player_team_association
SELECT COUNT(*) as total_associations FROM player_team_association;

-- 7. Check if there are players with teams
SELECT
  p.name as player_name,
  t.name as team_name
FROM players p
LEFT JOIN player_team_association pta ON pta.player_id = p.id
LEFT JOIN teams t ON t.id = pta.team_id
LIMIT 10;
