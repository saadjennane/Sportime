-- ============================================================================
-- API-Football Staging Tables (fb_*)
-- These tables store raw API-Football data before syncing to production tables
-- ============================================================================

-- =============================================================================
-- TABLE: fb_leagues
-- Raw league data from API-Football
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.fb_leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_league_id BIGINT UNIQUE NOT NULL, -- API-Football league ID
  name TEXT NOT NULL,
  country TEXT,
  logo TEXT,
  type TEXT, -- e.g., 'League', 'Cup'
  season INTEGER, -- e.g., 2024
  payload JSONB, -- Full API response for reference
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fb_leagues_api_id ON public.fb_leagues(api_league_id);
CREATE INDEX IF NOT EXISTS idx_fb_leagues_season ON public.fb_leagues(season);

-- =============================================================================
-- TABLE: fb_teams
-- Raw team data from API-Football
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.fb_teams (
  id BIGINT PRIMARY KEY, -- API-Football team ID (serves as both id and api_id)
  name TEXT NOT NULL,
  code TEXT, -- 3-letter code (e.g., 'MCI')
  country TEXT,
  founded INTEGER,
  national BOOLEAN,
  logo TEXT,
  venue_name TEXT,
  venue_city TEXT,
  venue_capacity INTEGER,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fb_teams_id ON public.fb_teams(id);
CREATE INDEX IF NOT EXISTS idx_fb_teams_name ON public.fb_teams(name);

-- =============================================================================
-- TABLE: fb_players
-- Raw player data from API-Football
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.fb_players (
  id BIGINT PRIMARY KEY, -- API-Football player ID (serves as both id and api_id)
  name TEXT NOT NULL,
  firstname TEXT,
  lastname TEXT,
  age INTEGER,
  birth_date DATE,
  birth_place TEXT,
  birth_country TEXT,
  nationality TEXT,
  height TEXT, -- e.g., '180 cm'
  weight TEXT, -- e.g., '75 kg'
  photo TEXT,
  position TEXT, -- e.g., 'Midfielder', 'Goalkeeper'
  number INTEGER, -- Jersey number
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fb_players_id ON public.fb_players(id);
CREATE INDEX IF NOT EXISTS idx_fb_players_name ON public.fb_players(name);
CREATE INDEX IF NOT EXISTS idx_fb_players_position ON public.fb_players(position);

-- =============================================================================
-- TABLE: fb_fixtures
-- Raw fixture data from API-Football
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.fb_fixtures (
  id BIGINT PRIMARY KEY, -- API-Football fixture ID
  api_id BIGINT UNIQUE, -- Alias
  date TIMESTAMPTZ NOT NULL,
  status TEXT, -- e.g., 'NS', 'FT', '1H', 'HT', '2H'
  league_id UUID, -- Reference to fb_leagues (optional)
  home_team_id BIGINT, -- API-Football team ID
  away_team_id BIGINT, -- API-Football team ID
  goals_home INTEGER,
  goals_away INTEGER,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fb_fixtures_api_id ON public.fb_fixtures(id);
CREATE INDEX IF NOT EXISTS idx_fb_fixtures_date ON public.fb_fixtures(date);
CREATE INDEX IF NOT EXISTS idx_fb_fixtures_status ON public.fb_fixtures(status);
CREATE INDEX IF NOT EXISTS idx_fb_fixtures_teams ON public.fb_fixtures(home_team_id, away_team_id);

-- =============================================================================
-- TABLE: fb_odds
-- Raw odds data from API-Football
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.fb_odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id BIGINT NOT NULL, -- API-Football fixture ID
  bookmaker_name TEXT NOT NULL,
  home_win DECIMAL(10, 2),
  draw DECIMAL(10, 2),
  away_win DECIMAL(10, 2),
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fixture_id, bookmaker_name)
);

CREATE INDEX IF NOT EXISTS idx_fb_odds_fixture ON public.fb_odds(fixture_id);
CREATE INDEX IF NOT EXISTS idx_fb_odds_bookmaker ON public.fb_odds(bookmaker_name);

-- =============================================================================
-- RLS Policies
-- =============================================================================
ALTER TABLE public.fb_leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fb_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fb_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fb_fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fb_odds ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to fb_leagues" ON public.fb_leagues;
DROP POLICY IF EXISTS "Allow public read access to fb_teams" ON public.fb_teams;
DROP POLICY IF EXISTS "Allow public read access to fb_players" ON public.fb_players;
DROP POLICY IF EXISTS "Allow public read access to fb_fixtures" ON public.fb_fixtures;
DROP POLICY IF EXISTS "Allow public read access to fb_odds" ON public.fb_odds;
DROP POLICY IF EXISTS "Allow service_role full access to fb_leagues" ON public.fb_leagues;
DROP POLICY IF EXISTS "Allow service_role full access to fb_teams" ON public.fb_teams;
DROP POLICY IF EXISTS "Allow service_role full access to fb_players" ON public.fb_players;
DROP POLICY IF EXISTS "Allow service_role full access to fb_fixtures" ON public.fb_fixtures;
DROP POLICY IF EXISTS "Allow service_role full access to fb_odds" ON public.fb_odds;

-- Allow public read access for all staging tables
CREATE POLICY "Allow public read access to fb_leagues"
  ON public.fb_leagues FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access to fb_teams"
  ON public.fb_teams FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access to fb_players"
  ON public.fb_players FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access to fb_fixtures"
  ON public.fb_fixtures FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access to fb_odds"
  ON public.fb_odds FOR SELECT
  USING (true);

-- Only service_role can modify staging tables
CREATE POLICY "Allow service_role full access to fb_leagues"
  ON public.fb_leagues FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service_role full access to fb_teams"
  ON public.fb_teams FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service_role full access to fb_players"
  ON public.fb_players FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service_role full access to fb_fixtures"
  ON public.fb_fixtures FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service_role full access to fb_odds"
  ON public.fb_odds FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON public.fb_leagues TO authenticated, anon;
GRANT SELECT ON public.fb_teams TO authenticated, anon;
GRANT SELECT ON public.fb_players TO authenticated, anon;
GRANT SELECT ON public.fb_fixtures TO authenticated, anon;
GRANT SELECT ON public.fb_odds TO authenticated, anon;

GRANT ALL ON public.fb_leagues TO service_role;
GRANT ALL ON public.fb_teams TO service_role;
GRANT ALL ON public.fb_players TO service_role;
GRANT ALL ON public.fb_fixtures TO service_role;
GRANT ALL ON public.fb_odds TO service_role;

-- Verification
SELECT 'API-Football staging tables created successfully!' as status;
