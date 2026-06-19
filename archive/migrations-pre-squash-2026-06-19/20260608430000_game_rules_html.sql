-- Rich-text Rules per game + fantasy visibility.
ALTER TABLE public.challenges       ADD COLUMN IF NOT EXISTS rules_html TEXT;
ALTER TABLE public.fantasy_games    ADD COLUMN IF NOT EXISTS rules_html TEXT;
ALTER TABLE public.fantasy_games    ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.tq_competitions  ADD COLUMN IF NOT EXISTS rules_html TEXT;
