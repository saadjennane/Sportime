-- ============================================================================
-- CHECK PLAYER_TEAM_ASSOCIATION DATA
-- ============================================================================

-- Check if associations were created
SELECT
  pta.*,
  t.name as team_name,
  p.name as player_name
FROM player_team_association pta
LEFT JOIN teams t ON t.id = pta.team_id
LEFT JOIN players p ON p.id = pta.player_id
ORDER BY pta.created_at DESC
LIMIT 50;

-- Count associations per team
SELECT
  t.name as team_name,
  t.id as team_id,
  COUNT(pta.id) as player_count
FROM teams t
LEFT JOIN player_team_association pta ON pta.team_id = t.id
GROUP BY t.id, t.name
ORDER BY player_count DESC;

-- Check if RLS is blocking reads
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'player_team_association';

-- Show all policies on player_team_association
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'player_team_association';
