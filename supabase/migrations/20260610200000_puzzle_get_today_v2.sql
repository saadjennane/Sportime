-- get_today: p_level is the SCOPE now (big|all); also return hint pref + has_prefs.
CREATE OR REPLACE FUNCTION public.puzzle_get_today(p_level TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_scope TEXT; v_hint TEXT; v_has BOOLEAN; v_date DATE; v_game public.puzzle_games; v_play public.puzzle_plays; v_cfg public.puzzle_config;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  SELECT level, hint INTO v_scope, v_hint FROM public.puzzle_user_prefs WHERE user_id = v_user;
  v_has := (v_scope IS NOT NULL);
  v_scope := COALESCE(p_level, v_scope, 'big');
  v_hint := COALESCE(v_hint, 'easy');
  v_date := public.puzzle_current_date();

  SELECT * INTO v_game FROM public.puzzle_games WHERE game_type='guess_score' AND level=v_scope AND puzzle_date=v_date;
  IF v_game.id IS NULL THEN RETURN jsonb_build_object('ok', true, 'scope', v_scope, 'hint', v_hint, 'has_prefs', v_has, 'date', v_date, 'game', NULL); END IF;

  INSERT INTO public.puzzle_plays (user_id, game_id) VALUES (v_user, v_game.id) ON CONFLICT (user_id, game_id) DO NOTHING;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=v_game.id;

  RETURN jsonb_build_object(
    'ok', true, 'scope', v_scope, 'hint', v_hint, 'has_prefs', v_has, 'date', v_date,
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
