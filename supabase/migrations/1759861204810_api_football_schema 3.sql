-- Add 'season' column to leagues table
ALTER TABLE public.leagues
ADD COLUMN IF NOT EXISTS season TEXT;

-- Add 'league_id' to teams table (nullable as a team might not be in a league currently)
-- Note: This is a simplification. A team can be in multiple leagues.
ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES public.leagues(id) ON DELETE SET NULL;

-- Add 'team_id' to players table (nullable as a player might be a free agent)
-- Note: This is a simplification. A player can have a history with multiple teams.
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

-- Fixtures Table
CREATE TABLE IF NOT EXISTS public.fixtures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id INTEGER NOT NULL UNIQUE,
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  home_team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  away_team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  date TIMESTAMPTZ,
  status TEXT,
  goals_home INTEGER,
  goals_away INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.fixtures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access for fixtures" ON public.fixtures;
CREATE POLICY "Allow public read access for fixtures" ON public.fixtures FOR SELECT USING (true);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_fixtures_updated_at') THEN
    CREATE TRIGGER on_fixtures_updated_at
    BEFORE UPDATE ON public.fixtures
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
  END IF;
END $$;


-- Odds Table
CREATE TABLE IF NOT EXISTS public.odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id UUID NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
  bookmaker_name TEXT NOT NULL,
  home_win REAL,
  draw REAL,
  away_win REAL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT unique_fixture_bookmaker UNIQUE (fixture_id, bookmaker_name)
);

ALTER TABLE public.odds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access for odds" ON public.odds;
CREATE POLICY "Allow public read access for odds" ON public.odds FOR SELECT USING (true);


-- API Sync Config Table
CREATE TABLE IF NOT EXISTS public.api_sync_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL UNIQUE,
  frequency TEXT NOT NULL DEFAULT 'manual',
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.api_sync_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read for sync config" ON public.api_sync_config;
CREATE POLICY "Allow authenticated read for sync config" ON public.api_sync_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow admin write for sync config" ON public.api_sync_config;
CREATE POLICY "Allow admin write for sync config" ON public.api_sync_config FOR ALL USING (false); -- Placeholder for admin-only RLS

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_api_sync_config_updated_at') THEN
    CREATE TRIGGER on_api_sync_config_updated_at
    BEFORE UPDATE ON public.api_sync_config
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
  END IF;
END $$;

-- Seed the config table with the endpoints
INSERT INTO public.api_sync_config (endpoint)
VALUES ('leagues'), ('teams'), ('players'), ('fixtures'), ('odds')
ON CONFLICT (endpoint) DO NOTHING;
