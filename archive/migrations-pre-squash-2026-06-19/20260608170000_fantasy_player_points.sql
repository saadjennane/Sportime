-- Store the server-computed per-player points so the client can display them
-- (instead of recomputing with a divergent engine / fatigue scale).
ALTER TABLE public.user_fantasy_teams
  ADD COLUMN IF NOT EXISTS player_points JSONB NOT NULL DEFAULT '{}'::jsonb;
