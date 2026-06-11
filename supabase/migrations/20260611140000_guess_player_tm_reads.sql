-- Point the Guess-the-Player reads at tm_players (the proprietary warehouse).
-- guess_player: name + reveal from tm_players.
CREATE OR REPLACE FUNCTION public.puzzle_guess_player(p_game_id UUID, p_round_no INTEGER, p_player_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_play public.puzzle_plays; v_round public.puzzle_rounds; v_cfg public.puzzle_config;
  v_att public.puzzle_round_attempts; v_solved BOOLEAN; v_attempts INT; v_name TEXT; v_exhausted BOOLEAN;
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
  IF v_cfg.max_attempts > 0 AND COALESCE(v_att.attempts,0) >= v_cfg.max_attempts THEN RETURN jsonb_build_object('ok', false, 'error', 'no_attempts_left'); END IF;
  v_solved := (p_player_id = v_round.answer_player_id);
  v_attempts := COALESCE(v_att.attempts,0) + 1;
  v_exhausted := (v_cfg.max_attempts > 0 AND v_attempts >= v_cfg.max_attempts);
  SELECT name INTO v_name FROM public.tm_players WHERE player_id = p_player_id;
  INSERT INTO public.puzzle_round_attempts (play_id, round_no, guesses, solved, attempts)
  VALUES (v_play.id, p_round_no, jsonb_build_array(jsonb_build_object('pid',p_player_id,'name',v_name,'correct',v_solved)), v_solved, 1)
  ON CONFLICT (play_id, round_no) DO UPDATE SET
    guesses = public.puzzle_round_attempts.guesses || jsonb_build_object('pid',p_player_id,'name',v_name,'correct',v_solved), solved = v_solved, attempts = v_attempts;
  RETURN jsonb_build_object('ok', true, 'solved', v_solved, 'attempts_used', v_attempts,
    'attempts_left', CASE WHEN v_cfg.max_attempts > 0 THEN v_cfg.max_attempts - v_attempts ELSE NULL END,
    'reveal', CASE WHEN v_solved OR v_exhausted THEN (SELECT jsonb_build_object('name', name, 'photo', photo_url) FROM public.tm_players WHERE player_id = v_round.answer_player_id) ELSE NULL END);
END $$;

CREATE OR REPLACE FUNCTION public.puzzle_reveal_letters(p_game_id UUID, p_round_no INTEGER, p_n INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_play public.puzzle_plays; v_round public.puzzle_rounds; v_name TEXT; v_masked TEXT;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=p_game_id;
  IF v_play.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_started'); END IF;
  SELECT * INTO v_round FROM public.puzzle_rounds WHERE game_id=p_game_id AND round_no=p_round_no;
  IF v_round.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_round'); END IF;
  SELECT name INTO v_name FROM public.tm_players WHERE player_id = v_round.answer_player_id;
  IF v_name IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_name'); END IF;
  SELECT string_agg(CASE WHEN t.ord <= GREATEST(0,p_n) THEN t.ch WHEN t.ch ~ '[[:alnum:]]' THEN '_' ELSE t.ch END, '' ORDER BY t.ord)
  INTO v_masked FROM regexp_split_to_table(v_name, '') WITH ORDINALITY AS t(ch, ord);
  RETURN jsonb_build_object('ok', true, 'masked', v_masked, 'length', char_length(v_name));
END $$;

CREATE OR REPLACE FUNCTION public.puzzle_giveup_player(p_game_id UUID, p_round_no INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_play public.puzzle_plays; v_round public.puzzle_rounds;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=p_game_id;
  IF v_play.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_started'); END IF;
  SELECT * INTO v_round FROM public.puzzle_rounds WHERE game_id=p_game_id AND round_no=p_round_no;
  IF v_round.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_round'); END IF;
  INSERT INTO public.puzzle_round_attempts (play_id, round_no, guesses, solved, attempts, given_up)
  VALUES (v_play.id, p_round_no, '[]'::jsonb, false, COALESCE((SELECT attempts FROM public.puzzle_round_attempts WHERE play_id=v_play.id AND round_no=p_round_no),0), true)
  ON CONFLICT (play_id, round_no) DO UPDATE SET given_up = true;
  RETURN jsonb_build_object('ok', true,
    'reveal', (SELECT jsonb_build_object('name', name, 'photo', photo_url) FROM public.tm_players WHERE player_id = v_round.answer_player_id));
END $$;

-- get_today_player: reveal from tm_players
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
    'play', jsonb_build_object('id', v_play.id, 'started_at', v_play.started_at, 'finished_at', v_play.finished_at, 'rounds_solved', v_play.rounds_solved, 'score', v_play.score),
    'game', jsonb_build_object('id', v_game.id),
    'rounds', (
      SELECT jsonb_agg(jsonb_build_object(
        'round_no', r.round_no,
        'trail', (SELECT jsonb_agg(elem ORDER BY ord) FROM jsonb_array_elements(r.payload->'trail') WITH ORDINALITY AS t(elem, ord)
                  WHERE ord > GREATEST(0, jsonb_array_length(r.payload->'trail') - v_cap)),
        'trail_total', jsonb_array_length(r.payload->'trail'),
        'hints', r.payload->'hints',
        'attempt', (SELECT jsonb_build_object('guesses', a.guesses, 'solved', a.solved, 'attempts', a.attempts, 'given_up', a.given_up)
                    FROM public.puzzle_round_attempts a WHERE a.play_id=v_play.id AND a.round_no=r.round_no),
        'reveal', (SELECT CASE WHEN a.solved OR a.given_up OR (v_cfg.max_attempts > 0 AND a.attempts >= v_cfg.max_attempts) OR v_play.finished_at IS NOT NULL
                     THEN (SELECT jsonb_build_object('name', p.name, 'photo', p.photo_url) FROM public.tm_players p WHERE p.player_id = r.answer_player_id) ELSE NULL END
                   FROM public.puzzle_round_attempts a WHERE a.play_id=v_play.id AND a.round_no=r.round_no)
      ) ORDER BY r.round_no)
      FROM public.puzzle_rounds r WHERE r.game_id=v_game.id
    )
  );
END $$;
