-- ============================================================================
-- ADD DELETE POLICY FOR TEAMS TABLE
-- ============================================================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow public delete access to teams" ON teams;

-- Create policy to allow public DELETE
CREATE POLICY "Allow public delete access to teams"
ON teams
FOR DELETE
TO public
USING (true);
