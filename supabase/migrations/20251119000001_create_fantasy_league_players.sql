-- Create fantasy_league_players table to link players to fantasy games by league
-- This replaces the old fantasy_players table to avoid duplication

CREATE TABLE IF NOT EXISTS fantasy_league_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,

  -- Fantasy-specific attributes calculated from player_season_stats
  status TEXT NOT NULL CHECK (status IN ('Star', 'Key', 'Wild')),
  pgs DECIMAL(3,1) DEFAULT 0 CHECK (pgs >= 0 AND pgs <= 10),

  -- Availability flag
  is_available BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure one player per league
  UNIQUE(league_id, player_id)
);

-- Indexes for performance
CREATE INDEX idx_fantasy_league_players_league ON fantasy_league_players(league_id);
CREATE INDEX idx_fantasy_league_players_player ON fantasy_league_players(player_id);
CREATE INDEX idx_fantasy_league_players_status ON fantasy_league_players(status);
CREATE INDEX idx_fantasy_league_players_available ON fantasy_league_players(is_available) WHERE is_available = true;

-- Enable RLS
ALTER TABLE fantasy_league_players ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read available fantasy players
CREATE POLICY "Fantasy league players are viewable by everyone"
  ON fantasy_league_players FOR SELECT
  USING (true);

-- Policy: Only admins can insert/update/delete
CREATE POLICY "Only admins can manage fantasy league players"
  ON fantasy_league_players FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_fantasy_league_players_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_fantasy_league_players_updated_at
  BEFORE UPDATE ON fantasy_league_players
  FOR EACH ROW
  EXECUTE FUNCTION update_fantasy_league_players_updated_at();

-- Helper function to calculate status from PGS
CREATE OR REPLACE FUNCTION calculate_fantasy_status(pgs_value DECIMAL)
RETURNS TEXT AS $$
BEGIN
  IF pgs_value >= 7.5 THEN
    RETURN 'Star';
  ELSIF pgs_value >= 6.0 THEN
    RETURN 'Key';
  ELSE
    RETURN 'Wild';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to sync players from a league to fantasy_league_players
CREATE OR REPLACE FUNCTION sync_league_fantasy_players(p_league_id UUID)
RETURNS TABLE (
  synced_count INTEGER,
  message TEXT
) AS $$
DECLARE
  v_synced_count INTEGER := 0;
BEGIN
  -- Insert or update fantasy league players from player_season_stats
  INSERT INTO fantasy_league_players (league_id, player_id, status, pgs, is_available)
  SELECT
    p_league_id,
    pss.player_id,
    calculate_fantasy_status(COALESCE(pss.pgs, 0)),
    COALESCE(pss.pgs, 0),
    true
  FROM player_season_stats pss
  INNER JOIN players p ON p.id = pss.player_id
  WHERE pss.league_id = p_league_id
    AND pss.season = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
    AND pss.appearances >= 5  -- Only players with minimum appearances
  ON CONFLICT (league_id, player_id)
  DO UPDATE SET
    status = calculate_fantasy_status(EXCLUDED.pgs),
    pgs = EXCLUDED.pgs,
    updated_at = NOW();

  GET DIAGNOSTICS v_synced_count = ROW_COUNT;

  RETURN QUERY SELECT
    v_synced_count,
    'Successfully synced ' || v_synced_count || ' players for league';
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON TABLE fantasy_league_players IS 'Links players to fantasy games by league with Fantasy-specific attributes (status, PGS). Replaces fantasy_players table to avoid data duplication.';
