-- ─────────────────────────────────────────────────────────────────────────────
-- Match Royale — Phase B: the engine.
-- create -> join -> answer -> (auto phase transitions + resolve via mr_tick) -> finalize/payout.
-- mr_games.status: open | first_half | half_time | second_half | finished | cancelled
-- ─────────────────────────────────────────────────────────────────────────────

-- Generate `p_count` random binary questions for a phase/half.
CREATE OR REPLACE FUNCTION public.mr_gen_questions(p_game_id UUID, p_phase TEXT, p_half INT, p_count INT, p_start_seq INT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_fixture UUID; v_home TEXT; v_away TEXT; v_seq INT := p_start_seq; c RECORD; v_opts JSONB;
BEGIN
  SELECT g.fixture_id INTO v_fixture FROM public.mr_games g WHERE g.id = p_game_id;
  SELECT ht.name, at2.name INTO v_home, v_away
  FROM public.fb_fixtures f
  LEFT JOIN public.fb_teams ht ON ht.id = f.home_team_id
  LEFT JOIN public.fb_teams at2 ON at2.id = f.away_team_id
  WHERE f.id = v_fixture;

  FOR c IN SELECT * FROM public.mr_event_catalog WHERE is_active ORDER BY random() LIMIT p_count LOOP
    v_opts := CASE WHEN c.answer_type = 'team'
      THEN jsonb_build_array(jsonb_build_object('key','home','label',COALESCE(v_home,'Home')), jsonb_build_object('key','away','label',COALESCE(v_away,'Away')))
      ELSE jsonb_build_array(jsonb_build_object('key','yes','label','Yes'), jsonb_build_object('key','no','label','No')) END;
    INSERT INTO public.mr_questions (game_id, seq, kind, prompt, options, status, phase, answer_type, catalog_key, half)
    VALUES (p_game_id, v_seq, c.key, c.label, v_opts, 'open', p_phase, c.answer_type, c.key, p_half);
    v_seq := v_seq + 1;
  END LOOP;
END; $$;

-- Create a Match Royale on a fixture (admin). Resolves the pot, snapshots config, builds pre-match questions + tie-break.
CREATE OR REPLACE FUNCTION public.mr_create_game(p_fixture_id UUID, p_name TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID; v_cfg public.mr_config; v_pot JSONB; v_profile UUID; v_amount INT; v_entry INT := 0; v_api BIGINT;
BEGIN
  SELECT * INTO v_cfg FROM public.mr_config WHERE id = 1;
  SELECT api_id INTO v_api FROM public.fb_fixtures WHERE id = p_fixture_id;
  v_pot := public.mr_resolve_pot(p_fixture_id);
  v_profile := NULLIF(v_pot->>'pot_profile_id','')::UUID;
  IF v_profile IS NOT NULL THEN
    SELECT CASE WHEN type='fixed' THEN COALESCE((v_pot->>'override_amount')::INT, fixed_amount) ELSE NULL END,
           CASE WHEN type='funded' THEN entry_cost ELSE 0 END
    INTO v_amount, v_entry FROM public.mr_pot_profiles WHERE id = v_profile;
  ELSIF (v_pot->>'override_amount') IS NOT NULL THEN
    v_amount := (v_pot->>'override_amount')::INT;
  END IF;

  INSERT INTO public.mr_games (fixture_id, api_fixture_id, name, status, hearts, lives_per_player, entry_cost, pot_profile_id, pot_amount, tier)
  VALUES (p_fixture_id, v_api, p_name, 'open', v_cfg.hearts, v_cfg.hearts, COALESCE(v_entry,0), v_profile, v_amount,
          COALESCE((SELECT rules->>'tier' FROM public.challenges WHERE false),'amateur'))
  RETURNING id INTO v_id;

  PERFORM public.mr_gen_questions(v_id, 'pre_match', 1, v_cfg.questions_pre, 1);
  IF v_cfg.tie_break_enabled THEN
    INSERT INTO public.mr_questions (game_id, seq, kind, prompt, options, status, phase, answer_type, catalog_key, half, is_tie_break)
    VALUES (v_id, 100, 'tie_break', 'At least one goal in the match?',
            jsonb_build_array(jsonb_build_object('key','yes','label','Yes'), jsonb_build_object('key','no','label','No')),
            'open', 'pre_match', 'yesno', 'tie_break', NULL, true);
  END IF;
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.mr_create_game(UUID, TEXT) TO authenticated;

-- Join (charges entry for funded pots). N hearts.
CREATE OR REPLACE FUNCTION public.mr_join(p_game_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_g public.mr_games; v_bal INT;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not authenticated'); END IF;
  SELECT * INTO v_g FROM public.mr_games WHERE id = p_game_id;
  IF v_g.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','game not found'); END IF;
  IF v_g.status <> 'open' THEN RETURN jsonb_build_object('ok',false,'error','entries closed'); END IF;
  IF EXISTS (SELECT 1 FROM public.mr_participants WHERE game_id=p_game_id AND user_id=v_user) THEN
    RETURN jsonb_build_object('ok',true,'already',true); END IF;
  IF COALESCE(v_g.entry_cost,0) > 0 THEN
    SELECT coins_balance INTO v_bal FROM public.users WHERE id=v_user;
    IF COALESCE(v_bal,0) < v_g.entry_cost THEN RETURN jsonb_build_object('ok',false,'error','insufficient_coins'); END IF;
    PERFORM public.deduct_coins(v_user, v_g.entry_cost, 'match_royale_entry', jsonb_build_object('game_id',p_game_id));
  END IF;
  INSERT INTO public.mr_participants (game_id, user_id, lives) VALUES (p_game_id, v_user, v_g.hearts);
  RETURN jsonb_build_object('ok',true,'hearts',v_g.hearts);
END; $$;
GRANT EXECUTE ON FUNCTION public.mr_join(UUID) TO authenticated;

-- Answer a question (only while its phase accepts answers).
CREATE OR REPLACE FUNCTION public.mr_answer(p_question_id UUID, p_option TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_q public.mr_questions; v_g public.mr_games;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not authenticated'); END IF;
  SELECT * INTO v_q FROM public.mr_questions WHERE id = p_question_id;
  IF v_q.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','question not found'); END IF;
  SELECT * INTO v_g FROM public.mr_games WHERE id = v_q.game_id;
  IF NOT EXISTS (SELECT 1 FROM public.mr_participants WHERE game_id=v_g.id AND user_id=v_user) THEN
    RETURN jsonb_build_object('ok',false,'error','not_joined'); END IF;
  -- pre_match answerable while 'open'; half_time answerable while 'half_time'
  IF NOT ((v_q.phase='pre_match' AND v_g.status='open') OR (v_q.phase='half_time' AND v_g.status='half_time')) THEN
    RETURN jsonb_build_object('ok',false,'error','locked'); END IF;
  INSERT INTO public.mr_answers (question_id, game_id, user_id, option_key)
  VALUES (p_question_id, v_g.id, v_user, p_option)
  ON CONFLICT (question_id, user_id) DO UPDATE SET option_key = EXCLUDED.option_key, answered_at = now();
  RETURN jsonb_build_object('ok',true);
END; $$;
GRANT EXECUTE ON FUNCTION public.mr_answer(UUID, TEXT) TO authenticated;
