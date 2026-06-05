-- ============================================================================
-- ADD RLS POLICIES FOR PLAYER_TEAM_ASSOCIATION TABLE
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public insert access to player_team_association" ON player_team_association;
DROP POLICY IF EXISTS "Allow public update access to player_team_association" ON player_team_association;
DROP POLICY IF EXISTS "Allow public select access to player_team_association" ON player_team_association;
DROP POLICY IF EXISTS "Allow public delete access to player_team_association" ON player_team_association;

-- Create policy to allow public INSERT
CREATE POLICY "Allow public insert access to player_team_association"
ON player_team_association
FOR INSERT
TO public
WITH CHECK (true);

-- Create policy to allow public UPDATE
CREATE POLICY "Allow public update access to player_team_association"
ON player_team_association
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- Create policy to allow public SELECT
CREATE POLICY "Allow public select access to player_team_association"
ON player_team_association
FOR SELECT
TO public
USING (true);

-- Create policy to allow public DELETE
CREATE POLICY "Allow public delete access to player_team_association"
ON player_team_association
FOR DELETE
TO public
USING (true);
