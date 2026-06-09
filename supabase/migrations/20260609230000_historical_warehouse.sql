-- ─────────────────────────────────────────────────────────────────────────────
-- Historical data warehouse — foundation for the future game generator
-- (Guess the score / Guess the player / Fact or Cap). Seed La Liga 2010-2025 first.
-- ─────────────────────────────────────────────────────────────────────────────

-- Clean slate for these brand-new warehouse tables (no important data yet).
DROP TABLE IF EXISTS public.fb_standings CASCADE;
DROP TABLE IF EXISTS public.fb_player_season_stats CASCADE;
DROP TABLE IF EXISTS public.fb_transfers CASCADE;
DROP TABLE IF EXISTS public.seed_runs CASCADE;

-- Multi-season fixtures.
ALTER TABLE public.fb_fixtures ADD COLUMN IF NOT EXISTS season INTEGER;
ALTER TABLE public.fb_fixtures ADD COLUMN IF NOT EXISTS round TEXT;
CREATE INDEX IF NOT EXISTS idx_fb_fixtures_season ON public.fb_fixtures(league_id, season);

-- Final tables per season.
CREATE TABLE IF NOT EXISTS public.fb_standings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id     UUID,
  league_api_id BIGINT,
  season        INTEGER NOT NULL,
  team_api_id   BIGINT NOT NULL,
  team_name     TEXT,
  rank          INTEGER,
  points        INTEGER,
  played        INTEGER,
  win           INTEGER,
  draw          INTEGER,
  lose          INTEGER,
  goals_for     INTEGER,
  goals_against INTEGER,
  goals_diff    INTEGER,
  form          TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (league_api_id, season, team_api_id)
);
CREATE INDEX IF NOT EXISTS idx_fb_standings_season ON public.fb_standings(league_api_id, season);

-- Per-player, per-season stats (the raw material for facts).
CREATE TABLE IF NOT EXISTS public.fb_player_season_stats (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     BIGINT NOT NULL,
  player_name   TEXT,
  season        INTEGER NOT NULL,
  league_api_id BIGINT,
  team_api_id   BIGINT,
  team_name     TEXT,
  position      TEXT,
  appearances   INTEGER,
  lineups       INTEGER,
  minutes       INTEGER,
  goals         INTEGER,
  assists       INTEGER,
  yellow        INTEGER,
  red           INTEGER,
  rating        NUMERIC,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, season, team_api_id, league_api_id)
);
CREATE INDEX IF NOT EXISTS idx_fb_pss_season ON public.fb_player_season_stats(league_api_id, season);
CREATE INDEX IF NOT EXISTS idx_fb_pss_player ON public.fb_player_season_stats(player_id);

-- Transfer history (club trail — no fee available from API-Football).
CREATE TABLE IF NOT EXISTS public.fb_transfers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id      BIGINT NOT NULL,
  player_name    TEXT,
  transfer_date  DATE,
  type           TEXT,
  team_out_api   BIGINT,
  team_out_name  TEXT,
  team_in_api    BIGINT,
  team_in_name   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, transfer_date, team_in_api, team_out_api)
);
CREATE INDEX IF NOT EXISTS idx_fb_transfers_player ON public.fb_transfers(player_id);

-- Seed journal (resumable, idempotent).
CREATE TABLE IF NOT EXISTS public.seed_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_api_id BIGINT NOT NULL,
  season        INTEGER,
  phase         TEXT NOT NULL,            -- fixtures | standings | players | transfers
  status        TEXT NOT NULL,            -- done | error
  detail        JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (league_api_id, season, phase)
);

-- RLS: read public, writes via service role (the seed edge function).
ALTER TABLE public.fb_standings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fb_player_season_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fb_transfers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seed_runs              ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['fb_standings','fb_player_season_stats','fb_transfers','seed_runs'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_read ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_read ON public.%I FOR SELECT USING (true)', t, t);
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', t);
  END LOOP;
END $$;
