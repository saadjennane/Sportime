-- Add tier, duration, and access conditions to fantasy_games table
-- This aligns Fantasy games with Challenge/Betting game configuration

-- Add new columns to fantasy_games
ALTER TABLE fantasy_games
ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'amateur' CHECK (tier IN ('amateur', 'master', 'apex')),
ADD COLUMN IF NOT EXISTS duration_type TEXT DEFAULT 'flash' CHECK (duration_type IN ('flash', 'series', 'season')),
ADD COLUMN IF NOT EXISTS custom_entry_cost_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_subscription BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS minimum_level TEXT DEFAULT 'Rookie',
ADD COLUMN IF NOT EXISTS required_badges UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS min_players INTEGER DEFAULT 2 CHECK (min_players >= 2),
ADD COLUMN IF NOT EXISTS max_players INTEGER DEFAULT 100 CHECK (max_players >= min_players);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_fantasy_games_tier ON fantasy_games(tier);
CREATE INDEX IF NOT EXISTS idx_fantasy_games_duration ON fantasy_games(duration_type);
CREATE INDEX IF NOT EXISTS idx_fantasy_games_subscription ON fantasy_games(requires_subscription);
CREATE INDEX IF NOT EXISTS idx_fantasy_games_level ON fantasy_games(minimum_level);

-- Add comments
COMMENT ON COLUMN fantasy_games.tier IS 'Game tier: amateur (2000 base), master (10000 base), apex (20000 base)';
COMMENT ON COLUMN fantasy_games.duration_type IS 'Duration type affecting entry cost multiplier: flash (1x), series (2x), season (4x)';
COMMENT ON COLUMN fantasy_games.custom_entry_cost_enabled IS 'If true, entry_cost is manually set; if false, auto-calculated from tier × duration';
COMMENT ON COLUMN fantasy_games.requires_subscription IS 'Whether this game requires an active subscription to join';
COMMENT ON COLUMN fantasy_games.minimum_level IS 'Minimum user level required to join this game';
COMMENT ON COLUMN fantasy_games.required_badges IS 'Array of badge UUIDs that users must possess to join';
COMMENT ON COLUMN fantasy_games.min_players IS 'Minimum number of players required to start the game';
COMMENT ON COLUMN fantasy_games.max_players IS 'Maximum number of players allowed in the game';

-- Update existing games to have calculated entry costs if not custom
-- Assuming existing games are amateur + flash (base cost)
UPDATE fantasy_games
SET
  tier = 'amateur',
  duration_type = 'flash',
  custom_entry_cost_enabled = true -- Keep existing costs as custom
WHERE tier IS NULL OR duration_type IS NULL;
