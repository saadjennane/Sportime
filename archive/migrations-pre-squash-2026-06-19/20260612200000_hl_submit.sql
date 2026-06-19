-- Submit a Higher/Lower run: keep the best streak as the play score; update daily streak.
CREATE OR REPLACE FUNCTION public.puzzle_submit_hl(p_game_id UUID, p_streak INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_play public.puzzle_plays; v_game public.puzzle_games; v_cfg public.puzzle_config;
  v_best INT; v_total INT; v_better INT; v_prog public.puzzle_progress; v_streak INT; v_freezes INT; v_freeze_gained BOOLEAN := false; v_missed INT; v_first BOOLEAN;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  SELECT * INTO v_game FROM public.puzzle_games WHERE id=p_game_id;
  INSERT INTO public.puzzle_plays (user_id, game_id) VALUES (v_user, p_game_id) ON CONFLICT (user_id, game_id) DO NOTHING;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=p_game_id;
  v_first := (v_play.finished_at IS NULL);
  UPDATE public.puzzle_plays SET score = GREATEST(COALESCE(score,0), p_streak), rounds_solved = GREATEST(COALESCE(rounds_solved,0), p_streak), finished_at = COALESCE(finished_at, now())
    WHERE id = v_play.id;

  IF v_first THEN   -- update the daily play-streak once per day
    SELECT * INTO v_prog FROM public.puzzle_progress WHERE user_id=v_user AND game_type=v_game.game_type AND level=v_game.level;
    IF v_prog.user_id IS NULL THEN v_streak := 1; v_freezes := 0;
    ELSIF v_prog.last_played = v_game.puzzle_date THEN v_streak := v_prog.current_streak; v_freezes := v_prog.freezes;
    ELSE v_missed := (v_game.puzzle_date - v_prog.last_played - 1);
      IF v_missed <= 0 THEN v_streak := v_prog.current_streak + 1; v_freezes := v_prog.freezes;
      ELSIF v_missed <= v_prog.freezes THEN v_streak := v_prog.current_streak + 1; v_freezes := v_prog.freezes - v_missed;
      ELSE v_streak := 1; v_freezes := v_prog.freezes; END IF;
    END IF;
    IF v_streak > 0 AND v_streak % v_cfg.freeze_every_days = 0 AND v_freezes < v_cfg.max_freezes THEN v_freezes := v_freezes + 1; v_freeze_gained := true; END IF;
    INSERT INTO public.puzzle_progress (user_id, game_type, level, current_streak, best_streak, freezes, last_played, games_played, games_won, total_score)
    VALUES (v_user, v_game.game_type, v_game.level, v_streak, v_streak, v_freezes, v_game.puzzle_date, 1, 0, p_streak)
    ON CONFLICT (user_id, game_type, level) DO UPDATE SET current_streak=v_streak, best_streak=GREATEST(public.puzzle_progress.best_streak, v_streak),
      freezes=v_freezes, last_played=v_game.puzzle_date, games_played=public.puzzle_progress.games_played+1, updated_at=now();
  END IF;

  SELECT max(score) INTO v_best FROM public.puzzle_plays WHERE user_id=v_user AND game_id IN (SELECT id FROM public.puzzle_games WHERE game_type='higherlower' AND level=v_game.level);
  SELECT count(*), count(*) FILTER (WHERE score > p_streak) INTO v_total, v_better FROM public.puzzle_plays WHERE game_id=p_game_id AND finished_at IS NOT NULL;
  RETURN jsonb_build_object('ok', true, 'streak', p_streak, 'best', v_best,
    'percentile', CASE WHEN v_total > 0 THEN round(100.0 * v_better / v_total, 1) ELSE 0 END,
    'day_streak', (SELECT current_streak FROM public.puzzle_progress WHERE user_id=v_user AND game_type='higherlower' AND level=v_game.level), 'freeze_gained', v_freeze_gained);
END $$;
GRANT EXECUTE ON FUNCTION public.puzzle_submit_hl(UUID, INTEGER) TO authenticated;
