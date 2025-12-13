-- =============================================
-- Live Betting Game V2 - Tables & Configuration
-- =============================================

-- Jeu Live
CREATE TABLE IF NOT EXISTS live_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id UUID REFERENCES fb_fixtures(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('free', 'ranked')),
  entry_cost INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'finished', 'cancelled')),
  friend_code TEXT UNIQUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Participations
CREATE TABLE IF NOT EXISTS live_game_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_game_id UUID REFERENCES live_games(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INT NOT NULL,
  total_gains INT DEFAULT 0,
  final_rank INT,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(live_game_id, user_id)
);

-- Paris
CREATE TABLE IF NOT EXISTS live_game_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID REFERENCES live_game_entries(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('result', 'goals', 'scorers', 'cards', 'quick', 'special')),
  market_id INT NOT NULL,
  market_name TEXT NOT NULL,
  choice TEXT NOT NULL,
  choice_label TEXT NOT NULL,
  amount INT NOT NULL CHECK (amount >= 50),
  odds DECIMAL(5,2) NOT NULL,
  placed_at_minute INT,
  placed_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirming', 'confirmed', 'voided', 'won', 'lost')),
  gain INT,
  void_reason TEXT
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_live_games_fixture ON live_games(fixture_id);
CREATE INDEX IF NOT EXISTS idx_live_games_friend_code ON live_games(friend_code) WHERE friend_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_live_games_status ON live_games(status);
CREATE INDEX IF NOT EXISTS idx_live_games_created_by ON live_games(created_by);
CREATE INDEX IF NOT EXISTS idx_live_game_entries_user ON live_game_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_live_game_entries_game ON live_game_entries(live_game_id);
CREATE INDEX IF NOT EXISTS idx_live_game_bets_entry ON live_game_bets(entry_id);
CREATE INDEX IF NOT EXISTS idx_live_game_bets_status ON live_game_bets(status);

-- =============================================
-- CONFIGURATION ADMINISTRABLE
-- =============================================

-- Limites par niveau (administrable)
CREATE TABLE IF NOT EXISTS live_game_level_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level_name TEXT NOT NULL UNIQUE,
  level_order INT NOT NULL,
  min_xp INT NOT NULL,
  max_xp INT,
  entry_max INT,
  slots_max INT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Valeurs par défaut
INSERT INTO live_game_level_config (level_name, level_order, min_xp, max_xp, entry_max, slots_max) VALUES
  ('rookie', 1, 0, 99, 500, 2),
  ('rising_star', 2, 100, 499, 1000, 3),
  ('pro', 3, 500, 1499, 2000, 4),
  ('elite', 4, 1500, 3999, 5000, 5),
  ('legend', 5, 4000, 9999, 10000, 6),
  ('master', 6, 10000, 24999, 25000, 8),
  ('goat', 7, 25000, NULL, NULL, NULL)
ON CONFLICT (level_name) DO NOTHING;

-- Récompenses Free Mode (administrable)
CREATE TABLE IF NOT EXISTS live_game_free_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_players INT NOT NULL,
  max_players INT,
  top_x INT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(min_players, max_players)
);

-- Valeurs par défaut
INSERT INTO live_game_free_rewards (min_players, max_players, top_x) VALUES
  (1, 9, 3),
  (10, 49, 10),
  (50, NULL, 50)
ON CONFLICT (min_players, max_players) DO NOTHING;

-- Détail des récompenses par rang
CREATE TABLE IF NOT EXISTS live_game_reward_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  free_reward_id UUID REFERENCES live_game_free_rewards(id) ON DELETE CASCADE,
  rank INT NOT NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('coins', 'xp', 'ticket', 'spin')),
  reward_amount INT NOT NULL,
  reward_tier TEXT CHECK (reward_tier IN ('amateur', 'master', 'apex') OR reward_tier IS NULL),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(free_reward_id, rank, reward_type)
);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE live_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_game_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_game_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_game_level_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_game_free_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_game_reward_tiers ENABLE ROW LEVEL SECURITY;

-- Live Games: Everyone can read, authenticated users can create
CREATE POLICY "live_games_select" ON live_games FOR SELECT USING (true);
CREATE POLICY "live_games_insert" ON live_games FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "live_games_update" ON live_games FOR UPDATE USING (
  created_by = auth.uid() OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Live Game Entries: Users can see all entries, manage their own
CREATE POLICY "live_game_entries_select" ON live_game_entries FOR SELECT USING (true);
CREATE POLICY "live_game_entries_insert" ON live_game_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "live_game_entries_update" ON live_game_entries FOR UPDATE USING (user_id = auth.uid());

-- Live Game Bets: Users can see all bets, manage their own
CREATE POLICY "live_game_bets_select" ON live_game_bets FOR SELECT USING (true);
CREATE POLICY "live_game_bets_insert" ON live_game_bets FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM live_game_entries WHERE id = entry_id AND user_id = auth.uid())
);
CREATE POLICY "live_game_bets_update" ON live_game_bets FOR UPDATE USING (
  EXISTS (SELECT 1 FROM live_game_entries WHERE id = entry_id AND user_id = auth.uid())
);

-- Config tables: Everyone can read, only admins can modify
CREATE POLICY "live_game_level_config_select" ON live_game_level_config FOR SELECT USING (true);
CREATE POLICY "live_game_level_config_modify" ON live_game_level_config FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "live_game_free_rewards_select" ON live_game_free_rewards FOR SELECT USING (true);
CREATE POLICY "live_game_free_rewards_modify" ON live_game_free_rewards FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "live_game_reward_tiers_select" ON live_game_reward_tiers FOR SELECT USING (true);
CREATE POLICY "live_game_reward_tiers_modify" ON live_game_reward_tiers FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Get user's level config based on XP
CREATE OR REPLACE FUNCTION get_user_live_game_limits(p_user_id UUID)
RETURNS TABLE (
  level_name TEXT,
  entry_max INT,
  slots_max INT,
  slots_used INT
) AS $$
DECLARE
  v_user_xp INT;
BEGIN
  -- Get user's XP
  SELECT COALESCE(xp, 0) INTO v_user_xp FROM profiles WHERE id = p_user_id;

  -- Get level config and count active games
  RETURN QUERY
  SELECT
    lc.level_name,
    lc.entry_max,
    lc.slots_max,
    COALESCE((
      SELECT COUNT(*)::INT
      FROM live_game_entries lge
      JOIN live_games lg ON lge.live_game_id = lg.id
      WHERE lge.user_id = p_user_id
      AND lg.status IN ('upcoming', 'live')
    ), 0) as slots_used
  FROM live_game_level_config lc
  WHERE lc.is_active = true
    AND lc.min_xp <= v_user_xp
    AND (lc.max_xp IS NULL OR lc.max_xp >= v_user_xp)
  ORDER BY lc.level_order DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get rewards config for player count
CREATE OR REPLACE FUNCTION get_live_game_rewards(p_player_count INT)
RETURNS TABLE (
  id UUID,
  top_x INT,
  rewards JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fr.id,
    fr.top_x,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'rank', rt.rank,
          'reward_type', rt.reward_type,
          'reward_amount', rt.reward_amount,
          'reward_tier', rt.reward_tier
        )
      ) FILTER (WHERE rt.id IS NOT NULL),
      '[]'::jsonb
    ) as rewards
  FROM live_game_free_rewards fr
  LEFT JOIN live_game_reward_tiers rt ON rt.free_reward_id = fr.id
  WHERE fr.is_active = true
    AND fr.min_players <= p_player_count
    AND (fr.max_players IS NULL OR fr.max_players >= p_player_count)
  GROUP BY fr.id, fr.top_x
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generate unique friend code
CREATE OR REPLACE FUNCTION generate_friend_code()
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 6 character alphanumeric code
    v_code := upper(substr(md5(random()::text), 1, 6));

    -- Check if exists
    SELECT EXISTS(SELECT 1 FROM live_games WHERE friend_code = v_code) INTO v_exists;

    EXIT WHEN NOT v_exists;
  END LOOP;

  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_live_game_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER live_games_updated_at
  BEFORE UPDATE ON live_games
  FOR EACH ROW EXECUTE FUNCTION update_live_game_updated_at();

CREATE TRIGGER live_game_level_config_updated_at
  BEFORE UPDATE ON live_game_level_config
  FOR EACH ROW EXECUTE FUNCTION update_live_game_updated_at();

CREATE TRIGGER live_game_free_rewards_updated_at
  BEFORE UPDATE ON live_game_free_rewards
  FOR EACH ROW EXECUTE FUNCTION update_live_game_updated_at();
