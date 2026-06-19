-- Return today's score distribution + the user's streak so the client can compute
-- percentile/streak LOCALLY at the end (instant, network-independent).
CREATE OR REPLACE FUNCTION public.puzzle_get_today_player(p_scope TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_scope TEXT; v_hint TEXT; v_has BOOLEAN; v_date DATE; v_game public.puzzle_games; v_play public.puzzle_plays; v_cfg public.puzzle_config; v_cap INT;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  SELECT level, hint INTO v_scope, v_hint FROM public.puzzle_user_prefs WHERE user_id = v_user AND game_type='guess_player';
  v_has := (v_scope IS NOT NULL);
  v_scope := COALESCE(p_scope, v_scope, 'big'); v_hint := COALESCE(v_hint, 'easy');
  IF p_scope IS NOT NULL THEN
    INSERT INTO public.puzzle_user_prefs (user_id, game_type, level) VALUES (v_user, 'guess_player', p_scope)
    ON CONFLICT (user_id, game_type) DO UPDATE SET level = EXCLUDED.level, updated_at = now();
  END IF;
  v_cap := CASE v_hint WHEN 'easy' THEN 99 WHEN 'medium' THEN 5 ELSE 3 END;
  v_date := public.puzzle_current_date();
  SELECT * INTO v_game FROM public.puzzle_games WHERE game_type='guess_player' AND level=v_scope AND puzzle_date=v_date;
  IF v_game.id IS NULL THEN RETURN jsonb_build_object('ok', true, 'scope', v_scope, 'hint', v_hint, 'has_prefs', v_has, 'date', v_date, 'game', NULL); END IF;
  INSERT INTO public.puzzle_plays (user_id, game_id) VALUES (v_user, v_game.id) ON CONFLICT (user_id, game_id) DO NOTHING;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=v_game.id;
  RETURN jsonb_build_object(
    'ok', true, 'scope', v_scope, 'hint', v_hint, 'has_prefs', v_has, 'date', v_date,
    'config', jsonb_build_object('max_attempts', v_cfg.max_attempts, 'rounds', v_cfg.rounds_per_game,
              'freeze_every_days', v_cfg.freeze_every_days, 'max_freezes', v_cfg.max_freezes),
    'play', jsonb_build_object('id', v_play.id, 'finished_at', v_play.finished_at, 'rounds_solved', v_play.rounds_solved, 'score', v_play.score),
    'game', jsonb_build_object('id', v_game.id),
    'dist', (SELECT COALESCE(jsonb_agg(score), '[]'::jsonb) FROM public.puzzle_plays WHERE game_id=v_game.id AND finished_at IS NOT NULL AND user_id <> v_user),
    'progress', (SELECT jsonb_build_object('streak', current_streak, 'freezes', freezes, 'last_played', last_played)
                 FROM public.puzzle_progress WHERE user_id=v_user AND game_type='guess_player' AND level=v_scope),
    'rounds', (
      SELECT jsonb_agg(jsonb_build_object(
        'round_no', r.round_no,
        'trail', (SELECT jsonb_agg(elem ORDER BY ord) FROM jsonb_array_elements(r.payload->'trail') WITH ORDINALITY AS t(elem, ord)
                  WHERE ord > GREATEST(0, jsonb_array_length(r.payload->'trail') - v_cap)),
        'trail_total', jsonb_array_length(r.payload->'trail'),
        'hints', r.payload->'hints',
        'answer', (SELECT jsonb_build_object('id', r.answer_player_id, 'name', p.name, 'photo', p.photo_url) FROM public.tm_players p WHERE p.player_id = r.answer_player_id)
      ) ORDER BY r.round_no)
      FROM public.puzzle_rounds r WHERE r.game_id=v_game.id
    )
  );
END $$;
