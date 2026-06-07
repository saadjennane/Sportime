-- ============================================================================
-- SEED — coherent Fantasy test scenario to verify the repaired scoring:
-- a game week under HS Liga (league 7bd58bde) over August 2025 (legacy FT
-- fixtures that have player_match_stats) + a valid test team of real players.
-- Idempotent.
-- ============================================================================
-- captain_id (and booster_target_id) used to FK -> fantasy_players (13 demo).
-- Repoint to the real `players` table now that the pool is unified.
ALTER TABLE public.user_fantasy_teams DROP CONSTRAINT IF EXISTS user_fantasy_teams_captain_id_fkey;
ALTER TABLE public.user_fantasy_teams
  ADD CONSTRAINT user_fantasy_teams_captain_id_fkey
  FOREIGN KEY (captain_id) REFERENCES public.players(id) ON DELETE SET NULL;
ALTER TABLE public.user_fantasy_teams DROP CONSTRAINT IF EXISTS user_fantasy_teams_booster_target_id_fkey;

DO $$
DECLARE
  v_game UUID := 'f7f8e588-deb0-483b-bccd-23a59ad397d3'; -- HS Liga (league_id 7bd58bde)
  v_gw   UUID := '66666666-6666-4666-8666-666666666666';
  v_user UUID := '61da0a31-875b-4383-b951-c429c5f9def0'; -- saadjennane
BEGIN
  INSERT INTO public.fantasy_game_weeks (id, fantasy_game_id, name, start_date, end_date, leagues, status, conditions)
  VALUES (v_gw, v_game, 'TEST GW (verify)', '2025-08-01T00:00:00Z', '2025-09-01T00:00:00Z',
          ARRAY['LaLiga'], 'finished', '[]'::jsonb)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_fantasy_teams
    (user_id, game_id, game_week_id, starters, substitutes, captain_id, booster_used, fatigue_state, total_points)
  VALUES (
    v_user, v_game, v_gw,
    ARRAY[
      'e542fef7-b32e-4fc6-8b39-8b3e7bfb08f6',  -- GK
      '676bcd8f-9a14-43d5-8d5e-6619e66ec7d1',  -- DEF
      'dfa4e9a2-a798-4449-89bb-d8b0a6f88659',  -- DEF
      'afe63faf-84a7-446e-94b6-9020a5ac4cb2',  -- DEF
      '96ec32f8-314f-4046-b30a-c44c2be7dbad',  -- MID (captain)
      'bb812c55-1366-4587-857e-57d8dac68961',  -- MID
      '21397261-a310-42d3-b8e2-4331d65cc31f'   -- ATT
    ]::uuid[],
    ARRAY[
      '6b150eae-3477-43f3-b3f2-6bc0feb75fbd',  -- sub MID
      '042d4dd1-245c-471a-990d-266259a9884c'   -- sub ATT
    ]::uuid[],
    '96ec32f8-314f-4046-b30a-c44c2be7dbad'::uuid,
    NULL, '{}'::jsonb, 0
  )
  ON CONFLICT DO NOTHING;
END $$;
