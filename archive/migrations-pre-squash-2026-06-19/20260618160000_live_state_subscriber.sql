-- =====================================================
-- Add is_subscriber to each entry in get_live_game_state, so the Live Prediction
-- leaderboard can show the Premium badge. Only change vs the previous definition is
-- the added 'is_subscriber' field in the entries object.
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_live_game_state(p_game_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_game JSONB;
  v_entries JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id', lg.id,
    'mode', lg.mode,
    'status', lg.status,
    'entry_cost', lg.entry_cost,
    'fixture', jsonb_build_object(
      'id', f.id,
      'date', f.date,
      'status', f.status,
      'goals_home', f.goals_home,
      'goals_away', f.goals_away,
      'home', jsonb_build_object('name', ht.name, 'logo', ht.logo_url),
      'away', jsonb_build_object('name', at.name, 'logo', at.logo_url)
    )
  )
  INTO v_game
  FROM public.live_games lg
  JOIN public.fb_fixtures f ON f.id = lg.fixture_id
  LEFT JOIN public.fb_teams ht ON ht.id = f.home_team_id
  LEFT JOIN public.fb_teams at ON at.id = f.away_team_id
  WHERE lg.id = p_game_id;

  IF v_game IS NULL THEN RETURN NULL; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'user_id', e.user_id,
    'predicted_score', e.predicted_score,
    'bonus_questions', e.bonus_questions,
    'bonus_answers', e.bonus_answers,
    'midtime_edit', e.midtime_edit,
    'total_points', e.total_points,
    'goal_diff_error', e.goal_diff_error,
    'rank', e.rank,
    'submitted_at', e.submitted_at,
    'username', COALESCE(p.display_name, p.username),
    'is_subscriber', COALESCE(p.is_subscriber, false)
  ) ORDER BY e.total_points DESC NULLS LAST, e.goal_diff_error ASC NULLS LAST), '[]'::jsonb)
  INTO v_entries
  FROM public.live_game_entries e
  LEFT JOIN public.profiles p ON p.id = e.user_id
  WHERE e.live_game_id = p_game_id;

  RETURN jsonb_build_object('game', v_game, 'entries', v_entries);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_live_game_state(UUID) TO authenticated, anon, service_role;
