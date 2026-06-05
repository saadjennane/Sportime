-- ============================================================================
-- FIX TEAM_LEAGUE_PARTICIPATION TABLE
-- ============================================================================

-- 1. Add unique constraint to prevent duplicate team-league-season combinations
ALTER TABLE team_league_participation
ADD CONSTRAINT team_league_participation_unique
UNIQUE (team_id, league_id, season);

-- 2. Add RLS policies for INSERT and UPDATE operations
DROP POLICY IF EXISTS "Allow public insert access to team participations" ON team_league_participation;
DROP POLICY IF EXISTS "Allow public update access to team participations" ON team_league_participation;

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
