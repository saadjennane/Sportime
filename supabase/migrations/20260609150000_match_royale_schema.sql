-- ─────────────────────────────────────────────────────────────────────────────
-- Match Royale: live prediction battle-royale on a fixture.
-- Players answer "which team gets the next corner/goal/card/…"; a wrong answer
-- costs a life; at 0 lives you're out; survivors of the sudden-death question win.
-- Resolution reads fb_fixture_events (discrete) + fb_fixture_statistics (deltas).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mr_games (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id       UUID REFERENCES public.fb_fixtures(id) ON DELETE SET NULL,
  api_fixture_id   BIGINT,
  name             TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'draft',  -- draft | open | live | finished | cancelled
  lives_per_player INTEGER NOT NULL DEFAULT 3,
  entry_cost       INTEGER NOT NULL DEFAULT 0,
  reward_pack_id   UUID,
  min_players      INTEGER,
  max_players      INTEGER,
  tier             TEXT DEFAULT 'amateur',
  starts_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mr_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id         UUID NOT NULL REFERENCES public.mr_games(id) ON DELETE CASCADE,
  seq             INTEGER NOT NULL,
  kind            TEXT NOT NULL,                   -- next_goal | next_card | next_corner | next_shot | next_foul | next_sub
  prompt          TEXT NOT NULL,
  options         JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{key:'home',label:'Argentina'},{key:'away',label:'Honduras'}]
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | open | resolved | void
  opened_at       TIMESTAMPTZ,
  deadline        TIMESTAMPTZ,                     -- answers close here
  baseline        JSONB,                           -- snapshot at open (event counts / stat totals)
  correct_key     TEXT,
  resolved_at     TIMESTAMPTZ,
  is_sudden_death BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_mr_questions_game ON public.mr_questions(game_id, status);

CREATE TABLE IF NOT EXISTS public.mr_participants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       UUID NOT NULL REFERENCES public.mr_games(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  lives         INTEGER NOT NULL DEFAULT 3,
  status        TEXT NOT NULL DEFAULT 'alive',     -- alive | eliminated
  is_winner     BOOLEAN NOT NULL DEFAULT false,
  eliminated_at TIMESTAMPTZ,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_mr_participants_game ON public.mr_participants(game_id, status);

CREATE TABLE IF NOT EXISTS public.mr_answers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.mr_questions(id) ON DELETE CASCADE,
  game_id     UUID NOT NULL REFERENCES public.mr_games(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  option_key  TEXT NOT NULL,
  is_correct  BOOLEAN,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (question_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_mr_answers_q ON public.mr_answers(question_id);

-- RLS: catalog/state public-read; answers owner-scoped; writes via SECURITY DEFINER RPCs.
ALTER TABLE public.mr_games        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mr_questions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mr_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mr_answers      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mr_games_read ON public.mr_games;        CREATE POLICY mr_games_read ON public.mr_games FOR SELECT USING (true);
DROP POLICY IF EXISTS mr_questions_read ON public.mr_questions; CREATE POLICY mr_questions_read ON public.mr_questions FOR SELECT USING (true);
DROP POLICY IF EXISTS mr_participants_read ON public.mr_participants; CREATE POLICY mr_participants_read ON public.mr_participants FOR SELECT USING (true);
DROP POLICY IF EXISTS mr_answers_own ON public.mr_answers;     CREATE POLICY mr_answers_own ON public.mr_answers FOR SELECT USING (user_id = auth.uid());
-- Admin can manage the catalog.
DROP POLICY IF EXISTS mr_games_admin ON public.mr_games;       CREATE POLICY mr_games_admin ON public.mr_games FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS mr_questions_admin ON public.mr_questions; CREATE POLICY mr_questions_admin ON public.mr_questions FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT ON public.mr_games, public.mr_questions, public.mr_participants, public.mr_answers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.mr_games, public.mr_questions TO authenticated;
