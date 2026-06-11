-- Client-side Guess the Player: get_today returns the answers; the client validates
-- guesses/reveal/give-up locally (instant). Only the final result is submitted.
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
    'config', jsonb_build_object('max_attempts', v_cfg.max_attempts, 'rounds', v_cfg.rounds_per_game),
    'play', jsonb_build_object('id', v_play.id, 'finished_at', v_play.finished_at, 'rounds_solved', v_play.rounds_solved, 'score', v_play.score),
    'game', jsonb_build_object('id', v_game.id),
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

-- Submit the final client result (streak/percentile/stats).
CREATE OR REPLACE FUNCTION public.puzzle_finish_player(p_game_id UUID, p_rounds_solved INTEGER, p_time_ms INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_play public.puzzle_plays; v_cfg public.puzzle_config; v_game public.puzzle_games;
  v_score INT; v_total INT; v_better INT; v_avg INT; v_prog public.puzzle_progress; v_date DATE; v_missed INT; v_streak INT; v_freezes INT; v_freeze_gained BOOLEAN := false;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  SELECT * INTO v_game FROM public.puzzle_games WHERE id=p_game_id;
  INSERT INTO public.puzzle_plays (user_id, game_id) VALUES (v_user, p_game_id) ON CONFLICT (user_id, game_id) DO NOTHING;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=p_game_id;

  IF v_play.finished_at IS NULL THEN
    v_score := GREATEST(0, p_rounds_solved) * 1000 - LEAST(900, GREATEST(0, p_time_ms) / 1000);
    UPDATE public.puzzle_plays SET finished_at=now(), total_time_ms=GREATEST(0,p_time_ms), rounds_solved=GREATEST(0,p_rounds_solved), score=v_score WHERE id=v_play.id;
    v_date := v_game.puzzle_date;
    SELECT * INTO v_prog FROM public.puzzle_progress WHERE user_id=v_user AND game_type=v_game.game_type AND level=v_game.level;
    IF v_prog.user_id IS NULL THEN v_streak := 1; v_freezes := 0;
    ELSIF v_prog.last_played = v_date THEN v_streak := v_prog.current_streak; v_freezes := v_prog.freezes;
    ELSE
      v_missed := (v_date - v_prog.last_played - 1);
      IF v_missed <= 0 THEN v_streak := v_prog.current_streak + 1; v_freezes := v_prog.freezes;
      ELSIF v_missed <= v_prog.freezes THEN v_streak := v_prog.current_streak + 1; v_freezes := v_prog.freezes - v_missed;
      ELSE v_streak := 1; v_freezes := v_prog.freezes; END IF;
    END IF;
    IF v_streak > 0 AND v_streak % v_cfg.freeze_every_days = 0 AND v_freezes < v_cfg.max_freezes THEN v_freezes := v_freezes + 1; v_freeze_gained := true; END IF;
    INSERT INTO public.puzzle_progress (user_id, game_type, level, current_streak, best_streak, freezes, last_played, games_played, games_won, total_score)
    VALUES (v_user, v_game.game_type, v_game.level, v_streak, v_streak, v_freezes, v_date, 1, CASE WHEN p_rounds_solved = v_cfg.rounds_per_game THEN 1 ELSE 0 END, v_score)
    ON CONFLICT (user_id, game_type, level) DO UPDATE SET
      current_streak=v_streak, best_streak=GREATEST(public.puzzle_progress.best_streak, v_streak), freezes=v_freezes,
      last_played=v_date, games_played=public.puzzle_progress.games_played+1,
      games_won=public.puzzle_progress.games_won + CASE WHEN p_rounds_solved = v_cfg.rounds_per_game THEN 1 ELSE 0 END,
      total_score=public.puzzle_progress.total_score + v_score, updated_at=now();
    SELECT * INTO v_play FROM public.puzzle_plays WHERE id=v_play.id;
  END IF;

  SELECT count(*), avg(total_time_ms)::int INTO v_total, v_avg FROM public.puzzle_plays WHERE game_id=p_game_id AND finished_at IS NOT NULL;
  SELECT count(*) INTO v_better FROM public.puzzle_plays WHERE game_id=p_game_id AND finished_at IS NOT NULL AND score > v_play.score;
  SELECT current_streak, freezes INTO v_streak, v_freezes FROM public.puzzle_progress WHERE user_id=v_user AND game_type=v_game.game_type AND level=v_game.level;
  RETURN jsonb_build_object('ok', true, 'rounds_solved', v_play.rounds_solved, 'time_ms', v_play.total_time_ms, 'score', v_play.score,
    'total_players', v_total, 'avg_time_ms', v_avg,
    'percentile', CASE WHEN v_total > 0 THEN round(100.0 * v_better / v_total, 1) ELSE 0 END,
    'streak', v_streak, 'freezes', v_freezes, 'freeze_gained', v_freeze_gained);
END $$;
GRANT EXECUTE ON FUNCTION public.puzzle_finish_player(UUID, INTEGER, INTEGER) TO authenticated;
