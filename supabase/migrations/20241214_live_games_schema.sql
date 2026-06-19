-- =============================================
-- LIVE GAMES SCHEMA
-- For Live Betting Game V2
-- =============================================

-- Create live_games table
CREATE TABLE IF NOT EXISTS live_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id UUID REFERENCES fb_fixtures(id) ON DELETE CASCADE,
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('free', 'ranked')),
  entry_cost INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'finished')),
  friend_code VARCHAR(10) UNIQUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create live_game_entries table (users who joined a game)
CREATE TABLE IF NOT EXISTS live_game_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_game_id UUID REFERENCES live_games(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER DEFAULT 1000, -- Starting balance (1000 for free, entry_cost for ranked)
  total_gains INTEGER DEFAULT 0,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(live_game_id, user_id)
);

-- Create live_game_bets table
CREATE TABLE IF NOT EXISTS live_game_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID REFERENCES live_game_entries(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL, -- 'next_goal', 'match_result', 'corners', etc.
  market_id INTEGER,
  market_name VARCHAR(100),
  choice VARCHAR(100) NOT NULL,
  choice_label VARCHAR(100),
  amount INTEGER NOT NULL,
  odds DECIMAL(5,2) NOT NULL,
  placed_at_minute INTEGER,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'void')),
  potential_win DECIMAL(10,2),
  actual_win INTEGER,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_live_games_fixture ON live_games(fixture_id);
CREATE INDEX IF NOT EXISTS idx_live_games_status ON live_games(status);
CREATE INDEX IF NOT EXISTS idx_live_games_friend_code ON live_games(friend_code);
CREATE INDEX IF NOT EXISTS idx_live_game_entries_game ON live_game_entries(live_game_id);
CREATE INDEX IF NOT EXISTS idx_live_game_entries_user ON live_game_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_live_game_bets_entry ON live_game_bets(entry_id);
CREATE INDEX IF NOT EXISTS idx_live_game_bets_status ON live_game_bets(status);

-- RLS Policies
ALTER TABLE live_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_game_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_game_bets ENABLE ROW LEVEL SECURITY;

-- live_games: Anyone can view, authenticated users can create
CREATE POLICY "Anyone can view live games" ON live_games
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create live games" ON live_games
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator can update their live games" ON live_games
  FOR UPDATE USING (auth.uid() = created_by);

-- live_game_entries: Anyone can view entries, users can join games
CREATE POLICY "Anyone can view game entries" ON live_game_entries
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can join games" ON live_game_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own entries" ON live_game_entries
  FOR UPDATE USING (auth.uid() = user_id);

-- live_game_bets: Users can view their own bets, place bets
CREATE POLICY "Users can view their own bets" ON live_game_bets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM live_game_entries
      WHERE id = live_game_bets.entry_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can place bets on their entries" ON live_game_bets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM live_game_entries
      WHERE id = live_game_bets.entry_id
      AND user_id = auth.uid()
    )
  );

-- Function to generate friend code
CREATE OR REPLACE FUNCTION generate_friend_code()
RETURNS VARCHAR(10) AS $$
DECLARE
  chars VARCHAR(36) := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result VARCHAR(10) := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * 36 + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to get user live game limits
CREATE OR REPLACE FUNCTION get_user_live_game_limits(p_user_id UUID)
RETURNS TABLE (
  slots_used INTEGER,
  slots_max INTEGER,
  entry_max INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INTEGER FROM live_game_entries lge
     JOIN live_games lg ON lge.live_game_id = lg.id
     WHERE lge.user_id = p_user_id AND lg.status != 'finished') as slots_used,
    5 as slots_max, -- Default max active games
    10000 as entry_max; -- Default max entry cost
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_live_games_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER live_games_updated_at
  BEFORE UPDATE ON live_games
  FOR EACH ROW
  EXECUTE FUNCTION update_live_games_updated_at();
