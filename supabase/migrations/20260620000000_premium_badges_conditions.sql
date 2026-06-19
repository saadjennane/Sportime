-- Premium + badges as game entry conditions.
-- fantasy_games already has requires_subscription; challenges store it in the
-- config JSON; tq_competitions needs the column (it already has required_badges).
ALTER TABLE public.tq_competitions
  ADD COLUMN IF NOT EXISTS requires_subscription boolean NOT NULL DEFAULT false;
