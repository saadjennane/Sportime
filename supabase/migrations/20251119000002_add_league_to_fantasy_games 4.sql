-- Add league_id to fantasy_games to link each game to a specific league
-- This allows filtering available players by league

ALTER TABLE fantasy_games
ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES leagues(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_fantasy_games_league ON fantasy_games(league_id);

-- Add comment
COMMENT ON COLUMN fantasy_games.league_id IS 'The league associated with this fantasy game. Players available for selection come from this league.';
