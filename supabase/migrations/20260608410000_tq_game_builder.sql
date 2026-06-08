-- Game Builder fields for Tournament Quest competitions + announcements.
ALTER TABLE public.tq_competitions
  ADD COLUMN IF NOT EXISTS min_players INTEGER,
  ADD COLUMN IF NOT EXISTS max_players INTEGER,
  ADD COLUMN IF NOT EXISTS minimum_level TEXT DEFAULT 'Rookie',
  ADD COLUMN IF NOT EXISTS required_badges UUID[] DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS source_league_id UUID,
  ADD COLUMN IF NOT EXISTS source_season INTEGER,
  ADD COLUMN IF NOT EXISTS rewards_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS opens_at TIMESTAMPTZ; -- date the competition becomes "open"

-- Announcements / celebrations at a tournament moment.
CREATE TABLE IF NOT EXISTS public.tq_announcements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.tq_competitions(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  body           TEXT,
  phase_key      TEXT,          -- optional moment, e.g. 'group_end', 'QF', 'final'
  celebrate      BOOLEAN NOT NULL DEFAULT false, -- triggers an in-app celebration
  published_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tq_announcements_comp ON public.tq_announcements(competition_id);
ALTER TABLE public.tq_announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tq_announcements_read ON public.tq_announcements;
CREATE POLICY tq_announcements_read ON public.tq_announcements FOR SELECT USING (published_at IS NOT NULL);
DROP POLICY IF EXISTS tq_announcements_admin ON public.tq_announcements;
CREATE POLICY tq_announcements_admin ON public.tq_announcements FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT SELECT ON public.tq_announcements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tq_announcements TO authenticated;
