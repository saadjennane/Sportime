-- Demo team for the current user on Sportime Fantasy / Matchday 1 (finished, has
-- stats) so points are visible immediately. Reuses the verified 7+2 lineup.
DO $$
DECLARE
  v_game UUID := 'a0000000-0000-4000-8000-000000000001';
  v_gw   UUID := 'a0000000-0000-4000-8000-0000000000d1'; -- Matchday 1 (finished)
  v_user UUID := '61da0a31-875b-4383-b951-c429c5f9def0'; -- saadjennane
BEGIN
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
      '6b150eae-3477-43f3-b3f2-6bc0feb75fbd',
      '042d4dd1-245c-471a-990d-266259a9884c'
    ]::uuid[],
    '96ec32f8-314f-4046-b30a-c44c2be7dbad'::uuid,
    NULL, '{}'::jsonb, 0
  )
  ON CONFLICT DO NOTHING;
END $$;
