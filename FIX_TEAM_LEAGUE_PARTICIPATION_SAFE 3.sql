-- ============================================================================
-- FIX TEAM_LEAGUE_PARTICIPATION TABLE (SAFE VERSION)
-- ============================================================================

-- Skip constraint creation since it already exists
-- The error "relation team_league_participation_unique already exists" confirms it's there

-- Only add RLS policies for INSERT and UPDATE operations
DROP POLICY IF EXISTS "Allow public insert access to team participations" ON team_league_participation;
DROP POLICY IF EXISTS "Allow public update access to team participations" ON team_league_participation;
DROP POLICY IF EXISTS "Allow public select access to team participations" ON team_league_participation;

CREATE POLICY "Allow public insert access to team participations"
ON team_league_participation
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Allow public update access to team participations"
ON team_league_participation
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public select access to team participations"
ON team_league_participation
FOR SELECT
TO public
USING (true);
