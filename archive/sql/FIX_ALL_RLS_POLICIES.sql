-- ============================================================================
-- FIX ALL RLS POLICIES FOR PLAYERS SYSTEM
-- ============================================================================

-- 1. PLAYERS TABLE - Full CRUD policies
DROP POLICY IF EXISTS "Allow public select access to players" ON players;
DROP POLICY IF EXISTS "Allow public insert access to players" ON players;
DROP POLICY IF EXISTS "Allow public update access to players" ON players;
DROP POLICY IF EXISTS "Allow public delete access to players" ON players;

CREATE POLICY "Allow public select access to players"
ON players
FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow public insert access to players"
ON players
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Allow public update access to players"
ON players
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public delete access to players"
ON players
FOR DELETE
TO public
USING (true);

-- 2. PLAYER_TEAM_ASSOCIATION TABLE - Full CRUD policies
DROP POLICY IF EXISTS "Allow public select access to player team associations" ON player_team_association;
DROP POLICY IF EXISTS "Allow public insert access to player team associations" ON player_team_association;
DROP POLICY IF EXISTS "Allow public update access to player team associations" ON player_team_association;
DROP POLICY IF EXISTS "Allow public delete access to player team associations" ON player_team_association;

CREATE POLICY "Allow public select access to player team associations"
ON player_team_association
FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow public insert access to player team associations"
ON player_team_association
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Allow public update access to player team associations"
ON player_team_association
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public delete access to player team associations"
ON player_team_association
FOR DELETE
TO public
USING (true);

-- 3. Verify RLS is enabled on both tables
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('players', 'player_team_association');

-- 4. Verify all policies are created
SELECT
  tablename,
  policyname,
  cmd as operation
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('players', 'player_team_association')
ORDER BY tablename, cmd;
