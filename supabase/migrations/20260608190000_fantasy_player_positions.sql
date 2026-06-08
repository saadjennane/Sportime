-- Track which slot (position) each starter was assigned to, so versatile players
-- (eligible for >1 position) render in the slot the user chose, not their primary.
ALTER TABLE public.user_fantasy_teams
  ADD COLUMN IF NOT EXISTS player_positions JSONB NOT NULL DEFAULT '{}'::jsonb;
