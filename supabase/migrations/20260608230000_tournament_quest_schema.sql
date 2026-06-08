-- ============================================================================
-- TOURNAMENT QUEST — event game data model (config-driven, never hardcoded).
-- All tables are namespaced `tq_` to avoid colliding with the existing
-- teams/matches/groups schema. The flexible rules live in tq_competitions.config_json.
-- ============================================================================

-- ── Competitions ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tq_competitions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  start_date  TIMESTAMPTZ,
  end_date    TIMESTAMPTZ,
  -- draft | open (predictions open) | running | resolved | archived
  status      TEXT NOT NULL DEFAULT 'draft',
  -- Holds ALL configurable rules: scoring weights, qualified_per_group,
  -- best_thirds_count, third_place_match, deadlines, optional_long_term, etc.
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  entry_cost  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Teams (competition-scoped; optional link to a real fb_teams row) ─────────
CREATE TABLE IF NOT EXISTS public.tq_teams (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.tq_competitions(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  short_name     TEXT,
  flag_url       TEXT,
  external_id    BIGINT, -- fb_teams.id if linked
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Groups ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tq_groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id  UUID NOT NULL REFERENCES public.tq_competitions(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  qualified_count INTEGER NOT NULL DEFAULT 2, -- top N qualify directly
  allow_best_third BOOLEAN NOT NULL DEFAULT false
);

-- ── Group ↔ Team membership (seed order + final standing) ─────────────────────
CREATE TABLE IF NOT EXISTS public.tq_group_teams (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID NOT NULL REFERENCES public.tq_groups(id) ON DELETE CASCADE,
  team_id      UUID NOT NULL REFERENCES public.tq_teams(id) ON DELETE CASCADE,
  seed_order   INTEGER NOT NULL DEFAULT 0,
  final_rank   INTEGER, -- resolved final standing in the group (1 = winner)
  UNIQUE (group_id, team_id)
);

-- ── Matches (group OR knockout) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tq_matches (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id        UUID NOT NULL REFERENCES public.tq_competitions(id) ON DELETE CASCADE,
  group_id              UUID REFERENCES public.tq_groups(id) ON DELETE SET NULL,
  knockout_round        TEXT, -- 'R32' | 'R16' | 'QF' | 'SF' | 'F' | '3P'
  bracket_slot          INTEGER, -- position of this tie within its round (0-based)
  team_a_id             UUID REFERENCES public.tq_teams(id) ON DELETE SET NULL,
  team_b_id             UUID REFERENCES public.tq_teams(id) ON DELETE SET NULL,
  start_time            TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'scheduled', -- scheduled|live|finished
  score_a               INTEGER,
  score_b               INTEGER,
  winner_team_id        UUID REFERENCES public.tq_teams(id) ON DELETE SET NULL,
  first_scorer_team_id  UUID REFERENCES public.tq_teams(id) ON DELETE SET NULL,
  is_official_quest_match BOOLEAN NOT NULL DEFAULT false,
  quest_slot_key        TEXT, -- e.g. 'day-3-late' so admin can pick the daily official match
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Prediction windows (open / locked / resolved per phase) ──────────────────
-- phase_key: 'long_term' | 'group' | bracket round keys ('R16','QF',...).
CREATE TABLE IF NOT EXISTS public.tq_phase_windows (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.tq_competitions(id) ON DELETE CASCADE,
  phase_key      TEXT NOT NULL,
  state          TEXT NOT NULL DEFAULT 'open', -- open | locked | resolved
  opens_at       TIMESTAMPTZ,
  locks_at       TIMESTAMPTZ,
  UNIQUE (competition_id, phase_key)
);

-- ── User entries (one per user per competition) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.tq_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competition_id   UUID NOT NULL REFERENCES public.tq_competitions(id) ON DELETE CASCADE,
  total_score      INTEGER NOT NULL DEFAULT 0,
  long_term_score  INTEGER NOT NULL DEFAULT 0,
  group_score      INTEGER NOT NULL DEFAULT 0,
  daily_score      INTEGER NOT NULL DEFAULT 0,
  bracket_score    INTEGER NOT NULL DEFAULT 0,
  exact_score_predictions_count    INTEGER NOT NULL DEFAULT 0,
  correct_bracket_predictions_count INTEGER NOT NULL DEFAULT 0,
  total_goals_prediction           INTEGER,
  total_goals_tiebreak_delta       INTEGER,
  last_prediction_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, competition_id)
);

-- ── Long-term predictions (1 row per entry) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tq_long_term_predictions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id             UUID NOT NULL REFERENCES public.tq_entries(id) ON DELETE CASCADE,
  champion_team_id     UUID REFERENCES public.tq_teams(id) ON DELETE SET NULL,
  finalist_team_id     UUID REFERENCES public.tq_teams(id) ON DELETE SET NULL,
  top_scorer_player_id BIGINT, -- fb_players.id
  total_goals_prediction INTEGER,
  -- optional configurable picks (surprise/disappointment/best_attack/best_defense)
  extras_json          JSONB NOT NULL DEFAULT '{}'::jsonb,
  points_awarded       INTEGER NOT NULL DEFAULT 0,
  locked_at            TIMESTAMPTZ,
  UNIQUE (entry_id)
);

-- ── Group predictions (N rows per entry: predicted qualifiers, ordered) ───────
CREATE TABLE IF NOT EXISTS public.tq_group_predictions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id           UUID NOT NULL REFERENCES public.tq_entries(id) ON DELETE CASCADE,
  group_id           UUID NOT NULL REFERENCES public.tq_groups(id) ON DELETE CASCADE,
  predicted_team_id  UUID NOT NULL REFERENCES public.tq_teams(id) ON DELETE CASCADE,
  predicted_position INTEGER NOT NULL, -- 1 = predicted group winner
  points_awarded     INTEGER NOT NULL DEFAULT 0,
  locked_at          TIMESTAMPTZ,
  UNIQUE (entry_id, group_id, predicted_position)
);

-- ── Daily match predictions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tq_daily_predictions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id                 UUID NOT NULL REFERENCES public.tq_entries(id) ON DELETE CASCADE,
  match_id                 UUID NOT NULL REFERENCES public.tq_matches(id) ON DELETE CASCADE,
  predicted_result         TEXT, -- 'A' | 'draw' | 'B'
  predicted_goal_diff_bucket TEXT, -- 'draw' | '1' | '2plus'
  predicted_first_scorer_team_id UUID REFERENCES public.tq_teams(id) ON DELETE SET NULL,
  predicted_score_a        INTEGER,
  predicted_score_b        INTEGER,
  points_awarded           INTEGER NOT NULL DEFAULT 0,
  locked_at                TIMESTAMPTZ,
  UNIQUE (entry_id, match_id)
);

-- ── Bracket predictions (per round, per advancing team) ──────────────────────
CREATE TABLE IF NOT EXISTS public.tq_bracket_predictions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id                 UUID NOT NULL REFERENCES public.tq_entries(id) ON DELETE CASCADE,
  round_key                TEXT NOT NULL, -- the round the team is predicted to REACH
  match_id                 UUID REFERENCES public.tq_matches(id) ON DELETE SET NULL,
  predicted_winner_team_id UUID NOT NULL REFERENCES public.tq_teams(id) ON DELETE CASCADE,
  points_awarded           INTEGER NOT NULL DEFAULT 0,
  locked_at                TIMESTAMPTZ,
  UNIQUE (entry_id, round_key, predicted_winner_team_id)
);

-- ── Scoring events (audit trail; every point has a traceable source) ─────────
CREATE TABLE IF NOT EXISTS public.tq_scoring_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    UUID NOT NULL REFERENCES public.tq_entries(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL, -- 'long_term' | 'group' | 'daily' | 'bracket'
  source_id   UUID,          -- the prediction row id
  points      INTEGER NOT NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Leaderboard snapshot ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tq_leaderboard (
  competition_id UUID NOT NULL REFERENCES public.tq_competitions(id) ON DELETE CASCADE,
  entry_id       UUID NOT NULL REFERENCES public.tq_entries(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL,
  username       TEXT,
  avatar         TEXT,
  total_score    INTEGER NOT NULL DEFAULT 0,
  rank           INTEGER,
  tiebreak_delta INTEGER,
  PRIMARY KEY (competition_id, entry_id)
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tq_teams_comp     ON public.tq_teams(competition_id);
CREATE INDEX IF NOT EXISTS idx_tq_groups_comp    ON public.tq_groups(competition_id);
CREATE INDEX IF NOT EXISTS idx_tq_group_teams_g  ON public.tq_group_teams(group_id);
CREATE INDEX IF NOT EXISTS idx_tq_matches_comp   ON public.tq_matches(competition_id);
CREATE INDEX IF NOT EXISTS idx_tq_matches_round  ON public.tq_matches(competition_id, knockout_round);
CREATE INDEX IF NOT EXISTS idx_tq_matches_quest  ON public.tq_matches(competition_id, is_official_quest_match);
CREATE INDEX IF NOT EXISTS idx_tq_entries_comp   ON public.tq_entries(competition_id);
CREATE INDEX IF NOT EXISTS idx_tq_grp_pred_entry ON public.tq_group_predictions(entry_id);
CREATE INDEX IF NOT EXISTS idx_tq_daily_entry    ON public.tq_daily_predictions(entry_id);
CREATE INDEX IF NOT EXISTS idx_tq_brk_entry      ON public.tq_bracket_predictions(entry_id);
CREATE INDEX IF NOT EXISTS idx_tq_lb_rank        ON public.tq_leaderboard(competition_id, total_score DESC);

-- ── RLS: catalog tables are public-read; user data is owner-scoped ───────────
ALTER TABLE public.tq_competitions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tq_teams                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tq_groups                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tq_group_teams           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tq_matches               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tq_phase_windows         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tq_leaderboard           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tq_entries               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tq_long_term_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tq_group_predictions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tq_daily_predictions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tq_bracket_predictions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tq_scoring_events        ENABLE ROW LEVEL SECURITY;

-- Public read on catalog + leaderboard
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['tq_competitions','tq_teams','tq_groups','tq_group_teams','tq_matches','tq_phase_windows','tq_leaderboard']
  LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (true);', t||'_read', t);
  END LOOP;
END $$;

-- Owner-scoped read/write on the user's own entry + predictions.
CREATE POLICY tq_entries_owner ON public.tq_entries
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- prediction rows belong to the user via their entry
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['tq_long_term_predictions','tq_group_predictions','tq_daily_predictions','tq_bracket_predictions','tq_scoring_events']
  LOOP
    EXECUTE format($f$
      CREATE POLICY %1$s_owner ON public.%1$I FOR ALL
        USING (EXISTS (SELECT 1 FROM public.tq_entries e WHERE e.id = entry_id AND e.user_id = auth.uid()))
        WITH CHECK (EXISTS (SELECT 1 FROM public.tq_entries e WHERE e.id = entry_id AND e.user_id = auth.uid()));
    $f$, t);
  END LOOP;
END $$;

GRANT SELECT ON public.tq_competitions, public.tq_teams, public.tq_groups, public.tq_group_teams,
  public.tq_matches, public.tq_phase_windows, public.tq_leaderboard TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tq_entries, public.tq_long_term_predictions,
  public.tq_group_predictions, public.tq_daily_predictions, public.tq_bracket_predictions TO authenticated;
GRANT SELECT ON public.tq_scoring_events TO authenticated;
