-- ============================================================================
-- ADD INSERT POLICY FOR TEAMS TABLE
-- ============================================================================
-- This policy allows public INSERT access to the teams table, which is needed
-- for the admin sync functionality to import teams from API-Football.

-- Drop existing policy if it exists (for idempotency)
DROP POLICY IF EXISTS "Allow public insert access to teams" ON teams;

-- Create policy to allow public INSERT
CREATE POLICY "Allow public insert access to teams"
ON teams
FOR INSERT
TO public
WITH CHECK (true);

-- Also add UPDATE policy in case we need to update team data
DROP POLICY IF EXISTS "Allow public update access to teams" ON teams;

CREATE POLICY "Allow public update access to teams"
ON teams
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);
