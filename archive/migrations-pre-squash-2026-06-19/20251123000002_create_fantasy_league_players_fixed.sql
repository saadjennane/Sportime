-- Create fantasy_league_players table to link players to fantasy games by league
-- This replaces the old fantasy_players table to avoid duplication

CREATE TABLE IF NOT EXISTS fantasy_league_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,

  -- Fantasy-specific attributes calculated from player_season_stats
  status TEXT NOT NULL CHECK (status IN ('Star', 'Key', 'Wild')),
  pgs DECIMAL(5,2) DEFAULT 0 CHECK (pgs >= 0 AND pgs <= 10),

  -- Availability flag
  is_available BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure one player per league
  UNIQUE(league_id, player_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_fantasy_league_players_league ON fantasy_league_players(league_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_league_players_player ON fantasy_league_players(player_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_league_players_status ON fantasy_league_players(status);
CREATE INDEX IF NOT EXISTS idx_fantasy_league_players_available ON fantasy_league_players(is_available) WHERE is_available = true;

-- Enable RLS
ALTER TABLE fantasy_league_players ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Fantasy league players are viewable by everyone" ON fantasy_league_players;
DROP POLICY IF EXISTS "Only admins can manage fantasy league players" ON fantasy_league_players;

-- Policy: Everyone can read available fantasy players
CREATE POLICY "Fantasy league players are viewable by everyone"
  ON fantasy_league_players FOR SELECT
  USING (true);

-- Policy: Service role can manage (for Edge Functions)
CREATE POLICY "Service role can manage fantasy league players"
  ON fantasy_league_players FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_fantasy_league_players_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS update_fantasy_league_players_updated_at ON fantasy_league_players;
CREATE TRIGGER update_fantasy_league_players_updated_at
  BEFORE UPDATE ON fantasy_league_players
  FOR EACH ROW
  EXECUTE FUNCTION update_fantasy_league_players_updated_at();

-- Helper function to calculate status from PGS (updated thresholds)
CREATE OR REPLACE FUNCTION calculate_fantasy_status(pgs_value DECIMAL)
RETURNS TEXT AS $$
BEGIN
  IF pgs_value >= 6.0 THEN
    RETURN 'Star';
  ELSIF pgs_value >= 4.5 THEN
    RETURN 'Key';
  ELSE
    RETURN 'Wild';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add comment
COMMENT ON TABLE fantasy_league_players IS 'Links players to fantasy games by league with Fantasy-specific attributes (status, PGS). Replaces fantasy_players table to avoid data duplication.';

-- Verification
SELECT 'fantasy_league_players table created successfully!' as status;
