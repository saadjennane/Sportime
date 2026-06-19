-- ─────────────────────────────────────────────────────────────────────────────
-- Puzzle gameplay RPCs: today's game (answers hidden), guess (heat), finish
-- (chrono + score + percentile), streak/freezes, level preference.
-- ─────────────────────────────────────────────────────────────────────────────

-- Active puzzle date given the 8h cutover (day flips at cutover hour).
CREATE OR REPLACE FUNCTION public.puzzle_current_date()
RETURNS DATE LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (now() - make_interval(hours => (SELECT daily_cutover_hour FROM public.puzzle_config WHERE id = 1)))::date;
$$;
GRANT EXECUTE ON FUNCTION public.puzzle_current_date() TO anon, authenticated;

-- Set the user's chosen difficulty.
CREATE OR REPLACE FUNCTION public.puzzle_set_level(p_level TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  IF p_level NOT IN ('easy','medium','hard') THEN RETURN jsonb_build_object('ok', false, 'error', 'bad level'); END IF;
  INSERT INTO public.puzzle_user_prefs (user_id, level) VALUES (v_user, p_level)
  ON CONFLICT (user_id) DO UPDATE SET level = EXCLUDED.level, updated_at = now();
  RETURN jsonb_build_object('ok', true, 'level', p_level);
END $$;
GRANT EXECUTE ON FUNCTION public.puzzle_set_level(TEXT) TO authenticated;

-- Today's game for the user's level (answers hidden) + their progress to resume.
CREATE OR REPLACE FUNCTION public.puzzle_get_today(p_level TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_level TEXT; v_date DATE; v_game public.puzzle_games; v_play public.puzzle_plays; v_cfg public.puzzle_config;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  v_level := COALESCE(p_level, (SELECT level FROM public.puzzle_user_prefs WHERE user_id = v_user), 'easy');
  IF p_level IS NOT NULL THEN
    INSERT INTO public.puzzle_user_prefs (user_id, level) VALUES (v_user, p_level)
    ON CONFLICT (user_id) DO UPDATE SET level = EXCLUDED.level, updated_at = now();
  END IF;
  v_date := public.puzzle_current_date();

  SELECT * INTO v_game FROM public.puzzle_games WHERE game_type='guess_score' AND level=v_level AND puzzle_date=v_date;
  IF v_game.id IS NULL THEN RETURN jsonb_build_object('ok', true, 'level', v_level, 'date', v_date, 'game', NULL); END IF;

  INSERT INTO public.puzzle_plays (user_id, game_id) VALUES (v_user, v_game.id) ON CONFLICT (user_id, game_id) DO NOTHING;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=v_game.id;

  RETURN jsonb_build_object(
    'ok', true, 'level', v_level, 'date', v_date,
    'config', jsonb_build_object('max_attempts', v_cfg.max_attempts, 'heat_bands', v_cfg.heat_bands, 'rounds', v_cfg.rounds_per_game),
    'play', jsonb_build_object('id', v_play.id, 'started_at', v_play.started_at, 'finished_at', v_play.finished_at, 'rounds_solved', v_play.rounds_solved, 'score', v_play.score),
    'game', jsonb_build_object('id', v_game.id, 'difficulty', v_game.difficulty_score),
    'rounds', (
      SELECT jsonb_agg(jsonb_build_object(
        'round_no', r.round_no, 'home_name', r.home_name, 'home_logo', r.home_logo,
        'away_name', r.away_name, 'away_logo', r.away_logo, 'season', r.season,
        'competition', r.competition_name, 'stage', r.stage, 'match_date', r.match_date, 'hints', r.hints,
        'attempt', (SELECT jsonb_build_object('guesses', a.guesses, 'solved', a.solved, 'attempts', a.attempts)
                    FROM public.puzzle_round_attempts a WHERE a.play_id=v_play.id AND a.round_no=r.round_no),
        'reveal', (SELECT CASE WHEN a.solved OR a.attempts >= v_cfg.max_attempts OR v_play.finished_at IS NOT NULL
                     THEN jsonb_build_object('home', r.answer_home, 'away', r.answer_away) ELSE NULL END
                   FROM public.puzzle_round_attempts a WHERE a.play_id=v_play.id AND a.round_no=r.round_no)
      ) ORDER BY r.round_no)
      FROM public.puzzle_rounds r WHERE r.game_id=v_game.id
    )
  );
END $$;
GRANT EXECUTE ON FUNCTION public.puzzle_get_today(TEXT) TO authenticated;

-- Submit a guess for a round. Returns heat; reveals answer only once solved or attempts exhausted.
CREATE OR REPLACE FUNCTION public.puzzle_guess(p_game_id UUID, p_round_no INTEGER, p_home INTEGER, p_away INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_play public.puzzle_plays; v_round public.puzzle_rounds; v_cfg public.puzzle_config;
  v_att public.puzzle_round_attempts; v_heat TEXT; v_solved BOOLEAN; v_attempts INT;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=p_game_id;
  IF v_play.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_started'); END IF;
  IF v_play.finished_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'finished'); END IF;
  SELECT * INTO v_round FROM public.puzzle_rounds WHERE game_id=p_game_id AND round_no=p_round_no;
  IF v_round.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_round'); END IF;

  SELECT * INTO v_att FROM public.puzzle_round_attempts WHERE play_id=v_play.id AND round_no=p_round_no;
  IF v_att.solved THEN RETURN jsonb_build_object('ok', true, 'already', true, 'solved', true); END IF;
  IF COALESCE(v_att.attempts,0) >= v_cfg.max_attempts THEN RETURN jsonb_build_object('ok', false, 'error', 'no_attempts_left'); END IF;

  v_heat := public.puzzle_heat(p_home, p_away, v_round.answer_home, v_round.answer_away);
  v_solved := (p_home = v_round.answer_home AND p_away = v_round.answer_away);
  v_attempts := COALESCE(v_att.attempts,0) + 1;

  INSERT INTO public.puzzle_round_attempts (play_id, round_no, guesses, solved, attempts)
  VALUES (v_play.id, p_round_no, jsonb_build_array(jsonb_build_object('h',p_home,'a',p_away,'heat',v_heat)), v_solved, 1)
  ON CONFLICT (play_id, round_no) DO UPDATE SET
    guesses = public.puzzle_round_attempts.guesses || jsonb_build_object('h',p_home,'a',p_away,'heat',v_heat),
    solved = v_solved, attempts = v_attempts;

  RETURN jsonb_build_object('ok', true, 'heat', v_heat, 'solved', v_solved,
    'attempts_used', v_attempts, 'attempts_left', v_cfg.max_attempts - v_attempts,
    'reveal', CASE WHEN v_solved OR v_attempts >= v_cfg.max_attempts THEN jsonb_build_object('home', v_round.answer_home, 'away', v_round.answer_away) ELSE NULL END);
END $$;
GRANT EXECUTE ON FUNCTION public.puzzle_guess(UUID, INTEGER, INTEGER, INTEGER) TO authenticated;

-- Finish the game: stamp time + score, update streak/freezes, return percentile + average.
CREATE OR REPLACE FUNCTION public.puzzle_finish(p_game_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_play public.puzzle_plays; v_cfg public.puzzle_config; v_game public.puzzle_games;
  v_solved INT; v_time INT; v_score INT; v_total INT; v_better INT; v_avg INT;
  v_prog public.puzzle_progress; v_date DATE; v_missed INT; v_streak INT; v_freezes INT;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=p_game_id;
  IF v_play.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_started'); END IF;
  SELECT * INTO v_game FROM public.puzzle_games WHERE id=p_game_id;

  IF v_play.finished_at IS NULL THEN
    SELECT count(*) FILTER (WHERE solved) INTO v_solved FROM public.puzzle_round_attempts WHERE play_id=v_play.id;
    v_time := GREATEST(0, EXTRACT(EPOCH FROM (now() - v_play.started_at))::int * 1000);
    v_score := v_solved * 1000 - LEAST(900, v_time / 1000); -- more solved + faster = higher
    UPDATE public.puzzle_plays SET finished_at=now(), total_time_ms=v_time, rounds_solved=v_solved, score=v_score WHERE id=v_play.id;

    -- streak / freezes
    v_date := v_game.puzzle_date;
    SELECT * INTO v_prog FROM public.puzzle_progress WHERE user_id=v_user AND level=v_game.level;
    IF v_prog.user_id IS NULL THEN
      v_streak := 1; v_freezes := 0;
    ELSIF v_prog.last_played = v_date THEN
      v_streak := v_prog.current_streak; v_freezes := v_prog.freezes; -- already counted
    ELSE
      v_missed := (v_date - v_prog.last_played - 1);
      IF v_missed <= 0 THEN v_streak := v_prog.current_streak + 1; v_freezes := v_prog.freezes;
      ELSIF v_missed <= v_prog.freezes THEN v_streak := v_prog.current_streak + 1; v_freezes := v_prog.freezes - v_missed;
      ELSE v_streak := 1; v_freezes := v_prog.freezes; END IF;
    END IF;
    IF v_streak > 0 AND v_streak % v_cfg.freeze_every_days = 0 AND v_freezes < v_cfg.max_freezes THEN v_freezes := v_freezes + 1; END IF;

    INSERT INTO public.puzzle_progress (user_id, level, current_streak, best_streak, freezes, last_played, games_played, games_won, total_score)
    VALUES (v_user, v_game.level, v_streak, v_streak, v_freezes, v_date, 1, CASE WHEN v_solved = v_cfg.rounds_per_game THEN 1 ELSE 0 END, v_score)
    ON CONFLICT (user_id, level) DO UPDATE SET
      current_streak=v_streak, best_streak=GREATEST(public.puzzle_progress.best_streak, v_streak), freezes=v_freezes,
      last_played=v_date, games_played=public.puzzle_progress.games_played+1,
      games_won=public.puzzle_progress.games_won + CASE WHEN v_solved = v_cfg.rounds_per_game THEN 1 ELSE 0 END,
      total_score=public.puzzle_progress.total_score + v_score, updated_at=now();

    SELECT * INTO v_play FROM public.puzzle_plays WHERE id=v_play.id;
  END IF;

  -- percentile + average over all finished plays of this game
  SELECT count(*), avg(total_time_ms)::int INTO v_total, v_avg FROM public.puzzle_plays WHERE game_id=p_game_id AND finished_at IS NOT NULL;
  SELECT count(*) INTO v_better FROM public.puzzle_plays WHERE game_id=p_game_id AND finished_at IS NOT NULL AND score > v_play.score;
  SELECT current_streak, freezes INTO v_streak, v_freezes FROM public.puzzle_progress WHERE user_id=v_user AND level=v_game.level;

  RETURN jsonb_build_object('ok', true, 'rounds_solved', v_play.rounds_solved, 'time_ms', v_play.total_time_ms, 'score', v_play.score,
    'total_players', v_total, 'avg_time_ms', v_avg,
    'percentile', CASE WHEN v_total > 0 THEN round(100.0 * v_better / v_total, 1) ELSE 0 END,
    'streak', v_streak, 'freezes', v_freezes);
END $$;
GRANT EXECUTE ON FUNCTION public.puzzle_finish(UUID) TO authenticated;

-- My streak/stats for a level.
CREATE OR REPLACE FUNCTION public.puzzle_my_stats(p_level TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_level TEXT;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  v_level := COALESCE(p_level, (SELECT level FROM public.puzzle_user_prefs WHERE user_id=v_user), 'easy');
  RETURN COALESCE((SELECT jsonb_build_object('ok', true, 'level', v_level,
    'current_streak', current_streak, 'best_streak', best_streak, 'freezes', freezes,
    'games_played', games_played, 'games_won', games_won, 'total_score', total_score)
    FROM public.puzzle_progress WHERE user_id=v_user AND level=v_level),
    jsonb_build_object('ok', true, 'level', v_level, 'current_streak', 0, 'best_streak', 0, 'freezes', 0, 'games_played', 0, 'games_won', 0, 'total_score', 0));
END $$;
GRANT EXECUTE ON FUNCTION public.puzzle_my_stats(TEXT) TO authenticated;
