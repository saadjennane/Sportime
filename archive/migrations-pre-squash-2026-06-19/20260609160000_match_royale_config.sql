-- ─────────────────────────────────────────────────────────────────────────────
-- Match Royale — Phase A: gameplay config, event catalog, pot profiles,
-- assignment rules (priority match>team>league>global) and activation.
-- ─────────────────────────────────────────────────────────────────────────────

-- Gameplay config (single row).
CREATE TABLE IF NOT EXISTS public.mr_config (
  id                INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  hearts            INTEGER NOT NULL DEFAULT 3,
  questions_pre     INTEGER NOT NULL DEFAULT 5,   -- first-half questions answered pre-match
  questions_half    INTEGER NOT NULL DEFAULT 5,   -- second-half questions answered at half-time
  tie_break_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.mr_config (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Event catalog (binary questions). resolution: 'stat_delta' (team A/B via cumulative counter)
-- or 'event' (yes/no via /fixtures/events).
CREATE TABLE IF NOT EXISTS public.mr_event_catalog (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT NOT NULL UNIQUE,
  label         TEXT NOT NULL,
  answer_type   TEXT NOT NULL,                 -- 'team' | 'yesno'
  resolution    TEXT NOT NULL,                 -- 'stat_delta' | 'event'
  source_key    TEXT NOT NULL,                 -- stat type ('Corner Kicks') or event type ('Goal','Card')
  detail_filter TEXT,                          -- optional event detail contains-filter ('Penalty')
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.mr_event_catalog (key, label, answer_type, resolution, source_key, detail_filter, sort_order) VALUES
  ('first_corner',         'First corner',          'team',  'stat_delta', 'Corner Kicks', NULL, 0),
  ('first_shot',           'First shot',            'team',  'stat_delta', 'Total Shots',  NULL, 1),
  ('first_shot_on_target', 'First shot on target',  'team',  'stat_delta', 'Shots on Goal',NULL, 2),
  ('first_offside',        'First offside',         'team',  'stat_delta', 'Offsides',     NULL, 3),
  ('goal_in_half',         'A goal this half?',     'yesno', 'event',      'Goal',         NULL, 4),
  ('card_in_half',         'A card this half?',     'yesno', 'event',      'Card',         NULL, 5),
  ('penalty_in_half',      'A penalty this half?',  'yesno', 'event',      'Goal',         'Penalty', 6)
ON CONFLICT (key) DO NOTHING;

-- Reusable pot profiles.
CREATE TABLE IF NOT EXISTS public.mr_pot_profiles (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  type               TEXT NOT NULL,            -- 'fixed' | 'progressive' | 'funded'
  fixed_amount       INTEGER,                  -- fixed
  tiers              JSONB DEFAULT '[]'::jsonb,-- progressive: [{min,max,amount}]
  entry_cost         INTEGER,                  -- funded
  redistribution_pct INTEGER DEFAULT 100,      -- funded
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.mr_pot_profiles (name, type, fixed_amount) VALUES
  ('Standard', 'fixed', 1000), ('Premium', 'fixed', 5000), ('Blockbuster', 'fixed', 10000)
ON CONFLICT DO NOTHING;
INSERT INTO public.mr_pot_profiles (name, type, tiers)
SELECT 'Champions Progressive', 'progressive', '[{"min":1,"max":49,"amount":1000},{"min":50,"max":199,"amount":5000},{"min":200,"max":999,"amount":10000},{"min":1000,"max":null,"amount":25000}]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.mr_pot_profiles WHERE name = 'Champions Progressive');
INSERT INTO public.mr_pot_profiles (name, type, entry_cost, redistribution_pct)
SELECT 'Community Funded', 'funded', 50, 90
WHERE NOT EXISTS (SELECT 1 FROM public.mr_pot_profiles WHERE name = 'Community Funded');

-- Assignment rules (priority: match > team > league > global).
CREATE TABLE IF NOT EXISTS public.mr_pot_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope           TEXT NOT NULL,               -- 'global' | 'league' | 'team' | 'match'
  league_id       UUID,                        -- fb_leagues (scope=league)
  team_id         UUID,                        -- fb_teams (scope=team)
  fixture_id      UUID,                        -- fb_fixtures (scope=match)
  pot_profile_id  UUID REFERENCES public.mr_pot_profiles(id) ON DELETE CASCADE,
  override_amount INTEGER,                      -- scope=match: a one-off fixed amount
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mr_assign_scope ON public.mr_pot_assignments(scope, is_active);

-- Activation: where Match Royale is offered.
CREATE TABLE IF NOT EXISTS public.mr_activation (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope      TEXT NOT NULL,                     -- 'league' | 'fixture'
  target_id  UUID NOT NULL,
  enabled    BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scope, target_id)
);

-- Extend the game + questions + participants for the finalized rules.
ALTER TABLE public.mr_games        ADD COLUMN IF NOT EXISTS pot_profile_id UUID;
ALTER TABLE public.mr_games        ADD COLUMN IF NOT EXISTS pot_amount INTEGER;          -- resolved pot
ALTER TABLE public.mr_games        ADD COLUMN IF NOT EXISTS hearts INTEGER NOT NULL DEFAULT 3;
ALTER TABLE public.mr_questions    ADD COLUMN IF NOT EXISTS phase TEXT;                  -- 'pre_match' | 'half_time'
ALTER TABLE public.mr_questions    ADD COLUMN IF NOT EXISTS answer_type TEXT;            -- 'team' | 'yesno'
ALTER TABLE public.mr_questions    ADD COLUMN IF NOT EXISTS catalog_key TEXT;
ALTER TABLE public.mr_questions    ADD COLUMN IF NOT EXISTS half INTEGER;                -- 1 | 2
ALTER TABLE public.mr_questions    ADD COLUMN IF NOT EXISTS is_tie_break BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.mr_participants ADD COLUMN IF NOT EXISTS tie_break_answer TEXT;       -- 'yes' | 'no'
ALTER TABLE public.mr_participants ADD COLUMN IF NOT EXISTS prize_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.mr_participants ADD COLUMN IF NOT EXISTS eliminated_question_seq INTEGER;

-- RLS: catalog/config public-read, admin-write.
ALTER TABLE public.mr_config           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mr_event_catalog    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mr_pot_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mr_pot_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mr_activation       ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['mr_config','mr_event_catalog','mr_pot_profiles','mr_pot_assignments','mr_activation'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_read ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_read ON public.%I FOR SELECT USING (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_admin ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_admin ON public.%I FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())', t, t);
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END $$;

-- Resolve which pot applies to a fixture (priority match > team > league > global).
CREATE OR REPLACE FUNCTION public.mr_resolve_pot(p_fixture_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_league UUID; v_home UUID; v_away UUID; r RECORD;
BEGIN
  SELECT league_id, home_team_id, away_team_id INTO v_league, v_home, v_away FROM public.fb_fixtures WHERE id = p_fixture_id;
  -- match
  SELECT * INTO r FROM public.mr_pot_assignments WHERE is_active AND scope='match' AND fixture_id=p_fixture_id LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('scope','match','pot_profile_id',r.pot_profile_id,'override_amount',r.override_amount); END IF;
  -- team
  SELECT * INTO r FROM public.mr_pot_assignments WHERE is_active AND scope='team' AND team_id IN (v_home, v_away) LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('scope','team','pot_profile_id',r.pot_profile_id,'override_amount',r.override_amount); END IF;
  -- league
  SELECT * INTO r FROM public.mr_pot_assignments WHERE is_active AND scope='league' AND league_id=v_league LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('scope','league','pot_profile_id',r.pot_profile_id,'override_amount',r.override_amount); END IF;
  -- global
  SELECT * INTO r FROM public.mr_pot_assignments WHERE is_active AND scope='global' LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('scope','global','pot_profile_id',r.pot_profile_id,'override_amount',r.override_amount); END IF;
  RETURN jsonb_build_object('scope', null);
END; $$;
GRANT EXECUTE ON FUNCTION public.mr_resolve_pot(UUID) TO authenticated, anon;
