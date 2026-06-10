-- puzzle_finish now reports whether a freeze was just earned (freeze_gained).
CREATE OR REPLACE FUNCTION public.puzzle_finish(p_game_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_play public.puzzle_plays; v_cfg public.puzzle_config; v_game public.puzzle_games;
  v_solved INT; v_time INT; v_score INT; v_total INT; v_better INT; v_avg INT;
  v_prog public.puzzle_progress; v_date DATE; v_missed INT; v_streak INT; v_freezes INT; v_freeze_gained BOOLEAN := false;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=p_game_id;
  IF v_play.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_started'); END IF;
  SELECT * INTO v_game FROM public.puzzle_games WHERE id=p_game_id;

  IF v_play.finished_at IS NULL THEN
    SELECT count(*) FILTER (WHERE solved) INTO v_solved FROM public.puzzle_round_attempts WHERE play_id=v_play.id;
    v_time := GREATEST(0, EXTRACT(EPOCH FROM (now() - v_play.started_at))::int * 1000);
    v_score := v_solved * 1000 - LEAST(900, v_time / 1000);
    UPDATE public.puzzle_plays SET finished_at=now(), total_time_ms=v_time, rounds_solved=v_solved, score=v_score WHERE id=v_play.id;

    v_date := v_game.puzzle_date;
    SELECT * INTO v_prog FROM public.puzzle_progress WHERE user_id=v_user AND level=v_game.level;
    IF v_prog.user_id IS NULL THEN v_streak := 1; v_freezes := 0;
    ELSIF v_prog.last_played = v_date THEN v_streak := v_prog.current_streak; v_freezes := v_prog.freezes;
    ELSE
      v_missed := (v_date - v_prog.last_played - 1);
      IF v_missed <= 0 THEN v_streak := v_prog.current_streak + 1; v_freezes := v_prog.freezes;
      ELSIF v_missed <= v_prog.freezes THEN v_streak := v_prog.current_streak + 1; v_freezes := v_prog.freezes - v_missed;
      ELSE v_streak := 1; v_freezes := v_prog.freezes; END IF;
    END IF;
    IF v_streak > 0 AND v_streak % v_cfg.freeze_every_days = 0 AND v_freezes < v_cfg.max_freezes THEN
      v_freezes := v_freezes + 1; v_freeze_gained := true;
    END IF;

    INSERT INTO public.puzzle_progress (user_id, level, current_streak, best_streak, freezes, last_played, games_played, games_won, total_score)
    VALUES (v_user, v_game.level, v_streak, v_streak, v_freezes, v_date, 1, CASE WHEN v_solved = v_cfg.rounds_per_game THEN 1 ELSE 0 END, v_score)
    ON CONFLICT (user_id, level) DO UPDATE SET
      current_streak=v_streak, best_streak=GREATEST(public.puzzle_progress.best_streak, v_streak), freezes=v_freezes,
      last_played=v_date, games_played=public.puzzle_progress.games_played+1,
      games_won=public.puzzle_progress.games_won + CASE WHEN v_solved = v_cfg.rounds_per_game THEN 1 ELSE 0 END,
      total_score=public.puzzle_progress.total_score + v_score, updated_at=now();
    SELECT * INTO v_play FROM public.puzzle_plays WHERE id=v_play.id;
  END IF;

  SELECT count(*), avg(total_time_ms)::int INTO v_total, v_avg FROM public.puzzle_plays WHERE game_id=p_game_id AND finished_at IS NOT NULL;
  SELECT count(*) INTO v_better FROM public.puzzle_plays WHERE game_id=p_game_id AND finished_at IS NOT NULL AND score > v_play.score;
  SELECT current_streak, freezes INTO v_streak, v_freezes FROM public.puzzle_progress WHERE user_id=v_user AND level=v_game.level;

  RETURN jsonb_build_object('ok', true, 'rounds_solved', v_play.rounds_solved, 'time_ms', v_play.total_time_ms, 'score', v_play.score,
    'total_players', v_total, 'avg_time_ms', v_avg,
    'percentile', CASE WHEN v_total > 0 THEN round(100.0 * v_better / v_total, 1) ELSE 0 END,
    'streak', v_streak, 'freezes', v_freezes, 'freeze_gained', v_freeze_gained);
END $$;
