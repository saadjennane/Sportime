-- ─────────────────────────────────────────────────────────────────────────────
-- Proprietary Transfermarkt warehouse (seeded offline via worldfootballR).
-- Flow: League → Clubs (per season over a period) → Players (squads) → bio /
-- transfers (with FEES) / market-value history. Kept separate from fb_* (API-Football).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tm_leagues (
  league_id   TEXT PRIMARY KEY,         -- TM competition code, e.g. 'ES1'
  name        TEXT NOT NULL,
  country     TEXT,
  tier        INTEGER,
  tm_url      TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tm_clubs (
  club_id     BIGINT PRIMARY KEY,       -- TM club id
  name        TEXT NOT NULL,
  country     TEXT,
  founded     INTEGER,
  stadium     TEXT,
  logo_url    TEXT,
  tm_url      TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- All clubs of a league for each season (the "predefined period").
CREATE TABLE IF NOT EXISTS public.tm_club_seasons (
  league_id   TEXT NOT NULL REFERENCES public.tm_leagues(league_id) ON DELETE CASCADE,
  season      INTEGER NOT NULL,
  club_id     BIGINT NOT NULL,
  PRIMARY KEY (league_id, season, club_id)
);
CREATE INDEX IF NOT EXISTS idx_tm_club_seasons_club ON public.tm_club_seasons(club_id);

CREATE TABLE IF NOT EXISTS public.tm_players (
  player_id            BIGINT PRIMARY KEY,   -- TM player id
  name                 TEXT NOT NULL,
  full_name            TEXT,
  date_of_birth        DATE,
  birth_place          TEXT,
  nationality          TEXT,
  second_nationality   TEXT,
  position             TEXT,                 -- Goalkeeper / Defender / Midfield / Attack
  sub_position         TEXT,                 -- Centre-Back, Right Winger...
  foot                 TEXT,
  height_cm            INTEGER,
  current_club_id      BIGINT,
  current_market_value_eur BIGINT,
  retired              BOOLEAN DEFAULT false,
  photo_url            TEXT,
  tm_url               TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tm_players_name ON public.tm_players(name);

-- A player belonging to a club's squad for a season (from squad listings).
CREATE TABLE IF NOT EXISTS public.tm_squad_memberships (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id        BIGINT NOT NULL,
  club_id          BIGINT NOT NULL,
  season           INTEGER NOT NULL,
  age              INTEGER,
  market_value_eur BIGINT,
  UNIQUE (player_id, club_id, season)
);
CREATE INDEX IF NOT EXISTS idx_tm_squad_player ON public.tm_squad_memberships(player_id);
CREATE INDEX IF NOT EXISTS idx_tm_squad_club ON public.tm_squad_memberships(club_id, season);

-- Full transfer history per player (with fees) — clubs may be outside our leagues, so names kept inline.
CREATE TABLE IF NOT EXISTS public.tm_transfers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id           BIGINT NOT NULL,
  player_name         TEXT,
  season              TEXT,                  -- TM season label e.g. '18/19'
  transfer_date       DATE,
  from_club_id        BIGINT, from_club_name TEXT, from_country TEXT,
  to_club_id          BIGINT, to_club_name   TEXT, to_country   TEXT,
  is_loan             BOOLEAN DEFAULT false,
  fee_eur             BIGINT,                -- NULL = unknown; 0 = free
  market_value_eur    BIGINT,
  seq                 INTEGER,               -- order within the player's career
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, transfer_date, to_club_id, from_club_id)
);
CREATE INDEX IF NOT EXISTS idx_tm_transfers_player ON public.tm_transfers(player_id, seq);

-- Market-value history (great signal for notoriety / difficulty).
CREATE TABLE IF NOT EXISTS public.tm_market_values (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   BIGINT NOT NULL,
  value_date  DATE NOT NULL,
  value_eur   BIGINT,
  club_id     BIGINT,
  UNIQUE (player_id, value_date)
);
CREATE INDEX IF NOT EXISTS idx_tm_mv_player ON public.tm_market_values(player_id);

-- Seed journal (resumable).
CREATE TABLE IF NOT EXISTS public.tm_seed_runs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id   TEXT, season INTEGER, phase TEXT, status TEXT, detail JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (league_id, season, phase)
);

-- RLS: public read, admin write.
DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['tm_leagues','tm_clubs','tm_club_seasons','tm_players','tm_squad_memberships','tm_transfers','tm_market_values','tm_seed_runs'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_read ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_read ON public.%I FOR SELECT USING (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_admin ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_admin ON public.%I FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())', t, t);
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', t);
  END LOOP;
END $$;
