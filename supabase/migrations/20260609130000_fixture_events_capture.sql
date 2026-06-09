-- ─────────────────────────────────────────────────────────────────────────────
-- Capture live match events + statistics (corners, shots, goals, cards, …).
-- Foundation for the "Match Royale" live prediction game.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fb_fixture_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id     UUID REFERENCES public.fb_fixtures(id) ON DELETE CASCADE,
  api_fixture_id BIGINT NOT NULL,
  seq            INTEGER NOT NULL,          -- index in the API events array (stable ordering / dedup)
  elapsed        INTEGER,
  extra          INTEGER,
  team_api_id    BIGINT,
  team_name      TEXT,
  player         TEXT,
  assist         TEXT,
  type           TEXT,                       -- Goal | Card | subst | Var
  detail         TEXT,                       -- Normal Goal | Yellow Card | Corner | ...
  comments       TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (api_fixture_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_fx_events_fixture ON public.fb_fixture_events(fixture_id);
CREATE INDEX IF NOT EXISTS idx_fx_events_api ON public.fb_fixture_events(api_fixture_id);

CREATE TABLE IF NOT EXISTS public.fb_fixture_statistics (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id     UUID REFERENCES public.fb_fixtures(id) ON DELETE CASCADE,
  api_fixture_id BIGINT NOT NULL,
  team_api_id    BIGINT NOT NULL,
  team_name      TEXT,
  stat_type      TEXT NOT NULL,
  stat_value     TEXT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (api_fixture_id, team_api_id, stat_type)
);
CREATE INDEX IF NOT EXISTS idx_fx_stats_fixture ON public.fb_fixture_statistics(fixture_id);

ALTER TABLE public.fb_fixture_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fb_fixture_statistics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fx_events_read ON public.fb_fixture_events;
CREATE POLICY fx_events_read ON public.fb_fixture_events FOR SELECT USING (true);
DROP POLICY IF EXISTS fx_stats_read ON public.fb_fixture_statistics;
CREATE POLICY fx_stats_read ON public.fb_fixture_statistics FOR SELECT USING (true);
GRANT SELECT ON public.fb_fixture_events, public.fb_fixture_statistics TO anon, authenticated;
