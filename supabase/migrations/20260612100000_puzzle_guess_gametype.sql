-- Fix: puzzle_guess read the hint pref without filtering by game_type. Since prefs are
-- now per game_type, it could pick guess_player/guess_lineup's row (wrong/NULL hint) ->
-- wrong feedback (arrows gone for guess_score). Filter by game_type='guess_score'.
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
  v_hint := COALESCE((SELECT hint FROM public.puzzle_user_prefs WHERE user_id=v_user AND game_type='guess_score'), 'easy');

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
