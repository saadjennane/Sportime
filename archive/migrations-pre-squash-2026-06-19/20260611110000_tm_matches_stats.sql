-- Warehouse extension: matches+scores, lineups, season player stats, trophies/honours.
-- (Matches/lineups/stats best from FBref; trophies from Transfermarkt/FBref — all via worldfootballR.)

CREATE TABLE IF NOT EXISTS public.tm_matches (
  match_id      TEXT PRIMARY KEY,        -- FBref match id (stable)
  league_id     TEXT, season INTEGER,
  match_date    DATE, matchweek TEXT, stage TEXT,
  home_club_id  BIGINT, home_club_name TEXT,
  away_club_id  BIGINT, away_club_name TEXT,
  home_goals    INTEGER, away_goals INTEGER,
  home_xg       NUMERIC, away_xg NUMERIC,
  venue         TEXT, attendance INTEGER, referee TEXT,
  fbref_url     TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tm_matches_season ON public.tm_matches(league_id, season);

CREATE TABLE IF NOT EXISTS public.tm_lineups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      TEXT NOT NULL,
  club_id       BIGINT, club_name TEXT,
  player_id     BIGINT, player_name TEXT,
  is_starter    BOOLEAN,
  position      TEXT, shirt_number INTEGER, minutes INTEGER,
  goals INTEGER, assists INTEGER, yellow INTEGER, red INTEGER,
  UNIQUE (match_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_tm_lineups_match ON public.tm_lineups(match_id);
CREATE INDEX IF NOT EXISTS idx_tm_lineups_player ON public.tm_lineups(player_id);

CREATE TABLE IF NOT EXISTS public.tm_player_season_stats (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     BIGINT NOT NULL,
  season        INTEGER NOT NULL,
  league_id     TEXT,
  club_id       BIGINT, club_name TEXT,
  position      TEXT,
  appearances   INTEGER, starts INTEGER, minutes INTEGER,
  goals INTEGER, assists INTEGER,
  xg NUMERIC, xa NUMERIC,
  yellow INTEGER, red INTEGER,
  UNIQUE (player_id, season, club_id, league_id)
);
CREATE INDEX IF NOT EXISTS idx_tm_pss_player ON public.tm_player_season_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_tm_pss_season ON public.tm_player_season_stats(league_id, season);

-- Honours: team trophies (club) and individual awards (player).
CREATE TABLE IF NOT EXISTS public.tm_trophies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope       TEXT NOT NULL,             -- 'player' | 'club'
  category    TEXT,                       -- 'team' | 'individual'
  player_id   BIGINT,
  club_id     BIGINT,
  trophy      TEXT NOT NULL,              -- 'UEFA Champions League', "Ballon d'Or", 'La Liga'...
  season      TEXT,                       -- '2021/22' or year label
  year        INTEGER,
  count       INTEGER DEFAULT 1,
  UNIQUE (scope, player_id, club_id, trophy, season)
);
CREATE INDEX IF NOT EXISTS idx_tm_trophies_player ON public.tm_trophies(player_id);
CREATE INDEX IF NOT EXISTS idx_tm_trophies_club ON public.tm_trophies(club_id);

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['tm_matches','tm_lineups','tm_player_season_stats','tm_trophies'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_read ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_read ON public.%I FOR SELECT USING (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_admin ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_admin ON public.%I FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())', t, t);
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', t);
  END LOOP;
END $$;
