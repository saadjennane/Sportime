-- ============================================================================
-- ADD INSERT AND UPDATE POLICIES FOR TEAMS TABLE
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public insert access to teams" ON teams;
DROP POLICY IF EXISTS "Allow public update access to teams" ON teams;

-- Create policy to allow public INSERT
CREATE POLICY "Allow public insert access to teams"
ON teams
FOR INSERT
TO public
WITH CHECK (true);

-- Create policy to allow public UPDATE
CREATE POLICY "Allow public update access to teams"
ON teams
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);
