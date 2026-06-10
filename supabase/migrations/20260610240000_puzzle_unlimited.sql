-- max_attempts = 0 means UNLIMITED guesses (a round only resolves when solved).
CREATE OR REPLACE FUNCTION public.puzzle_guess(p_game_id UUID, p_round_no INTEGER, p_home INTEGER, p_away INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_play public.puzzle_plays; v_round public.puzzle_rounds; v_cfg public.puzzle_config;
  v_att public.puzzle_round_attempts; v_solved BOOLEAN; v_attempts INT; v_hint TEXT; v_fb JSONB; v_d INT; b JSONB; v_heat TEXT := 'cold'; v_exhausted BOOLEAN;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=p_game_id;
  IF v_play.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_started'); END IF;
  IF v_play.finished_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'finished'); END IF;
  SELECT * INTO v_round FROM public.puzzle_rounds WHERE game_id=p_game_id AND round_no=p_round_no;
  IF v_round.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_round'); END IF;
  v_hint := COALESCE((SELECT hint FROM public.puzzle_user_prefs WHERE user_id=v_user), 'easy');

  SELECT * INTO v_att FROM public.puzzle_round_attempts WHERE play_id=v_play.id AND round_no=p_round_no;
  IF v_att.solved THEN RETURN jsonb_build_object('ok', true, 'already', true, 'solved', true); END IF;
  IF v_cfg.max_attempts > 0 AND COALESCE(v_att.attempts,0) >= v_cfg.max_attempts THEN RETURN jsonb_build_object('ok', false, 'error', 'no_attempts_left'); END IF;

  v_solved := (p_home = v_round.answer_home AND p_away = v_round.answer_away);
  v_d := abs(p_home - v_round.answer_home) + abs(p_away - v_round.answer_away);
  v_attempts := COALESCE(v_att.attempts,0) + 1;
  v_exhausted := (v_cfg.max_attempts > 0 AND v_attempts >= v_cfg.max_attempts);

  IF v_hint = 'easy' THEN
    v_fb := jsonb_build_object('kind','arrows',
      'home', CASE WHEN p_home < v_round.answer_home THEN 'up' WHEN p_home > v_round.answer_home THEN 'down' ELSE 'ok' END,
      'away', CASE WHEN p_away < v_round.answer_away THEN 'up' WHEN p_away > v_round.answer_away THEN 'down' ELSE 'ok' END);
  ELSIF v_hint = 'medium' THEN
    v_fb := jsonb_build_object('kind','distance','value', v_d);
  ELSE
    FOR b IN SELECT * FROM jsonb_array_elements(v_cfg.heat_bands) LOOP IF v_d <= (b->>'max')::int THEN v_heat := b->>'key'; EXIT; END IF; END LOOP;
    v_fb := jsonb_build_object('kind','heat','key', v_heat);
  END IF;

  INSERT INTO public.puzzle_round_attempts (play_id, round_no, guesses, solved, attempts)
  VALUES (v_play.id, p_round_no, jsonb_build_array(jsonb_build_object('h',p_home,'a',p_away,'fb',v_fb)), v_solved, 1)
  ON CONFLICT (play_id, round_no) DO UPDATE SET
    guesses = public.puzzle_round_attempts.guesses || jsonb_build_object('h',p_home,'a',p_away,'fb',v_fb), solved = v_solved, attempts = v_attempts;

  RETURN jsonb_build_object('ok', true, 'solved', v_solved, 'attempts_used', v_attempts,
    'attempts_left', CASE WHEN v_cfg.max_attempts > 0 THEN v_cfg.max_attempts - v_attempts ELSE NULL END, 'fb', v_fb,
    'reveal', CASE WHEN v_solved OR v_exhausted THEN jsonb_build_object('home', v_round.answer_home, 'away', v_round.answer_away) ELSE NULL END);
END $$;

-- get_today reveal must also respect unlimited (don't reveal just because attempts>=0).
CREATE OR REPLACE FUNCTION public.puzzle_get_today(p_level TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_scope TEXT; v_hint TEXT; v_has BOOLEAN; v_date DATE; v_game public.puzzle_games; v_play public.puzzle_plays; v_cfg public.puzzle_config;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  SELECT level, hint INTO v_scope, v_hint FROM public.puzzle_user_prefs WHERE user_id = v_user;
  v_has := (v_scope IS NOT NULL);
  v_scope := COALESCE(p_level, v_scope, 'big'); v_hint := COALESCE(v_hint, 'easy');
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
        'reveal', (SELECT CASE WHEN a.solved OR (v_cfg.max_attempts > 0 AND a.attempts >= v_cfg.max_attempts) OR v_play.finished_at IS NOT NULL
                     THEN jsonb_build_object('home', r.answer_home, 'away', r.answer_away) ELSE NULL END
                   FROM public.puzzle_round_attempts a WHERE a.play_id=v_play.id AND a.round_no=r.round_no)
      ) ORDER BY r.round_no)
      FROM public.puzzle_rounds r WHERE r.game_id=v_game.id
    )
  );
END $$;
