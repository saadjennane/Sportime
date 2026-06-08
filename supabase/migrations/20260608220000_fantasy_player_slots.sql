-- Exact slot placement: remember which slot index (within its position row) each
-- starter occupies, so a player stays exactly where the user tapped.
ALTER TABLE public.user_fantasy_teams
  ADD COLUMN IF NOT EXISTS player_slots JSONB NOT NULL DEFAULT '{}'::jsonb;
