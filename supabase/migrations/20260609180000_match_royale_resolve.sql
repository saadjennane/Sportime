-- ─────────────────────────────────────────────────────────────────────────────
-- Match Royale — Phase B (cont.): resolution, finalize/payout, and the tick
-- orchestrator driven by the live fixture status.
-- ─────────────────────────────────────────────────────────────────────────────

-- Snapshot the current cumulative stats as the baseline for a phase's team questions.
CREATE OR REPLACE FUNCTION public.mr_snapshot_baselines(p_game_id UUID, p_phase TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_api BIGINT; v_home BIGINT; v_away BIGINT; q RECORD; vh INT; va INT;
BEGIN
  SELECT g.api_fixture_id, ht.api_id, at2.api_id INTO v_api, v_home, v_away
  FROM public.mr_games g
  JOIN public.fb_fixtures f ON f.id = g.fixture_id
  LEFT JOIN public.fb_teams ht ON ht.id = f.home_team_id
  LEFT JOIN public.fb_teams at2 ON at2.id = f.away_team_id
  WHERE g.id = p_game_id;
  FOR q IN SELECT * FROM public.mr_questions WHERE game_id=p_game_id AND phase=p_phase AND answer_type='team' AND NOT is_tie_break LOOP
    SELECT COALESCE((SELECT stat_value::INT FROM public.fb_fixture_statistics WHERE api_fixture_id=v_api AND team_api_id=v_home AND stat_type=public.mr_source_key(q.catalog_key)),0) INTO vh;
    SELECT COALESCE((SELECT stat_value::INT FROM public.fb_fixture_statistics WHERE api_fixture_id=v_api AND team_api_id=v_away AND stat_type=public.mr_source_key(q.catalog_key)),0) INTO va;
    UPDATE public.mr_questions SET baseline = jsonb_build_object('home',vh,'away',va) WHERE id=q.id;
  END LOOP;
END; $$;

-- helper: stat type for a catalog key
CREATE OR REPLACE FUNCTION public.mr_source_key(p_catalog_key TEXT)
RETURNS TEXT LANGUAGE sql STABLE AS $$ SELECT source_key FROM public.mr_event_catalog WHERE key = p_catalog_key $$;

-- Resolve locked, unresolved questions. p_force_end resolves the undetermined ones (yes/no -> no, team -> void).
CREATE OR REPLACE FUNCTION public.mr_resolve(p_game_id UUID, p_force_end BOOLEAN DEFAULT false)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_g public.mr_games; v_api BIGINT; v_home BIGINT; v_away BIGINT;
  q RECORD; v_correct TEXT; v_src TEXT; v_filter TEXT; vh INT; va INT; bh INT; ba INT;
  v_lo INT; v_hi INT; v_found BOOLEAN; p RECORD;
BEGIN
  SELECT * INTO v_g FROM public.mr_games WHERE id = p_game_id;
  SELECT ht.api_id, at2.api_id INTO v_home, v_away
  FROM public.fb_fixtures f LEFT JOIN public.fb_teams ht ON ht.id=f.home_team_id LEFT JOIN public.fb_teams at2 ON at2.id=f.away_team_id
  WHERE f.id = v_g.fixture_id;
  v_api := v_g.api_fixture_id;

  FOR q IN SELECT * FROM public.mr_questions WHERE game_id=p_game_id AND status='open' AND NOT is_tie_break
    AND ( (phase='pre_match' AND v_g.status IN ('first_half','half_time','second_half','finished'))
       OR (phase='half_time' AND v_g.status IN ('second_half','finished')) )
  LOOP
    v_correct := NULL;
    SELECT source_key, detail_filter INTO v_src, v_filter FROM public.mr_event_catalog WHERE key=q.catalog_key;
    IF q.answer_type = 'team' THEN
      bh := COALESCE((q.baseline->>'home')::INT,0); ba := COALESCE((q.baseline->>'away')::INT,0);
      SELECT COALESCE((SELECT stat_value::INT FROM public.fb_fixture_statistics WHERE api_fixture_id=v_api AND team_api_id=v_home AND stat_type=v_src),0),
             COALESCE((SELECT stat_value::INT FROM public.fb_fixture_statistics WHERE api_fixture_id=v_api AND team_api_id=v_away AND stat_type=v_src),0)
      INTO vh, va;
      IF (vh > bh) AND (va = ba) THEN v_correct := 'home';
      ELSIF (va > ba) AND (vh = bh) THEN v_correct := 'away';
      ELSIF (vh > bh) AND (va > ba) THEN
        IF p_force_end THEN UPDATE public.mr_questions SET status='void', resolved_at=now() WHERE id=q.id; CONTINUE; END IF;
      END IF;
      IF v_correct IS NULL AND p_force_end THEN UPDATE public.mr_questions SET status='void', resolved_at=now() WHERE id=q.id; CONTINUE; END IF;
    ELSE -- yesno via event in the half range
      IF q.half = 1 THEN v_lo := 0; v_hi := 45; ELSE v_lo := 46; v_hi := 200; END IF;
      SELECT EXISTS (SELECT 1 FROM public.fb_fixture_events WHERE api_fixture_id=v_api AND type=v_src
        AND (v_filter IS NULL OR detail ILIKE '%'||v_filter||'%') AND elapsed BETWEEN v_lo AND v_hi) INTO v_found;
      IF v_found THEN v_correct := 'yes';
      ELSIF p_force_end THEN v_correct := 'no';
      END IF;
    END IF;

    IF v_correct IS NULL THEN CONTINUE; END IF; -- still undetermined

    -- resolve + apply hearts
    UPDATE public.mr_questions SET status='resolved', correct_key=v_correct, resolved_at=now() WHERE id=q.id;
    UPDATE public.mr_answers SET is_correct = (option_key = v_correct) WHERE question_id=q.id;
    FOR p IN SELECT * FROM public.mr_participants WHERE game_id=p_game_id AND status='alive' LOOP
      IF NOT EXISTS (SELECT 1 FROM public.mr_answers WHERE question_id=q.id AND user_id=p.user_id AND option_key=v_correct) THEN
        UPDATE public.mr_participants SET lives = lives - 1,
          status = CASE WHEN lives - 1 <= 0 THEN 'eliminated' ELSE 'alive' END,
          eliminated_at = CASE WHEN lives - 1 <= 0 THEN now() ELSE eliminated_at END,
          eliminated_question_seq = CASE WHEN lives - 1 <= 0 THEN q.seq ELSE eliminated_question_seq END
        WHERE id = p.id;
      END IF;
    END LOOP;
  END LOOP;
END; $$;

-- Compute the pot, pick winners (survivors, else tie-break of last-eliminated group), pay out.
CREATE OR REPLACE FUNCTION public.mr_finalize(p_game_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_g public.mr_games; v_count INT; v_pot INT := 0; v_profile public.mr_pot_profiles;
  v_had_goal BOOLEAN; v_winners UUID[]; v_last_seq INT; v_tb_key TEXT; v_share INT; w UUID;
BEGIN
  SELECT * INTO v_g FROM public.mr_games WHERE id = p_game_id;
  IF v_g.status = 'finished' THEN RETURN jsonb_build_object('ok',true,'already',true); END IF;
  SELECT count(*) INTO v_count FROM public.mr_participants WHERE game_id=p_game_id;

  -- pot amount
  IF v_g.pot_profile_id IS NOT NULL THEN
    SELECT * INTO v_profile FROM public.mr_pot_profiles WHERE id=v_g.pot_profile_id;
    IF v_profile.type='fixed' THEN v_pot := COALESCE(v_g.pot_amount, v_profile.fixed_amount, 0);
    ELSIF v_profile.type='progressive' THEN
      SELECT COALESCE((t->>'amount')::INT,0) INTO v_pot FROM jsonb_array_elements(v_profile.tiers) t
      WHERE v_count >= (t->>'min')::INT AND (t->>'max' IS NULL OR v_count <= (t->>'max')::INT) LIMIT 1;
    ELSIF v_profile.type='funded' THEN
      v_pot := FLOOR(v_count * COALESCE(v_profile.entry_cost,0) * COALESCE(v_profile.redistribution_pct,100) / 100.0);
    END IF;
  ELSE v_pot := COALESCE(v_g.pot_amount, 0);
  END IF;

  -- winners: survivors, else tie-break of the last eliminated group
  SELECT array_agg(user_id) INTO v_winners FROM public.mr_participants WHERE game_id=p_game_id AND status='alive';
  IF v_winners IS NULL THEN
    SELECT max(eliminated_question_seq) INTO v_last_seq FROM public.mr_participants WHERE game_id=p_game_id;
    SELECT EXISTS (SELECT 1 FROM public.fb_fixture_events WHERE api_fixture_id=v_g.api_fixture_id AND type='Goal') INTO v_had_goal;
    v_tb_key := CASE WHEN v_had_goal THEN 'yes' ELSE 'no' END;
    SELECT array_agg(p.user_id) INTO v_winners
    FROM public.mr_participants p
    JOIN public.mr_questions tq ON tq.game_id=p_game_id AND tq.is_tie_break
    JOIN public.mr_answers a ON a.question_id=tq.id AND a.user_id=p.user_id
    WHERE p.game_id=p_game_id AND p.eliminated_question_seq=v_last_seq AND a.option_key=v_tb_key;
  END IF;

  -- pay out (equal split)
  IF v_winners IS NOT NULL AND array_length(v_winners,1) > 0 AND v_pot > 0 THEN
    v_share := FLOOR(v_pot / array_length(v_winners,1));
    FOREACH w IN ARRAY v_winners LOOP
      UPDATE public.mr_participants SET is_winner=true, prize_amount=v_share WHERE game_id=p_game_id AND user_id=w;
      PERFORM public.add_coins(w, v_share, 'challenge_reward', jsonb_build_object('match_royale',p_game_id));
    END LOOP;
  END IF;

  UPDATE public.mr_games SET status='finished', pot_amount=v_pot, updated_at=now() WHERE id=p_game_id;
  RETURN jsonb_build_object('ok',true,'pot',v_pot,'winners',COALESCE(array_length(v_winners,1),0));
END; $$;

-- Orchestrator: advance phases + resolve + finalize based on the live fixture status.
CREATE OR REPLACE FUNCTION public.mr_tick(p_game_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_g public.mr_games; v_status TEXT;
BEGIN
  SELECT * INTO v_g FROM public.mr_games WHERE id=p_game_id;
  IF v_g.status IN ('finished','cancelled') THEN RETURN; END IF;
  SELECT status INTO v_status FROM public.fb_fixtures WHERE id=v_g.fixture_id;

  -- open -> first_half (kickoff): lock pre-match, snapshot baselines
  IF v_g.status='open' AND v_status IN ('1H','LIVE','HT','2H','ET','BT','P','FT','AET','PEN') THEN
    PERFORM public.mr_snapshot_baselines(p_game_id,'pre_match');
    UPDATE public.mr_games SET status='first_half', updated_at=now() WHERE id=p_game_id;
    SELECT * INTO v_g FROM public.mr_games WHERE id=p_game_id;
  END IF;

  -- first_half -> half_time (HT): resolve half 1, generate half-time questions
  IF v_g.status='first_half' AND v_status IN ('HT','2H','ET','BT','P','FT','AET','PEN') THEN
    PERFORM public.mr_resolve(p_game_id, true);
    IF NOT EXISTS (SELECT 1 FROM public.mr_questions WHERE game_id=p_game_id AND phase='half_time') THEN
      PERFORM public.mr_gen_questions(p_game_id, 'half_time', 2, (SELECT questions_half FROM public.mr_config WHERE id=1), 50);
    END IF;
    UPDATE public.mr_games SET status='half_time', updated_at=now() WHERE id=p_game_id;
    SELECT * INTO v_g FROM public.mr_games WHERE id=p_game_id;
  END IF;

  -- half_time -> second_half (2H): lock half-time answers, snapshot baselines
  IF v_g.status='half_time' AND v_status IN ('2H','ET','BT','P','FT','AET','PEN') THEN
    PERFORM public.mr_snapshot_baselines(p_game_id,'half_time');
    UPDATE public.mr_games SET status='second_half', updated_at=now() WHERE id=p_game_id;
    SELECT * INTO v_g FROM public.mr_games WHERE id=p_game_id;
  END IF;

  -- resolve in-progress
  IF v_g.status IN ('first_half','second_half') THEN
    PERFORM public.mr_resolve(p_game_id, false);
  END IF;

  -- full time -> resolve remainder + finalize
  IF v_status IN ('FT','AET','PEN') AND v_g.status NOT IN ('finished','cancelled','open') THEN
    PERFORM public.mr_resolve(p_game_id, true);
    PERFORM public.mr_finalize(p_game_id);
  END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.mr_tick(UUID) TO authenticated, service_role;
