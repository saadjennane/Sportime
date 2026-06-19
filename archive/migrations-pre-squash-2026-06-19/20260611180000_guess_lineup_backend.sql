-- Guess the Lineup backend: autocomplete index (fb_players, API-Football id space)
-- + client-side get_today (payload carries answers). Finish reuses puzzle_finish_player.

CREATE OR REPLACE FUNCTION public.puzzle_lineup_index()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', api_id, 'n', name, 'p', COALESCE(photo, photo_url), 'r', 50)), '[]'::jsonb)
  FROM public.fb_players p
  WHERE api_id IS NOT NULL AND name IS NOT NULL AND name <> 'Unknown';
$$;
GRANT EXECUTE ON FUNCTION public.puzzle_lineup_index() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.puzzle_get_today_lineup(p_scope TEXT DEFAULT NULL, p_holes INTEGER DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_level TEXT; v_scope TEXT; v_holes INT; v_has BOOLEAN; v_date DATE; v_game public.puzzle_games; v_play public.puzzle_plays; v_cfg public.puzzle_config;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  SELECT level INTO v_level FROM public.puzzle_user_prefs WHERE user_id = v_user AND game_type='guess_lineup';
  v_has := (v_level IS NOT NULL);
  IF p_scope IS NOT NULL AND p_holes IS NOT NULL THEN
    v_level := p_scope || '_' || p_holes;
    INSERT INTO public.puzzle_user_prefs (user_id, game_type, level) VALUES (v_user, 'guess_lineup', v_level)
    ON CONFLICT (user_id, game_type) DO UPDATE SET level = EXCLUDED.level, updated_at = now();
  END IF;
  v_level := COALESCE(v_level, 'big_1');
  v_scope := split_part(v_level, '_', 1); v_holes := split_part(v_level, '_', 2)::int;
  v_date := public.puzzle_current_date();
  SELECT * INTO v_game FROM public.puzzle_games WHERE game_type='guess_lineup' AND level=v_level AND puzzle_date=v_date;
  IF v_game.id IS NULL THEN RETURN jsonb_build_object('ok', true, 'scope', v_scope, 'holes', v_holes, 'has_prefs', v_has, 'date', v_date, 'game', NULL); END IF;
  INSERT INTO public.puzzle_plays (user_id, game_id) VALUES (v_user, v_game.id) ON CONFLICT (user_id, game_id) DO NOTHING;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=v_game.id;
  RETURN jsonb_build_object(
    'ok', true, 'scope', v_scope, 'holes', v_holes, 'has_prefs', v_has, 'date', v_date,
    'config', jsonb_build_object('rounds', v_cfg.rounds_per_game),
    'play', jsonb_build_object('id', v_play.id, 'finished_at', v_play.finished_at, 'rounds_solved', v_play.rounds_solved, 'score', v_play.score),
    'game', jsonb_build_object('id', v_game.id),
    'dist', (SELECT COALESCE(jsonb_agg(score), '[]'::jsonb) FROM public.puzzle_plays WHERE game_id=v_game.id AND finished_at IS NOT NULL AND user_id <> v_user),
    'progress', (SELECT jsonb_build_object('streak', current_streak, 'freezes', freezes, 'last_played', last_played)
                 FROM public.puzzle_progress WHERE user_id=v_user AND game_type='guess_lineup' AND level=v_level),
    'rounds', (SELECT jsonb_agg(jsonb_build_object('round_no', r.round_no, 'payload', r.payload) ORDER BY r.round_no)
               FROM public.puzzle_rounds r WHERE r.game_id=v_game.id)
  );
END $$;
GRANT EXECUTE ON FUNCTION public.puzzle_get_today_lineup(TEXT, INTEGER) TO authenticated;
