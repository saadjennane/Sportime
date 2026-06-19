-- Add an UPCOMING game week to the HS Liga fantasy game so the user can compose
-- a team end-to-end (the finished GW 66666666 already shows scored points).
INSERT INTO public.fantasy_game_weeks (id, fantasy_game_id, name, start_date, end_date, leagues, status, conditions)
VALUES (
  '77777777-7777-4777-8777-777777777777',
  'f7f8e588-deb0-483b-bccd-23a59ad397d3',
  'TEST GW — Compose',
  '2026-06-10T00:00:00Z', '2026-06-12T23:59:59Z',
  ARRAY['LaLiga'], 'upcoming', '[]'::jsonb
)
ON CONFLICT (id) DO NOTHING;
