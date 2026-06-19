-- ─────────────────────────────────────────────────────────────────────────────
-- Live Fantasy (Phase A): schema + admin config. Pots mutualized with Match Royale.
-- ─────────────────────────────────────────────────────────────────────────────

-- Singleton config (everything admin-editable).
CREATE TABLE IF NOT EXISTS public.lf_config (
  id                 INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  captain_multiplier NUMERIC NOT NULL DEFAULT 2,
  max_transfers      INTEGER NOT NULL DEFAULT 3,
  gk_count           INTEGER NOT NULL DEFAULT 1,
  outfield_per_team  INTEGER NOT NULL DEFAULT 3,        -- 3 from each side
  pool_mode          TEXT NOT NULL DEFAULT 'starters',  -- starters | all
  gk_underdog_tiers  JSONB NOT NULL DEFAULT '[]'::jsonb,
  scoring            JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.lf_config (id, gk_underdog_tiers, scoring) VALUES (1,
  '[{"max_pct":9,"mult":1.5},{"max_pct":19,"mult":1.3},{"max_pct":29,"mult":1.2},{"max_pct":39,"mult":1.1},{"max_pct":49,"mult":1.05}]'::jsonb,
  '{
    "GK":{"goal":20,"assist":10,"pen_saved":12,"clean_sheet":8,"save":2,"save_bonus_3plus":3,"conceded":-1,"yellow":-2,"red":-6,"error_goal":-5,"own_goal":-8},
    "D":{"goal":12,"assist":8,"clean_sheet":6,"shot_on_target":2,"tackle":1,"interception":1,"conceded_per_from_2":-1,"yellow":-2,"red":-6,"error_goal":-4,"own_goal":-8},
    "M":{"goal":10,"assist":6,"shot_on_target":2,"foul_drawn":1,"big_chance":2,"yellow":-2,"red":-6,"error_goal":-4,"own_goal":-8},
    "A":{"goal":8,"assist":5,"shot_on_target":2,"foul_drawn":1,"pen_won":3,"yellow":-2,"red":-6,"pen_missed":-5,"own_goal":-8}
  }'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Activation (per league/team/match), like mr_activation.
CREATE TABLE IF NOT EXISTS public.lf_activation (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope       TEXT NOT NULL,                 -- 'global' | 'league' | 'team' | 'match'
  league_id   UUID, team_id UUID, fixture_id UUID,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.lf_activation (scope, enabled) SELECT 'global', false WHERE NOT EXISTS (SELECT 1 FROM public.lf_activation WHERE scope='global');

-- Mutualize the pot engine: same profiles/assignments, tagged by game.
ALTER TABLE public.mr_pot_assignments ADD COLUMN IF NOT EXISTS game TEXT NOT NULL DEFAULT 'match_royale';  -- 'match_royale' | 'live_fantasy'

-- A Live Fantasy game = one fixture.
CREATE TABLE IF NOT EXISTS public.lf_games (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id    UUID NOT NULL REFERENCES public.fb_fixtures(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'upcoming',   -- upcoming | open | locked | live | settled
  lock_at       TIMESTAMPTZ,                         -- kickoff
  settled_at    TIMESTAMPTZ,
  gk_underdog   JSONB DEFAULT '{}'::jsonb,           -- computed at lock: per-team gk pick% + multiplier
  pot_amount    INTEGER,                             -- snapshot at settle
  pot_profile_id UUID, pot_kind TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fixture_id)
);
CREATE INDEX IF NOT EXISTS idx_lf_games_status ON public.lf_games(status);

-- The selectable pool for a game (the lineup; updated live as subs come on/off).
CREATE TABLE IF NOT EXISTS public.lf_game_players (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     UUID NOT NULL REFERENCES public.lf_games(id) ON DELETE CASCADE,
  player_id   UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  api_id      BIGINT,
  team_id     UUID, side TEXT,                        -- 'home' | 'away'
  position    TEXT NOT NULL,                          -- 'GK' | 'D' | 'M' | 'A'
  name        TEXT, photo TEXT, shirt_no INTEGER,
  is_starter  BOOLEAN NOT NULL DEFAULT true,
  available   BOOLEAN NOT NULL DEFAULT true,          -- false once subbed off (permanently)
  on_pitch    BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (game_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_lf_gp_game ON public.lf_game_players(game_id);

-- A user's fantasy entry.
CREATE TABLE IF NOT EXISTS public.lf_teams (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id           UUID NOT NULL REFERENCES public.lf_games(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL,
  captain_player_id UUID,
  transfers_used    INTEGER NOT NULL DEFAULT 0,
  score             NUMERIC NOT NULL DEFAULT 0,
  rank              INTEGER,
  locked            BOOLEAN NOT NULL DEFAULT false,
  joined_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_lf_teams_game ON public.lf_teams(game_id, score DESC);

-- The current 7 picks (after transfers).
CREATE TABLE IF NOT EXISTS public.lf_team_players (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES public.lf_teams(id) ON DELETE CASCADE,
  player_id   UUID NOT NULL,
  position    TEXT NOT NULL,                          -- GK | D | M | A
  side        TEXT,                                    -- home | away
  is_captain  BOOLEAN NOT NULL DEFAULT false,
  active      BOOLEAN NOT NULL DEFAULT true,           -- currently counting (false after being transferred out)
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_lf_tp_team ON public.lf_team_players(team_id);

-- RLS: config/activation/games/pool public-read + admin-write; teams owner-scoped.
DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['lf_config','lf_activation','lf_games','lf_game_players'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_r ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_r ON public.%I FOR SELECT USING (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_w ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_w ON public.%I FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())', t, t);
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', t);
  END LOOP;
END $$;
ALTER TABLE public.lf_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lf_team_players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lf_teams_read ON public.lf_teams;
CREATE POLICY lf_teams_read ON public.lf_teams FOR SELECT USING (true);   -- leaderboard is public
DROP POLICY IF EXISTS lf_teams_own ON public.lf_teams;
CREATE POLICY lf_teams_own ON public.lf_teams FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS lf_tp_read ON public.lf_team_players;
CREATE POLICY lf_tp_read ON public.lf_team_players FOR SELECT USING (true);
DROP POLICY IF EXISTS lf_tp_own ON public.lf_team_players;
CREATE POLICY lf_tp_own ON public.lf_team_players FOR ALL USING (EXISTS (SELECT 1 FROM public.lf_teams t WHERE t.id=team_id AND t.user_id=auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.lf_teams t WHERE t.id=team_id AND t.user_id=auth.uid()));
GRANT SELECT ON public.lf_teams, public.lf_team_players TO anon, authenticated;
GRANT ALL ON public.lf_teams, public.lf_team_players TO authenticated;
