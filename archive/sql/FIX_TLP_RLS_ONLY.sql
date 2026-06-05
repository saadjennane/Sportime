-- ============================================================================
-- ADD RLS POLICIES FOR TEAM_LEAGUE_PARTICIPATION
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public insert access to team participations" ON team_league_participation;
DROP POLICY IF EXISTS "Allow public update access to team participations" ON team_league_participation;

-- Create policy to allow public INSERT
CREATE POLICY "Allow public insert access to team participations"
ON team_league_participation
FOR INSERT
TO public
WITH CHECK (true);

-- Create policy to allow public UPDATE
CREATE POLICY "Allow public update access to team participations"
ON team_league_participation
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);
