-- ============================================================================
-- Wipe ALL fantasy games/data and create a single fresh, clean one.
-- "Sportime Fantasy" (entry 1000): a finished Matchday 1 (Aug 2025 fixtures with
-- stats, so the game spans the past and is joinable now) + an upcoming Matchday 2
-- to compose a team. No pre-seeded team / participation.
-- ============================================================================
DO $$
DECLARE
  v_game    UUID := 'a0000000-0000-4000-8000-000000000001';
  v_gw_done UUID := 'a0000000-0000-4000-8000-0000000000d1';
  v_gw_next UUID := 'a0000000-0000-4000-8000-0000000000d2';
  v_league  UUID := '7bd58bde-088e-4f6c-8b6b-edb388bd60bc';
BEGIN
  -- 1) Remove every fantasy game and everything tied to fantasy.
  DELETE FROM public.fantasy_leaderboard WHERE game_week_id IN (SELECT id FROM public.fantasy_game_weeks);
  DELETE FROM public.user_fantasy_teams;
  DELETE FROM public.challenge_participants WHERE challenge_id IN (SELECT id FROM public.fantasy_games);
  DELETE FROM public.squad_games WHERE game_id IN (SELECT id FROM public.fantasy_games);
  DELETE FROM public.fantasy_game_weeks;
  DELETE FROM public.fantasy_games;

  -- 2) One fresh game.
  INSERT INTO public.fantasy_games
    (id, name, status, start_date, end_date, entry_cost, league_id, tier,
     minimum_level, requires_subscription, required_badges, min_players, max_players, is_linkable, total_players, duration_type)
  VALUES
    (v_game, 'Sportime Fantasy', 'Ongoing', '2025-08-01T00:00:00Z', '2026-06-30T00:00:00Z', 1000, v_league, 'amateur',
     'Rookie', false, '{}'::uuid[], 2, 100, true, 0, 'flash');

  -- 3) Game weeks.
  INSERT INTO public.fantasy_game_weeks (id, fantasy_game_id, name, start_date, end_date, leagues, status, conditions)
  VALUES
    (v_gw_done, v_game, 'Matchday 1', '2025-08-01T00:00:00Z', '2025-09-01T00:00:00Z', ARRAY['LaLiga'], 'finished', '[]'::jsonb),
    (v_gw_next, v_game, 'Matchday 2', '2026-06-12T00:00:00Z', '2026-06-16T23:59:59Z', ARRAY['LaLiga'], 'upcoming', '[]'::jsonb);
END $$;
