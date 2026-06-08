-- ============================================================================
-- TOURNAMENT QUEST — save RPCs with phase locking.
-- A phase is writable only while its window is 'open' (and before locks_at).
-- Daily picks also lock at the match's start_time.
-- ============================================================================

-- Is a prediction phase currently open? (no window row => open by default)
CREATE OR REPLACE FUNCTION public.tq_phase_open(p_comp UUID, p_phase TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT (state = 'open' AND (locks_at IS NULL OR now() < locks_at))
    FROM public.tq_phase_windows WHERE competition_id = p_comp AND phase_key = p_phase
  ), true);
$$;
GRANT EXECUTE ON FUNCTION public.tq_phase_open(UUID, TEXT) TO anon, authenticated, service_role;

-- Get or create the caller's entry for a competition.
CREATE OR REPLACE FUNCTION public.tq_get_or_create_entry(p_comp UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO v_id FROM public.tq_entries WHERE user_id = auth.uid() AND competition_id = p_comp;
  IF v_id IS NULL THEN
    INSERT INTO public.tq_entries (user_id, competition_id) VALUES (auth.uid(), p_comp) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.tq_get_or_create_entry(UUID) TO authenticated, service_role;

-- ── Save long-term picks ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tq_save_long_term(
  p_comp UUID, p_champion UUID, p_finalist UUID,
  p_top_scorer BIGINT DEFAULT NULL, p_total_goals INTEGER DEFAULT NULL, p_extras JSONB DEFAULT '{}'::jsonb)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_entry UUID;
BEGIN
  IF NOT public.tq_phase_open(p_comp, 'long_term') THEN RAISE EXCEPTION 'Long-term predictions are locked'; END IF;
  v_entry := public.tq_get_or_create_entry(p_comp);
  INSERT INTO public.tq_long_term_predictions (entry_id, champion_team_id, finalist_team_id, top_scorer_player_id, total_goals_prediction, extras_json)
  VALUES (v_entry, p_champion, p_finalist, p_top_scorer, p_total_goals, COALESCE(p_extras,'{}'::jsonb))
  ON CONFLICT (entry_id) DO UPDATE SET
    champion_team_id = EXCLUDED.champion_team_id, finalist_team_id = EXCLUDED.finalist_team_id,
    top_scorer_player_id = EXCLUDED.top_scorer_player_id, total_goals_prediction = EXCLUDED.total_goals_prediction,
    extras_json = EXCLUDED.extras_json;
  UPDATE public.tq_entries SET total_goals_prediction = p_total_goals, last_prediction_at = now() WHERE id = v_entry;
END;
$$;
GRANT EXECUTE ON FUNCTION public.tq_save_long_term(UUID, UUID, UUID, BIGINT, INTEGER, JSONB) TO authenticated, service_role;

-- ── Save a group's qualifier picks (p_picks = [{team_id, position}, ...]) ─────
CREATE OR REPLACE FUNCTION public.tq_save_group_prediction(p_comp UUID, p_group_id UUID, p_picks JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_entry UUID; pick JSONB;
BEGIN
  IF NOT public.tq_phase_open(p_comp, 'group') THEN RAISE EXCEPTION 'Group predictions are locked'; END IF;
  v_entry := public.tq_get_or_create_entry(p_comp);
  DELETE FROM public.tq_group_predictions WHERE entry_id = v_entry AND group_id = p_group_id;
  FOR pick IN SELECT * FROM jsonb_array_elements(p_picks) LOOP
    INSERT INTO public.tq_group_predictions (entry_id, group_id, predicted_team_id, predicted_position)
    VALUES (v_entry, p_group_id, (pick->>'team_id')::uuid, (pick->>'position')::int);
  END LOOP;
  UPDATE public.tq_entries SET last_prediction_at = now() WHERE id = v_entry;
END;
$$;
GRANT EXECUTE ON FUNCTION public.tq_save_group_prediction(UUID, UUID, JSONB) TO authenticated, service_role;

-- ── Save a daily match prediction (locks at kickoff) ─────────────────────────
CREATE OR REPLACE FUNCTION public.tq_save_daily_prediction(
  p_comp UUID, p_match_id UUID, p_result TEXT, p_bucket TEXT,
  p_first_scorer UUID DEFAULT NULL, p_score_a INTEGER DEFAULT NULL, p_score_b INTEGER DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_entry UUID; v_start TIMESTAMPTZ; v_status TEXT;
BEGIN
  SELECT start_time, status INTO v_start, v_status FROM public.tq_matches WHERE id = p_match_id AND competition_id = p_comp;
  IF v_status <> 'scheduled' OR (v_start IS NOT NULL AND now() >= v_start) THEN
    RAISE EXCEPTION 'This match is locked';
  END IF;
  v_entry := public.tq_get_or_create_entry(p_comp);
  INSERT INTO public.tq_daily_predictions (entry_id, match_id, predicted_result, predicted_goal_diff_bucket, predicted_first_scorer_team_id, predicted_score_a, predicted_score_b)
  VALUES (v_entry, p_match_id, p_result, p_bucket, p_first_scorer, p_score_a, p_score_b)
  ON CONFLICT (entry_id, match_id) DO UPDATE SET
    predicted_result = EXCLUDED.predicted_result, predicted_goal_diff_bucket = EXCLUDED.predicted_goal_diff_bucket,
    predicted_first_scorer_team_id = EXCLUDED.predicted_first_scorer_team_id,
    predicted_score_a = EXCLUDED.predicted_score_a, predicted_score_b = EXCLUDED.predicted_score_b;
  UPDATE public.tq_entries SET last_prediction_at = now() WHERE id = v_entry;
END;
$$;
GRANT EXECUTE ON FUNCTION public.tq_save_daily_prediction(UUID, UUID, TEXT, TEXT, UUID, INTEGER, INTEGER) TO authenticated, service_role;

-- ── Save a bracket round's predicted qualifiers (p_team_ids = uuid[]) ─────────
CREATE OR REPLACE FUNCTION public.tq_save_bracket_prediction(p_comp UUID, p_round_key TEXT, p_team_ids UUID[])
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_entry UUID; tid UUID;
BEGIN
  IF NOT public.tq_phase_open(p_comp, p_round_key) THEN RAISE EXCEPTION 'This round is locked'; END IF;
  v_entry := public.tq_get_or_create_entry(p_comp);
  DELETE FROM public.tq_bracket_predictions WHERE entry_id = v_entry AND round_key = p_round_key;
  FOREACH tid IN ARRAY p_team_ids LOOP
    INSERT INTO public.tq_bracket_predictions (entry_id, round_key, predicted_winner_team_id)
    VALUES (v_entry, p_round_key, tid);
  END LOOP;
  UPDATE public.tq_entries SET last_prediction_at = now() WHERE id = v_entry;
END;
$$;
GRANT EXECUTE ON FUNCTION public.tq_save_bracket_prediction(UUID, TEXT, UUID[]) TO authenticated, service_role;
