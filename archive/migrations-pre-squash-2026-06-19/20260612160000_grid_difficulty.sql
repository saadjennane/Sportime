-- Box2Box difficulty: index gains market value (for rarity) + get_today takes a level.
CREATE OR REPLACE FUNCTION public.puzzle_grid_index()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH pool AS (SELECT DISTINCT player_id FROM public.tm_transfers)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.player_id, 'n', p.name, 'p', p.photo_url, 'nat', p.nationality,
    'by', EXTRACT(YEAR FROM p.date_of_birth)::int,
    'mv', COALESCE(p.current_market_value_eur, 0),
    'cl', (SELECT array_agg(DISTINCT c) FROM (
              SELECT from_club_name c FROM public.tm_transfers t WHERE t.player_id=p.player_id AND from_club_name IS NOT NULL
              UNION SELECT to_club_name FROM public.tm_transfers t WHERE t.player_id=p.player_id AND to_club_name IS NOT NULL
           ) z WHERE c !~* '(U1[5-9]|U2[0-3]|youth|yth|giov|reserve|castilla|madrileñ|without club|retired|career break|unknown| B$| II$| C$)'),
    'tr', (SELECT array_agg(DISTINCT trophy) FROM public.tm_trophies WHERE player_id=p.player_id)
  )), '[]'::jsonb)
  FROM public.tm_players p JOIN pool ON pool.player_id = p.player_id
  WHERE p.name IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.puzzle_get_today_grid(p_level TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_level TEXT; v_has BOOLEAN; v_date DATE; v_game public.puzzle_games; v_play public.puzzle_plays;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT level INTO v_level FROM public.puzzle_user_prefs WHERE user_id=v_user AND game_type='grid';
  v_has := (v_level IS NOT NULL);
  IF p_level IS NOT NULL THEN
    v_level := p_level;
    INSERT INTO public.puzzle_user_prefs (user_id, game_type, level) VALUES (v_user, 'grid', v_level)
    ON CONFLICT (user_id, game_type) DO UPDATE SET level = EXCLUDED.level, updated_at = now();
  END IF;
  v_level := COALESCE(v_level, 'medium');
  v_date := public.puzzle_current_date();
  SELECT * INTO v_game FROM public.puzzle_games WHERE game_type='grid' AND level=v_level AND puzzle_date=v_date;
  IF v_game.id IS NULL THEN RETURN jsonb_build_object('ok', true, 'level', v_level, 'has_prefs', v_has, 'date', v_date, 'game', NULL); END IF;
  INSERT INTO public.puzzle_plays (user_id, game_id) VALUES (v_user, v_game.id) ON CONFLICT (user_id, game_id) DO NOTHING;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=v_game.id;
  RETURN jsonb_build_object(
    'ok', true, 'level', v_level, 'has_prefs', v_has, 'date', v_date,
    'play', jsonb_build_object('id', v_play.id, 'finished_at', v_play.finished_at, 'rounds_solved', v_play.rounds_solved, 'score', v_play.score),
    'game', jsonb_build_object('id', v_game.id),
    'dist', (SELECT COALESCE(jsonb_agg(score), '[]'::jsonb) FROM public.puzzle_plays WHERE game_id=v_game.id AND finished_at IS NOT NULL AND user_id <> v_user),
    'progress', (SELECT jsonb_build_object('streak', current_streak, 'freezes', freezes, 'last_played', last_played)
                 FROM public.puzzle_progress WHERE user_id=v_user AND game_type='grid' AND level=v_level),
    'payload', (SELECT payload FROM public.puzzle_rounds WHERE game_id=v_game.id AND round_no=1)
  );
END $$;
GRANT EXECUTE ON FUNCTION public.puzzle_get_today_grid(TEXT) TO authenticated;
