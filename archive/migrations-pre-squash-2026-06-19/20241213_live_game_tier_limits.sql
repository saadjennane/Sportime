-- =============================================
-- LIVE GAME TIER LIMITS
-- Administrable entry limits per user tier
-- =============================================

-- Create table for tier-based entry limits
CREATE TABLE IF NOT EXISTS live_game_tier_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier VARCHAR(50) NOT NULL UNIQUE,
  max_entry INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default values
INSERT INTO live_game_tier_limits (tier, max_entry) VALUES
  ('rookie', 500),
  ('rising_star', 1000),
  ('pro', 2500),
  ('legend', 5000),
  ('goat', 10000)
ON CONFLICT (tier) DO NOTHING;

-- Enable RLS
ALTER TABLE live_game_tier_limits ENABLE ROW LEVEL SECURITY;

-- Anyone can read tier limits
CREATE POLICY "Anyone can read tier limits" ON live_game_tier_limits
  FOR SELECT USING (true);

-- Only admins can modify tier limits (via service role or direct DB access)
-- Regular users cannot modify these values through the API
CREATE POLICY "Only service role can modify tier limits" ON live_game_tier_limits
  FOR INSERT WITH CHECK (false);

CREATE POLICY "Only service role can update tier limits" ON live_game_tier_limits
  FOR UPDATE USING (false);

CREATE POLICY "Only service role can delete tier limits" ON live_game_tier_limits
  FOR DELETE USING (false);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_live_game_tier_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER live_game_tier_limits_updated_at
  BEFORE UPDATE ON live_game_tier_limits
  FOR EACH ROW
  EXECUTE FUNCTION update_live_game_tier_limits_updated_at();
