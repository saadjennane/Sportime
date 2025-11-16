-- ============================================================================
-- ADD DELETE POLICY TO PLAYERS TABLE
-- ============================================================================

-- This policy allows public DELETE access to players table
-- It was missing from the original FIX_PLAYERS_RLS.sql script

DROP POLICY IF EXISTS "Allow public delete access to players" ON players;

CREATE POLICY "Allow public delete access to players"
ON players
FOR DELETE
TO public
USING (true);
