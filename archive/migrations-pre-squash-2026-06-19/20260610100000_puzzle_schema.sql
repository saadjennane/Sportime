-- ─────────────────────────────────────────────────────────────────────────────
-- Daily puzzle framework — "Guess the Score" (LinkedIn-puzzle style).
-- 30 games per difficulty level, each 5 timed rounds. Heat feedback, streaks+freezes.
-- ─────────────────────────────────────────────────────────────────────────────

-- Tunable config (single row).
CREATE TABLE IF NOT EXISTS public.puzzle_config (
  id               INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  rounds_per_game  INTEGER NOT NULL DEFAULT 5,
  -- difficulty weights (sum ~1) and level cutoffs (0-100, higher = harder)
  weight_pop       NUMERIC NOT NULL DEFAULT 0.5,
  weight_rarity    NUMERIC NOT NULL DEFAULT 0.3,
  weight_recency   NUMERIC NOT NULL DEFAULT 0.2,
  easy_max         NUMERIC NOT NULL DEFAULT 33,
  medium_max       NUMERIC NOT NULL DEFAULT 66,
  too_easy_max     NUMERIC NOT NULL DEFAULT 8,    -- below = trivial (guardrail)
  impossible_min   NUMERIC NOT NULL DEFAULT 92,   -- above = near-impossible
  -- heat thresholds by manhattan distance |dh|+|da|
  heat_bands       JSONB NOT NULL DEFAULT '[{"max":0,"key":"exact"},{"max":2,"key":"burning"},{"max":4,"key":"hot"},{"max":6,"key":"warm"},{"max":999,"key":"cold"}]'::jsonb,
  max_attempts     INTEGER NOT NULL DEFAULT 5,
  -- freeze + monthly rewards
  freeze_every_days INTEGER NOT NULL DEFAULT 7,   -- earn 1 freeze per streak of N
  max_freezes       INTEGER NOT NULL DEFAULT 3,
  monthly_milestones JSONB NOT NULL DEFAULT '[{"day":10},{"day":20},{"day":"last"}]'::jsonb,
  -- daily cycle + daily prize pot for the fastest players
  daily_cutover_hour INTEGER NOT NULL DEFAULT 8,  -- puzzle day runs 8h -> 8h
  prize_enabled      BOOLEAN NOT NULL DEFAULT false,
  prize_top_pct      NUMERIC NOT NULL DEFAULT 10, -- top X% share the pot
  prize_pot_default  INTEGER NOT NULL DEFAULT 0,  -- coins
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.puzzle_config (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Team popularity (0-100). Default auto-computed from historical standings; admin-editable.
CREATE TABLE IF NOT EXISTS public.team_popularity (
  team_api_id  BIGINT PRIMARY KEY,
  team_name    TEXT,
  popularity   INTEGER NOT NULL DEFAULT 50,
  is_manual    BOOLEAN NOT NULL DEFAULT false,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A daily game (per level).
CREATE TABLE IF NOT EXISTS public.puzzle_games (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type        TEXT NOT NULL DEFAULT 'guess_score',
  level            TEXT NOT NULL,                  -- easy | medium | hard
  puzzle_date      DATE,
  seq              INTEGER,                        -- order in the queue (for reordering)
  status           TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | live | archived
  difficulty_score NUMERIC,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_type, level, puzzle_date)
);
CREATE INDEX IF NOT EXISTS idx_puzzle_games_date ON public.puzzle_games(level, puzzle_date);

-- A round inside a game (the answer lives here — NOT client-readable).
CREATE TABLE IF NOT EXISTS public.puzzle_rounds (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id          UUID NOT NULL REFERENCES public.puzzle_games(id) ON DELETE CASCADE,
  round_no         INTEGER NOT NULL,
  fixture_id       UUID,
  home_team_api    BIGINT, home_name TEXT, home_logo TEXT,
  away_team_api    BIGINT, away_name TEXT, away_logo TEXT,
  season           INTEGER,
  competition_name TEXT,                          -- "La Liga", "Champions League"
  stage            TEXT,                           -- "Matchday 12", "Quarter-finals"
  match_date       DATE,
  answer_home      INTEGER NOT NULL,
  answer_away      INTEGER NOT NULL,
  hints            JSONB NOT NULL DEFAULT '[]'::jsonb,
  difficulty_score NUMERIC,
  UNIQUE (game_id, round_no)
);

-- A user's play of a game (timed).
CREATE TABLE IF NOT EXISTS public.puzzle_plays (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  game_id       UUID NOT NULL REFERENCES public.puzzle_games(id) ON DELETE CASCADE,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  total_time_ms INTEGER,
  rounds_solved INTEGER NOT NULL DEFAULT 0,
  score         INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, game_id)
);

-- Per-round attempts within a play.
CREATE TABLE IF NOT EXISTS public.puzzle_round_attempts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  play_id     UUID NOT NULL REFERENCES public.puzzle_plays(id) ON DELETE CASCADE,
  round_no    INTEGER NOT NULL,
  guesses     JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{h,a,heat}]
  solved      BOOLEAN NOT NULL DEFAULT false,
  attempts    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (play_id, round_no)
);

-- Per-user, per-level progress (streak + freezes + stats).
CREATE TABLE IF NOT EXISTS public.puzzle_progress (
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  level           TEXT NOT NULL,
  current_streak  INTEGER NOT NULL DEFAULT 0,
  best_streak     INTEGER NOT NULL DEFAULT 0,
  freezes         INTEGER NOT NULL DEFAULT 0,
  last_played     DATE,
  games_played    INTEGER NOT NULL DEFAULT 0,
  games_won       INTEGER NOT NULL DEFAULT 0,
  total_score     INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, level)
);

-- The user's chosen difficulty (set on first play, changeable).
CREATE TABLE IF NOT EXISTS public.puzzle_user_prefs (
  user_id    UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  level      TEXT NOT NULL DEFAULT 'easy',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Daily prize pot per level/day (top X% by chrono share it; distributed next day at cutover hour).
CREATE TABLE IF NOT EXISTS public.puzzle_daily_prizes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level         TEXT NOT NULL,
  puzzle_date   DATE NOT NULL,
  pot           INTEGER NOT NULL DEFAULT 0,
  top_pct       NUMERIC NOT NULL DEFAULT 10,
  distributed   BOOLEAN NOT NULL DEFAULT false,
  distributed_at TIMESTAMPTZ,
  winners       INTEGER,
  UNIQUE (level, puzzle_date)
);
ALTER TABLE public.puzzle_daily_prizes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pdp_read ON public.puzzle_daily_prizes; CREATE POLICY pdp_read ON public.puzzle_daily_prizes FOR SELECT USING (true);
DROP POLICY IF EXISTS pdp_admin ON public.puzzle_daily_prizes; CREATE POLICY pdp_admin ON public.puzzle_daily_prizes FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT SELECT ON public.puzzle_daily_prizes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.puzzle_daily_prizes TO authenticated;

-- RLS: config/popularity/games public-read; rounds NOT readable (answers hidden); plays/progress owner-scoped.
ALTER TABLE public.puzzle_config        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_popularity      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puzzle_games         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puzzle_rounds        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puzzle_plays         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puzzle_round_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puzzle_progress      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puzzle_user_prefs    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pc_read ON public.puzzle_config;   CREATE POLICY pc_read ON public.puzzle_config FOR SELECT USING (true);
DROP POLICY IF EXISTS tp_read ON public.team_popularity; CREATE POLICY tp_read ON public.team_popularity FOR SELECT USING (true);
DROP POLICY IF EXISTS pg_read ON public.puzzle_games;    CREATE POLICY pg_read ON public.puzzle_games FOR SELECT USING (true);
-- rounds: no select policy (answers stay server-side; served via RPC)
DROP POLICY IF EXISTS pp_own ON public.puzzle_plays;          CREATE POLICY pp_own ON public.puzzle_plays FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS pra_own ON public.puzzle_round_attempts; CREATE POLICY pra_own ON public.puzzle_round_attempts FOR SELECT USING (EXISTS (SELECT 1 FROM public.puzzle_plays pl WHERE pl.id = play_id AND pl.user_id = auth.uid()));
DROP POLICY IF EXISTS ppr_own ON public.puzzle_progress;       CREATE POLICY ppr_own ON public.puzzle_progress FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS pup_own ON public.puzzle_user_prefs;     CREATE POLICY pup_own ON public.puzzle_user_prefs FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- admin manage catalog
DROP POLICY IF EXISTS pc_admin ON public.puzzle_config;   CREATE POLICY pc_admin ON public.puzzle_config FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS tp_admin ON public.team_popularity; CREATE POLICY tp_admin ON public.team_popularity FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS pg_admin ON public.puzzle_games;    CREATE POLICY pg_admin ON public.puzzle_games FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS pr_admin ON public.puzzle_rounds;   CREATE POLICY pr_admin ON public.puzzle_rounds FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT ON public.puzzle_config, public.team_popularity, public.puzzle_games TO anon, authenticated;
GRANT SELECT ON public.puzzle_plays, public.puzzle_round_attempts, public.puzzle_progress, public.puzzle_user_prefs TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.team_popularity, public.puzzle_games, public.puzzle_rounds, public.puzzle_config TO authenticated;
