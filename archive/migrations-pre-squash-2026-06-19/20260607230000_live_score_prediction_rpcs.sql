-- ============================================================================
-- Live Game A — secure RPCs: join (server coin deduction), submit prediction
-- (lock at kickoff + server-generated bonus questions), halftime edit (malus).
-- ============================================================================

-- Join a live score-prediction game. Ranked -> deduct entry_cost server-side.
CREATE OR REPLACE FUNCTION public.join_live_game(p_game_id UUID, p_user_id UUID)
RETURNS TABLE(entry_id UUID, already_joined BOOLEAN) AS $$
DECLARE
  v_mode TEXT;
  v_cost INTEGER;
  v_status TEXT;
  v_fixture_id UUID;
  v_fix_status TEXT;
  v_existing UUID;
  v_new UUID;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT mode, COALESCE(entry_cost, 0), status, fixture_id
    INTO v_mode, v_cost, v_status, v_fixture_id
  FROM public.live_games WHERE id = p_game_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'game_not_found'; END IF;
  IF v_status IN ('finished', 'cancelled') THEN RAISE EXCEPTION 'game_over'; END IF;

  SELECT status INTO v_fix_status FROM public.fb_fixtures WHERE id = v_fixture_id;
  IF v_fix_status IN ('FT', 'AET', 'PEN', 'CANC', 'ABD', 'WO', 'AWD') THEN
    RAISE EXCEPTION 'match_over';
  END IF;

  SELECT id INTO v_existing FROM public.live_game_entries
  WHERE live_game_id = p_game_id AND user_id = p_user_id;
  IF FOUND THEN
    entry_id := v_existing; already_joined := true; RETURN NEXT; RETURN;
  END IF;

  IF v_mode = 'ranked' AND v_cost > 0 THEN
    PERFORM public.deduct_coins(p_user_id, v_cost, 'live_game_entry',
      jsonb_build_object('live_game_id', p_game_id));
  END IF;

  INSERT INTO public.live_game_entries (live_game_id, user_id)
  VALUES (p_game_id, p_user_id)
  RETURNING id INTO v_new;

  entry_id := v_new; already_joined := false; RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Submit (or re-submit before kickoff) a score prediction + bonus answers.
-- The 3 bonus questions are generated SERVER-SIDE from the predicted scoreline.
CREATE OR REPLACE FUNCTION public.submit_live_prediction(
  p_game_id UUID, p_user_id UUID, p_home INTEGER, p_away INTEGER, p_bonus_answers JSONB
) RETURNS JSONB AS $$
DECLARE
  v_fixture_id UUID;
  v_date TIMESTAMPTZ;
  v_questions JSONB;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_home < 0 OR p_away < 0 THEN RAISE EXCEPTION 'invalid_score'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.live_game_entries
                 WHERE live_game_id = p_game_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'not_joined';
  END IF;

  SELECT fixture_id INTO v_fixture_id FROM public.live_games WHERE id = p_game_id;
  SELECT date INTO v_date FROM public.fb_fixtures WHERE id = v_fixture_id;
  IF v_date IS NULL OR v_date <= now() THEN RAISE EXCEPTION 'match_started'; END IF;

  -- Bonus questions conditioned on the prediction (resolvable from final score).
  IF p_home <> p_away THEN
    v_questions := jsonb_build_array(
      jsonb_build_object('key','clean_sheet_winner','points',20,'prompt','Clean sheet for your pick?'),
      jsonb_build_object('key','btts','points',10,'prompt','Both teams to score?'),
      jsonb_build_object('key','over25','points',10,'prompt','Over 2.5 goals?'));
  ELSE
    v_questions := jsonb_build_array(
      jsonb_build_object('key','btts','points',20,'prompt','Both teams to score?'),
      jsonb_build_object('key','over25','points',10,'prompt','Over 2.5 goals?'),
      jsonb_build_object('key','nil_nil','points',10,'prompt','Will it be 0-0?'));
  END IF;

  UPDATE public.live_game_entries
  SET predicted_score = jsonb_build_object('home', p_home, 'away', p_away),
      bonus_questions = v_questions,
      bonus_answers   = COALESCE(p_bonus_answers, '{}'::jsonb),
      midtime_edit    = false,
      submitted_at    = now()
  WHERE live_game_id = p_game_id AND user_id = p_user_id;

  RETURN v_questions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Edit the predicted scoreline once the match is live (e.g. halftime) -> -40% malus.
-- Bonus questions/answers stay frozen at the initial submission.
CREATE OR REPLACE FUNCTION public.edit_live_prediction(
  p_game_id UUID, p_user_id UUID, p_home INTEGER, p_away INTEGER
) RETURNS VOID AS $$
DECLARE
  v_fixture_id UUID;
  v_fix_status TEXT;
  v_date TIMESTAMPTZ;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_home < 0 OR p_away < 0 THEN RAISE EXCEPTION 'invalid_score'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.live_game_entries
                 WHERE live_game_id = p_game_id AND user_id = p_user_id AND predicted_score IS NOT NULL) THEN
    RAISE EXCEPTION 'no_prediction';
  END IF;

  SELECT fixture_id INTO v_fixture_id FROM public.live_games WHERE id = p_game_id;
  SELECT status, date INTO v_fix_status, v_date FROM public.fb_fixtures WHERE id = v_fixture_id;
  -- Allowed only while the match is live (started, not finished/cancelled).
  IF v_date IS NULL OR v_date > now() THEN RAISE EXCEPTION 'match_not_started'; END IF;
  IF v_fix_status IN ('FT', 'AET', 'PEN', 'CANC', 'ABD', 'WO', 'AWD') THEN
    RAISE EXCEPTION 'match_over';
  END IF;

  UPDATE public.live_game_entries
  SET predicted_score = jsonb_build_object('home', p_home, 'away', p_away),
      midtime_edit = true
  WHERE live_game_id = p_game_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.join_live_game(UUID, UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.submit_live_prediction(UUID, UUID, INTEGER, INTEGER, JSONB) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.edit_live_prediction(UUID, UUID, INTEGER, INTEGER) TO authenticated, anon, service_role;
