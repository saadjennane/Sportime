/*
  ===============================================================================
  FANTASY GAME - ALL MIGRATIONS IN ONE FILE
  ===============================================================================

  This file contains all Fantasy migrations in the correct order.
  Copy and paste this entire file into Supabase SQL Editor and run it.

  Contents:
  1. Add missing stats fields (Phase 0)
  2. Create Fantasy schema (Phase 1A)
  3. Create Fantasy functions (Phase 1B)
  4. Create Fantasy RLS policies (Phase 1C)
  5. Seed Fantasy data (Phase 2)

  ===============================================================================
*/

-- ============================================================================
-- MIGRATION 1: Add Missing Fantasy Stats Fields (Phase 0)
-- ============================================================================

ALTER TABLE player_match_stats
  ADD COLUMN IF NOT EXISTS clean_sheet BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS penalties_saved INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS penalties_missed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interceptions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS passes_key INTEGER DEFAULT 0;

ALTER TABLE player_season_stats
  ADD COLUMN IF NOT EXISTS penalties_saved INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS penalties_missed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duels_lost INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_player_match_stats_clean_sheet
  ON player_match_stats(clean_sheet)
  WHERE clean_sheet = true;

-- ============================================================================
-- MIGRATION 2: Create Fantasy Schema (Phase 1A)
-- ============================================================================

-- Drop existing tables if they exist (in reverse dependency order)
DROP TABLE IF EXISTS fantasy_leaderboard CASCADE;
DROP TABLE IF EXISTS user_fantasy_teams CASCADE;
DROP TABLE IF EXISTS fantasy_game_weeks CASCADE;
DROP TABLE IF EXISTS fantasy_games CASCADE;
DROP TABLE IF EXISTS fantasy_boosters CASCADE;
DROP TABLE IF EXISTS fantasy_players CASCADE;

-- Table: fantasy_players
CREATE TABLE fantasy_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_player_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  photo TEXT,
  "position" TEXT NOT NULL CHECK ("position" IN ('Goalkeeper', 'Defender', 'Midfielder', 'Attacker')),
  "status" TEXT NOT NULL CHECK ("status" IN ('Star', 'Key', 'Wild')),
  fatigue INTEGER DEFAULT 100 CHECK (fatigue >= 0 AND fatigue <= 100),
  team_name TEXT NOT NULL,
  team_logo TEXT,
  birthdate DATE,
  pgs DECIMAL(3,1) DEFAULT 0.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fantasy_players_status ON fantasy_players("status");
CREATE INDEX idx_fantasy_players_position ON fantasy_players("position");
CREATE INDEX idx_fantasy_players_api_id ON fantasy_players(api_player_id);
CREATE INDEX idx_fantasy_players_fatigue ON fantasy_players(fatigue) WHERE fatigue > 0;

-- Table: fantasy_games
CREATE TABLE fantasy_games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('Upcoming', 'Ongoing', 'Finished', 'Cancelled')),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  entry_cost INTEGER DEFAULT 0,
  total_players INTEGER DEFAULT 0,
  is_linkable BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fantasy_games_status ON fantasy_games("status");
CREATE INDEX idx_fantasy_games_dates ON fantasy_games(start_date, end_date);

-- Table: fantasy_game_weeks
CREATE TABLE fantasy_game_weeks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fantasy_game_id UUID NOT NULL REFERENCES fantasy_games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  leagues TEXT[] DEFAULT '{}',
  "status" TEXT NOT NULL CHECK ("status" IN ('upcoming', 'live', 'finished')),
  conditions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fantasy_game_weeks_game ON fantasy_game_weeks(fantasy_game_id);
CREATE INDEX idx_fantasy_game_weeks_status ON fantasy_game_weeks("status");
CREATE INDEX idx_fantasy_game_weeks_dates ON fantasy_game_weeks(start_date, end_date);

-- Table: user_fantasy_teams
CREATE TABLE user_fantasy_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES fantasy_games(id) ON DELETE CASCADE,
  game_week_id UUID NOT NULL REFERENCES fantasy_game_weeks(id) ON DELETE CASCADE,
  starters UUID[] NOT NULL,
  substitutes UUID[] DEFAULT '{}',
  captain_id UUID REFERENCES fantasy_players(id),
  booster_used INTEGER CHECK (booster_used IN (1, 2, 3)),
  fatigue_state JSONB DEFAULT '{}',
  total_points DECIMAL(5,1) DEFAULT 0.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_id, game_week_id)
);

CREATE INDEX idx_user_fantasy_teams_user ON user_fantasy_teams(user_id);
CREATE INDEX idx_user_fantasy_teams_gw ON user_fantasy_teams(game_week_id);
CREATE INDEX idx_user_fantasy_teams_game ON user_fantasy_teams(game_id);

ALTER TABLE user_fantasy_teams ADD CONSTRAINT check_starters_length CHECK (array_length(starters, 1) = 7);
ALTER TABLE user_fantasy_teams ADD CONSTRAINT check_substitutes_length CHECK (array_length(substitutes, 1) <= 2);

-- Table: fantasy_boosters
CREATE TABLE fantasy_boosters (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon TEXT,
  type TEXT CHECK (type IN ('regular', 'live')) DEFAULT 'regular',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: fantasy_leaderboard
CREATE TABLE fantasy_leaderboard (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES fantasy_games(id) ON DELETE CASCADE,
  game_week_id UUID NOT NULL REFERENCES fantasy_game_weeks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  avatar TEXT,
  total_points DECIMAL(5,1) DEFAULT 0.0,
  booster_used INTEGER,
  rank INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, game_week_id, user_id)
);

CREATE INDEX idx_fantasy_leaderboard_gw ON fantasy_leaderboard(game_week_id);
CREATE INDEX idx_fantasy_leaderboard_rank ON fantasy_leaderboard(game_week_id, rank);
CREATE INDEX idx_fantasy_leaderboard_points ON fantasy_leaderboard(game_week_id, total_points DESC);

-- ============================================================================
-- MIGRATION 3: Create Fantasy Functions (Phase 1B)
-- ============================================================================

-- Function: check_team_composition
CREATE OR REPLACE FUNCTION check_team_composition(p_starters UUID[])
RETURNS BOOLEAN AS $$
DECLARE
  v_gk INTEGER;
  v_def INTEGER;
  v_mid INTEGER;
  v_att INTEGER;
BEGIN
  IF array_length(p_starters, 1) != 7 THEN
    RETURN false;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE "position" = 'Goalkeeper'),
    COUNT(*) FILTER (WHERE "position" = 'Defender'),
    COUNT(*) FILTER (WHERE "position" = 'Midfielder'),
    COUNT(*) FILTER (WHERE "position" = 'Attacker')
  INTO v_gk, v_def, v_mid, v_att
  FROM fantasy_players
  WHERE id = ANY(p_starters);

  IF v_gk != 1 OR v_def < 2 OR v_def > 3 OR v_mid < 2 OR v_mid > 3 OR v_att < 1 OR v_att > 2 THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: calculate_fantasy_leaderboard
CREATE OR REPLACE FUNCTION calculate_fantasy_leaderboard(p_game_id UUID, p_game_week_id UUID)
RETURNS TABLE(
  user_id UUID,
  username TEXT,
  avatar TEXT,
  total_points DECIMAL,
  booster_used INTEGER,
  rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked_teams AS (
    SELECT
      uft.user_id,
      u.username,
      u.avatar_url as avatar,
      uft.total_points,
      uft.booster_used,
      RANK() OVER (ORDER BY uft.total_points DESC) as rank
    FROM user_fantasy_teams uft
    INNER JOIN users u ON u.id = uft.user_id
    WHERE uft.game_id = p_game_id AND uft.game_week_id = p_game_week_id
    ORDER BY rank
  )
  SELECT * FROM ranked_teams;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get_available_fantasy_players
CREATE OR REPLACE FUNCTION get_available_fantasy_players(p_game_week_id UUID DEFAULT NULL)
RETURNS TABLE(
  id UUID,
  api_player_id INTEGER,
  name TEXT,
  photo TEXT,
  "position" TEXT,
  "status" TEXT,
  fatigue INTEGER,
  team_name TEXT,
  team_logo TEXT,
  birthdate DATE,
  pgs DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fp.id, fp.api_player_id, fp.name, fp.photo, fp."position",
    fp."status", fp.fatigue, fp.team_name, fp.team_logo, fp.birthdate, fp.pgs
  FROM fantasy_players fp
  WHERE fp.fatigue > 0
  ORDER BY fp.pgs DESC, fp.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: update_player_fatigue
CREATE OR REPLACE FUNCTION update_player_fatigue(p_game_week_id UUID)
RETURNS void AS $$
DECLARE
  v_team RECORD;
  v_player_id UUID;
BEGIN
  FOR v_team IN
    SELECT user_id, starters, substitutes
    FROM user_fantasy_teams
    WHERE game_week_id = p_game_week_id
  LOOP
    FOREACH v_player_id IN ARRAY v_team.starters
    LOOP
      UPDATE fantasy_players
      SET fatigue = CASE
        WHEN "status" = 'Star' THEN GREATEST(0, fatigue - 20)
        WHEN "status" = 'Key' THEN GREATEST(0, fatigue - 10)
        ELSE fatigue
      END,
      updated_at = NOW()
      WHERE id = v_player_id;
    END LOOP;

    FOREACH v_player_id IN ARRAY v_team.substitutes
    LOOP
      UPDATE fantasy_players
      SET fatigue = LEAST(100, fatigue + 10), updated_at = NOW()
      WHERE id = v_player_id;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get_user_fantasy_team_with_players
CREATE OR REPLACE FUNCTION get_user_fantasy_team_with_players(p_user_id UUID, p_game_week_id UUID)
RETURNS TABLE(
  team_id UUID,
  game_id UUID,
  starters JSONB,
  substitutes JSONB,
  captain JSONB,
  booster_used INTEGER,
  total_points DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    uft.id as team_id, uft.game_id,
    (SELECT jsonb_agg(jsonb_build_object('id', fp.id, 'name', fp.name, 'photo', fp.photo, 'position', fp."position", 'status', fp."status", 'fatigue', fp.fatigue, 'team_name', fp.team_name, 'team_logo', fp.team_logo, 'pgs', fp.pgs))
     FROM fantasy_players fp WHERE fp.id = ANY(uft.starters)) as starters,
    (SELECT jsonb_agg(jsonb_build_object('id', fp.id, 'name', fp.name, 'photo', fp.photo, 'position', fp."position", 'status', fp."status", 'fatigue', fp.fatigue, 'team_name', fp.team_name, 'team_logo', fp.team_logo, 'pgs', fp.pgs))
     FROM fantasy_players fp WHERE fp.id = ANY(uft.substitutes)) as substitutes,
    (SELECT jsonb_build_object('id', fp.id, 'name', fp.name, 'photo', fp.photo, 'position', fp."position", 'status', fp."status")
     FROM fantasy_players fp WHERE fp.id = uft.captain_id) as captain,
    uft.booster_used,
    uft.total_points
  FROM user_fantasy_teams uft
  WHERE uft.user_id = p_user_id AND uft.game_week_id = p_game_week_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- MIGRATION 4: Create Fantasy RLS Policies (Phase 1C)
-- ============================================================================

ALTER TABLE fantasy_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_game_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_fantasy_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_boosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_leaderboard ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "fantasy_players_select_public" ON fantasy_players;
DROP POLICY IF EXISTS "fantasy_games_select_public" ON fantasy_games;
DROP POLICY IF EXISTS "fantasy_game_weeks_select_public" ON fantasy_game_weeks;
DROP POLICY IF EXISTS "user_fantasy_teams_select_own" ON user_fantasy_teams;
DROP POLICY IF EXISTS "user_fantasy_teams_insert_own" ON user_fantasy_teams;
DROP POLICY IF EXISTS "user_fantasy_teams_update_own" ON user_fantasy_teams;
DROP POLICY IF EXISTS "user_fantasy_teams_delete_own" ON user_fantasy_teams;
DROP POLICY IF EXISTS "fantasy_boosters_select_public" ON fantasy_boosters;
DROP POLICY IF EXISTS "fantasy_leaderboard_select_public" ON fantasy_leaderboard;

-- Create new policies
CREATE POLICY "fantasy_players_select_public" ON fantasy_players FOR SELECT USING (true);
CREATE POLICY "fantasy_games_select_public" ON fantasy_games FOR SELECT USING (true);
CREATE POLICY "fantasy_game_weeks_select_public" ON fantasy_game_weeks FOR SELECT USING (true);
CREATE POLICY "user_fantasy_teams_select_own" ON user_fantasy_teams FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_fantasy_teams_insert_own" ON user_fantasy_teams FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_fantasy_teams_update_own" ON user_fantasy_teams FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_fantasy_teams_delete_own" ON user_fantasy_teams FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "fantasy_boosters_select_public" ON fantasy_boosters FOR SELECT USING (true);
CREATE POLICY "fantasy_leaderboard_select_public" ON fantasy_leaderboard FOR SELECT USING (true);

-- ============================================================================
-- MIGRATION 5: Seed Fantasy Data (Phase 2)
-- ============================================================================

-- Insert boosters
INSERT INTO fantasy_boosters (id, name, description, icon, type) VALUES
(1, 'Double Impact', 'Multiplies your captain''s score by 2.2 instead of 1.1.', 'Flame', 'regular'),
(2, 'Golden Game', 'Get +20% on your entire team''s total score.', 'Zap', 'regular'),
(3, 'Recovery Boost', 'Restore one player to 100% fatigue.', 'ShieldCheck', 'regular')
ON CONFLICT (name) DO NOTHING;

SELECT setval('fantasy_boosters_id_seq', (SELECT MAX(id) FROM fantasy_boosters));

-- Insert test game (using name as unique identifier instead of hardcoded UUID)
INSERT INTO fantasy_games (name, "status", start_date, end_date, entry_cost, is_linkable, total_players)
SELECT 'Sportime Fantasy Season 1', 'Ongoing', NOW() - INTERVAL '60 days', NOW() + INTERVAL '30 days', 1500, true, 0
WHERE NOT EXISTS (SELECT 1 FROM fantasy_games WHERE name = 'Sportime Fantasy Season 1');

-- Insert game weeks (using the game_id from the inserted game)
INSERT INTO fantasy_game_weeks (fantasy_game_id, name, start_date, end_date, leagues, "status", conditions)
SELECT
  fg.id,
  gw.name,
  gw.start_date,
  gw.end_date,
  gw.leagues,
  gw.status,
  gw.conditions
FROM fantasy_games fg
CROSS JOIN (VALUES
  ('MatchDay 1', NOW() - INTERVAL '35 days', NOW() - INTERVAL '33 days', ARRAY['LaLiga'], 'finished', '[]'::jsonb),
  ('MatchDay 2', NOW() - INTERVAL '28 days', NOW() - INTERVAL '26 days', ARRAY['Premier League'], 'finished', '[]'::jsonb),
  ('MatchDay 3', NOW() - INTERVAL '21 days', NOW() - INTERVAL '19 days', ARRAY['Bundesliga'], 'finished', '[]'::jsonb),
  ('MatchDay 4', NOW() - INTERVAL '14 days', NOW() - INTERVAL '12 days', ARRAY['Serie A'], 'finished', '[]'::jsonb),
  ('MatchDay 5', NOW() - INTERVAL '7 days', NOW() - INTERVAL '5 days', ARRAY['LaLiga'], 'finished', '[]'::jsonb),
  ('MatchDay 6', NOW() - INTERVAL '2 days', NOW() + INTERVAL '2 days', ARRAY['LaLiga', 'Premier League'], 'live', '[{"key": "max_club_players", "text": "Max. 2 players from same club", "value": 2}, {"key": "max_star_players", "text": "Max. 2 Star players", "value": 2}]'::jsonb)
) AS gw(name, start_date, end_date, leagues, status, conditions)
WHERE fg.name = 'Sportime Fantasy Season 1'
  AND NOT EXISTS (
    SELECT 1 FROM fantasy_game_weeks
    WHERE fantasy_game_id = fg.id AND fantasy_game_weeks.name = gw.name
  );

-- Insert test players (using api_player_id as unique identifier)
INSERT INTO fantasy_players (api_player_id, name, photo, "position", "status", fatigue, team_name, team_logo, birthdate, pgs) VALUES
(304, 'Alisson', 'https://media.api-sports.io/football/players/304.png', 'Goalkeeper', 'Key', 100, 'Liverpool', 'https://media.api-sports.io/football/teams/40.png', '1992-10-02', 7.0),
(1101, 'M. ter Stegen', 'https://media.api-sports.io/football/players/1101.png', 'Goalkeeper', 'Key', 98, 'Barcelona', 'https://media.api-sports.io/football/teams/529.png', '1992-04-30', 6.9),
(306, 'V. van Dijk', 'https://media.api-sports.io/football/players/306.png', 'Defender', 'Key', 92, 'Liverpool', 'https://media.api-sports.io/football/teams/40.png', '1991-07-08', 7.2),
(1102, 'A. Davies', 'https://media.api-sports.io/football/players/1102.png', 'Defender', 'Key', 98, 'Bayern Munich', 'https://media.api-sports.io/football/teams/157.png', '2000-11-02', 7.1),
(163, 'J. Koundé', 'https://media.api-sports.io/football/players/163.png', 'Defender', 'Key', 94, 'Barcelona', 'https://media.api-sports.io/football/teams/529.png', '1998-11-12', 6.9),
(18888, 'R. James', 'https://media.api-sports.io/football/players/18888.png', 'Defender', 'Wild', 100, 'Chelsea', 'https://media.api-sports.io/football/teams/49.png', '1999-12-08', 5.9),
(62, 'K. De Bruyne', 'https://media.api-sports.io/football/players/62.png', 'Midfielder', 'Star', 88, 'Man City', 'https://media.api-sports.io/football/teams/50.png', '1991-06-28', 7.8),
(874, 'J. Bellingham', 'https://media.api-sports.io/football/players/874.png', 'Midfielder', 'Star', 85, 'Real Madrid', 'https://media.api-sports.io/football/teams/541.png', '2003-06-29', 7.9),
(1456, 'Pedri', 'https://media.api-sports.io/football/players/1456.png', 'Midfielder', 'Key', 80, 'Barcelona', 'https://media.api-sports.io/football/teams/529.png', '2002-11-25', 6.8),
(2289, 'F. Wirtz', 'https://media.api-sports.io/football/players/2289.png', 'Midfielder', 'Wild', 100, 'Leverkusen', 'https://media.api-sports.io/football/teams/168.png', '2003-05-03', 5.8),
(154, 'L. Messi', 'https://media.api-sports.io/football/players/154.png', 'Attacker', 'Star', 95, 'Inter Miami', 'https://media.api-sports.io/football/teams/10101.png', '1987-06-24', 8.1),
(969, 'E. Haaland', 'https://media.api-sports.io/football/players/969.png', 'Attacker', 'Star', 90, 'Man City', 'https://media.api-sports.io/football/teams/50.png', '2000-07-21', 8.3),
(241, 'Rafael Leão', 'https://media.api-sports.io/football/players/241.png', 'Attacker', 'Key', 85, 'AC Milan', 'https://media.api-sports.io/football/teams/489.png', '1999-06-10', 7.3)
ON CONFLICT (api_player_id) DO NOTHING;

-- ============================================================================
-- DONE! All Fantasy migrations applied successfully
-- ============================================================================

SELECT '✅ Fantasy migrations completed! Run check_fantasy_status.sql to verify.' as status;
