-- ============================================================================
-- TOURNAMENT QUEST — living bracket generation + advancement.
-- tq_generate_bracket: from resolved group standings, seed the first KO round
--   (standard cross-group pairing: Winner(G_2k) v Runner(G_2k+1), Winner(G_2k+1) v Runner(G_2k)).
-- tq_advance_round: from a finished round's winners, build the next round.
-- Bracket scoring re-aligned: a pick is correct if the team ADVANCED from that round.
-- ============================================================================

-- Bracket scoring: "advanced from round_key" = team is a winner of a round_key match.
CREATE OR REPLACE FUNCTION public.tq_score_bracket(p_entry_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_comp UUID; v_cfg JSONB; v_total INT := 0; v_correct INT := 0; r RECORD;
BEGIN
  SELECT competition_id INTO v_comp FROM public.tq_entries WHERE id = p_entry_id;
  SELECT config_json INTO v_cfg FROM public.tq_competitions WHERE id = v_comp;

  DELETE FROM public.tq_scoring_events WHERE entry_id = p_entry_id AND source_type = 'bracket';
  FOR r IN SELECT bp.id, bp.round_key, bp.predicted_winner_team_id
           FROM public.tq_bracket_predictions bp WHERE bp.entry_id = p_entry_id
  LOOP
    DECLARE
      advanced BOOLEAN; w INT; pts INT;
    BEGIN
      w := COALESCE((v_cfg->'scoring'->'bracket'->>r.round_key)::int, 0);
      advanced := EXISTS (
        SELECT 1 FROM public.tq_matches m
        WHERE m.competition_id = v_comp AND m.knockout_round = r.round_key
          AND m.winner_team_id = r.predicted_winner_team_id
      );
      pts := CASE WHEN advanced THEN w ELSE 0 END;
      UPDATE public.tq_bracket_predictions SET points_awarded = pts WHERE id = r.id;
      IF pts > 0 THEN
        v_correct := v_correct + 1;
        INSERT INTO public.tq_scoring_events(entry_id, source_type, source_id, points, reason)
        VALUES (p_entry_id, 'bracket', r.id, pts, 'advanced from ' || r.round_key);
      END IF;
      v_total := v_total + pts;
    END;
  END LOOP;

  UPDATE public.tq_entries SET bracket_score = v_total, correct_bracket_predictions_count = v_correct
  WHERE id = p_entry_id;
  RETURN v_total;
END;
$$;

-- Generate the first knockout round from resolved group standings.
CREATE OR REPLACE FUNCTION public.tq_generate_bracket(p_comp UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_round TEXT; v_groups UUID[]; n INT; k INT; created INT := 0;
  wa UUID; ra UUID; wb UUID; rb UUID;
BEGIN
  v_round := (public.tq_detect_format(p_comp)->'knockout_rounds'->>0);
  IF v_round IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no knockout rounds'); END IF;

  SELECT array_agg(id ORDER BY sort_order) INTO v_groups FROM public.tq_groups WHERE competition_id = p_comp;
  n := COALESCE(array_length(v_groups, 1), 0);
  IF n = 0 OR n % 2 <> 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'this generator needs an even number of groups (top-2)');
  END IF;
  -- require standings resolved
  IF EXISTS (SELECT 1 FROM public.tq_group_teams gt JOIN public.tq_groups g ON g.id = gt.group_id
             WHERE g.competition_id = p_comp AND gt.final_rank IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'group standings not resolved (final_rank missing)');
  END IF;

  DELETE FROM public.tq_matches WHERE competition_id = p_comp AND knockout_round = v_round;
  k := 1;
  WHILE k <= n LOOP
    SELECT team_id INTO wa FROM public.tq_group_teams WHERE group_id = v_groups[k]   AND final_rank = 1;
    SELECT team_id INTO ra FROM public.tq_group_teams WHERE group_id = v_groups[k]   AND final_rank = 2;
    SELECT team_id INTO wb FROM public.tq_group_teams WHERE group_id = v_groups[k+1] AND final_rank = 1;
    SELECT team_id INTO rb FROM public.tq_group_teams WHERE group_id = v_groups[k+1] AND final_rank = 2;
    INSERT INTO public.tq_matches (competition_id, knockout_round, bracket_slot, team_a_id, team_b_id, status)
      VALUES (p_comp, v_round, created, wa, rb, 'scheduled'); created := created + 1;
    INSERT INTO public.tq_matches (competition_id, knockout_round, bracket_slot, team_a_id, team_b_id, status)
      VALUES (p_comp, v_round, created, wb, ra, 'scheduled'); created := created + 1;
    k := k + 2;
  END LOOP;

  INSERT INTO public.tq_phase_windows (competition_id, phase_key, state) VALUES (p_comp, v_round, 'open')
    ON CONFLICT (competition_id, phase_key) DO UPDATE SET state = 'open';
  RETURN jsonb_build_object('ok', true, 'round', v_round, 'matches', created);
END;
$$;
GRANT EXECUTE ON FUNCTION public.tq_generate_bracket(UUID) TO service_role;

-- Build the next round from a finished round's winners.
CREATE OR REPLACE FUNCTION public.tq_advance_round(p_comp UUID, p_from TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rounds JSONB; v_idx INT; v_next TEXT; v_winners UUID[]; i INT; created INT := 0;
BEGIN
  v_rounds := public.tq_detect_format(p_comp)->'knockout_rounds';
  SELECT ord - 1 INTO v_idx FROM jsonb_array_elements_text(v_rounds) WITH ORDINALITY AS x(val, ord) WHERE val = p_from;
  IF v_idx IS NULL OR (v_idx + 1) >= jsonb_array_length(v_rounds) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no next round after ' || p_from);
  END IF;
  v_next := v_rounds->>(v_idx + 1);

  SELECT array_agg(winner_team_id ORDER BY bracket_slot) INTO v_winners
  FROM public.tq_matches WHERE competition_id = p_comp AND knockout_round = p_from AND status = 'finished' AND winner_team_id IS NOT NULL;
  IF v_winners IS NULL OR array_length(v_winners,1) % 2 <> 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'round ' || p_from || ' not fully resolved');
  END IF;

  DELETE FROM public.tq_matches WHERE competition_id = p_comp AND knockout_round = v_next;
  i := 1;
  WHILE i <= array_length(v_winners, 1) LOOP
    INSERT INTO public.tq_matches (competition_id, knockout_round, bracket_slot, team_a_id, team_b_id, status)
      VALUES (p_comp, v_next, created, v_winners[i], v_winners[i+1], 'scheduled');
    created := created + 1; i := i + 2;
  END LOOP;

  INSERT INTO public.tq_phase_windows (competition_id, phase_key, state) VALUES (p_comp, v_next, 'open')
    ON CONFLICT (competition_id, phase_key) DO UPDATE SET state = 'open';
  RETURN jsonb_build_object('ok', true, 'next', v_next, 'matches', created);
END;
$$;
GRANT EXECUTE ON FUNCTION public.tq_advance_round(UUID, TEXT) TO service_role;

-- ── Self-test on a throwaway competition (4 groups -> QF) ────────────────────
DO $$
DECLARE
  v UUID := gen_random_uuid(); g UUID; gi INT; ti INT; tid UUID; res JSONB; cnt INT;
BEGIN
  INSERT INTO public.tq_competitions (id, name, slug, status, config_json)
  VALUES (v, 'TQ gen test', 'tq-gen-test-' || substr(v::text,1,8), 'draft',
          '{"format":{"best_thirds_count":0}}'::jsonb);
  FOR gi IN 0..3 LOOP
    g := gen_random_uuid();
    INSERT INTO public.tq_groups (id, competition_id, name, sort_order, qualified_count) VALUES (g, v, 'G'||gi, gi, 2);
    FOR ti IN 1..4 LOOP
      tid := gen_random_uuid();
      INSERT INTO public.tq_teams (id, competition_id, name) VALUES (tid, v, 'T'||gi||ti);
      INSERT INTO public.tq_group_teams (group_id, team_id, seed_order, final_rank) VALUES (g, tid, ti, ti);
    END LOOP;
  END LOOP;
  res := public.tq_generate_bracket(v);
  SELECT count(*) INTO cnt FROM public.tq_matches WHERE competition_id = v AND knockout_round = 'QF';
  RAISE NOTICE 'tq_generate_bracket -> % ; QF matches = % (expected 4)', res, cnt;
  DELETE FROM public.tq_competitions WHERE id = v;
END $$;
