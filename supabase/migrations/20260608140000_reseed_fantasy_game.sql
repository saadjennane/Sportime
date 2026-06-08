-- ============================================================================
-- Reseed Fantasy: drop "HS Liga Fantasy" + all its data, create a clean game
-- "Fantasy Showdown" (entry 1000) with a finished GW (so the game spans the past
-- and is joinable now) + an upcoming GW to compose a team. No pre-seeded team /
-- participation, so the JOIN -> pay -> My Games -> compose flow can be tested.
-- ============================================================================
DO $$
DECLARE
  v_old  UUID := 'f7f8e588-deb0-483b-bccd-23a59ad397d3';
  v_game UUID := 'fa11fa11-0000-4000-8000-000000000001';
  v_gw_done UUID := 'fa11fa11-0000-4000-8000-0000000000f1';
  v_gw_next UUID := 'fa11fa11-0000-4000-8000-0000000000f2';
  v_league UUID := '7bd58bde-088e-4f6c-8b6b-edb388bd60bc';
BEGIN
  -- 1) Clean up the old game and everything tied to it.
  DELETE FROM public.fantasy_leaderboard WHERE game_week_id IN (SELECT id FROM public.fantasy_game_weeks WHERE fantasy_game_id = v_old);
  DELETE FROM public.user_fantasy_teams WHERE game_id = v_old;
  DELETE FROM public.challenge_participants WHERE challenge_id = v_old;
  DELETE FROM public.squad_games WHERE game_id = v_old;
  DELETE FROM public.fantasy_game_weeks WHERE fantasy_game_id = v_old;
  DELETE FROM public.fantasy_games WHERE id = v_old;

  -- 2) New game.
  INSERT INTO public.fantasy_games
    (id, name, status, start_date, end_date, entry_cost, league_id, tier,
     minimum_level, requires_subscription, required_badges, min_players, max_players, is_linkable, total_players, duration_type)
  VALUES
    (v_game, 'Fantasy Showdown', 'Ongoing', '2025-08-01T00:00:00Z', '2026-06-30T00:00:00Z', 1000, v_league, 'amateur',
     'Rookie', false, '{}'::uuid[], 2, 100, true, 0, 'flash')
  ON CONFLICT (id) DO NOTHING;

  -- 3) Game weeks: one finished (legacy Aug 2025 fixtures with stats), one upcoming.
  INSERT INTO public.fantasy_game_weeks (id, fantasy_game_id, name, start_date, end_date, leagues, status, conditions)
  VALUES
    (v_gw_done, v_game, 'Matchday 1', '2025-08-01T00:00:00Z', '2025-09-01T00:00:00Z', ARRAY['LaLiga'], 'finished', '[]'::jsonb),
    (v_gw_next, v_game, 'Matchday 2', '2026-06-12T00:00:00Z', '2026-06-16T23:59:59Z', ARRAY['LaLiga'], 'upcoming', '[]'::jsonb)
  ON CONFLICT (id) DO NOTHING;
END $$;
