-- Drop fantasy_players table as it's replaced by fantasy_league_players
-- This eliminates data duplication - we now use the players table directly

-- Drop all indexes first
DROP INDEX IF EXISTS idx_fantasy_players_status;
DROP INDEX IF EXISTS idx_fantasy_players_position;
DROP INDEX IF EXISTS idx_fantasy_players_api_id;
DROP INDEX IF EXISTS idx_fantasy_players_fatigue;

-- Drop the table
DROP TABLE IF EXISTS fantasy_players CASCADE;

-- Add comment explaining the change
COMMENT ON TABLE fantasy_league_players IS
  'Replaces old fantasy_players table. Links players from the main players table to fantasy games by league, with Fantasy-specific attributes (status, PGS). Eliminates data duplication.';
