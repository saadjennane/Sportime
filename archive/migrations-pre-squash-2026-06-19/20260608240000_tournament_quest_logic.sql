-- ============================================================================
-- TOURNAMENT QUEST — logic layer (auto-detection, scoring, bracket, leaderboard).
-- Everything reads weights/rules from tq_competitions.config_json -> no hardcoding.
-- ============================================================================

-- ── Helpers ──────────────────────────────────────────────────────────────────
-- Rounds available for a given number of knockout participants.
CREATE OR REPLACE FUNCTION public.tq_rounds_for(p_participants INTEGER)
RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_participants >= 32 THEN ARRAY['R32','R16','QF','SF','F']
    WHEN p_participants >= 16 THEN ARRAY['R16','QF','SF','F']
    WHEN p_participants >= 8  THEN ARRAY['QF','SF','F']
    WHEN p_participants >= 4  THEN ARRAY['SF','F']
    WHEN p_participants >= 2  THEN ARRAY['F']
    ELSE ARRAY[]::TEXT[]
  END;
$$;

-- Auto-detect the competition format from the actual group/team rows + config.
CREATE OR REPLACE FUNCTION public.tq_detect_format(p_competition_id UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH cfg AS (SELECT config_json FROM public.tq_competitions WHERE id = p_competition_id),
  g AS (
    SELECT count(*)::int AS groups_count,
           COALESCE(sum(qualified_count), 0)::int AS direct_qualifiers,
           COALESCE(max(qualified_count), 0)::int AS max_qualified
    FROM public.tq_groups WHERE competition_id = p_competition_id
  ),
  gt AS (
    SELECT COALESCE(count(*),0)::int AS teams_count
    FROM public.tq_group_teams gtx
    JOIN public.tq_groups gr ON gr.id = gtx.group_id
    WHERE gr.competition_id = p_competition_id
  ),
  best AS (
    SELECT COALESCE(((SELECT config_json FROM cfg)->'format'->>'best_thirds_count')::int, 0) AS best_thirds
  )
  SELECT jsonb_build_object(
    'groups_count', g.groups_count,
    'teams_count', gt.teams_count,
    'teams_per_group', CASE WHEN g.groups_count > 0 THEN round(gt.teams_count::numeric / g.groups_count, 1) ELSE 0 END,
    'direct_qualifiers', g.direct_qualifiers,
    'best_thirds', best.best_thirds,
    'knockout_participants', g.direct_qualifiers + best.best_thirds,
    'group_matches_per_group', CASE WHEN g.groups_count > 0
        THEN (gt.teams_count / NULLIF(g.groups_count,0)) * ((gt.teams_count / NULLIF(g.groups_count,0)) - 1) / 2 ELSE 0 END,
    'knockout_rounds', COALESCE(
        ((SELECT config_json FROM cfg)->'format'->'knockout_rounds'),
        to_jsonb(public.tq_rounds_for(g.direct_qualifiers + best.best_thirds))),
    'third_place_match', COALESCE(((SELECT config_json FROM cfg)->'format'->>'third_place_match')::boolean, false)
  )
  FROM g, gt, best;
$$;
GRANT EXECUTE ON FUNCTION public.tq_detect_format(UUID) TO anon, authenticated, service_role;

-- ── Scoring: groups ──────────────────────────────────────────────────────────
-- Per predicted qualifier: +qualified pts if the team actually qualified (final_rank
-- <= group.qualified_count), +exact pts if final_rank = predicted_position.
CREATE OR REPLACE FUNCTION public.tq_score_group(p_entry_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_comp UUID; v_cfg JSONB; v_qpts INT; v_epts INT; v_total INT := 0; r RECORD;
BEGIN
  SELECT competition_id INTO v_comp FROM public.tq_entries WHERE id = p_entry_id;
  SELECT config_json INTO v_cfg FROM public.tq_competitions WHERE id = v_comp;
  v_qpts := COALESCE((v_cfg->'scoring'->'group'->>'qualified')::int, 5);
  v_epts := COALESCE((v_cfg->'scoring'->'group'->>'exact_position')::int, 5);

  DELETE FROM public.tq_scoring_events WHERE entry_id = p_entry_id AND source_type = 'group';
  FOR r IN
    SELECT gp.id, gp.predicted_position, gt.final_rank, g.qualified_count
    FROM public.tq_group_predictions gp
    JOIN public.tq_groups g ON g.id = gp.group_id
    LEFT JOIN public.tq_group_teams gt ON gt.group_id = gp.group_id AND gt.team_id = gp.predicted_team_id
  LOOP
    DECLARE pts INT := 0;
    BEGIN
      IF r.final_rank IS NOT NULL THEN
        IF r.final_rank <= r.qualified_count THEN pts := pts + v_qpts; END IF;
        IF r.final_rank = r.predicted_position THEN pts := pts + v_epts; END IF;
      END IF;
      UPDATE public.tq_group_predictions SET points_awarded = pts WHERE id = r.id;
      IF pts > 0 THEN
        INSERT INTO public.tq_scoring_events(entry_id, source_type, source_id, points, reason)
        VALUES (p_entry_id, 'group', r.id, pts, 'group qualifier');
      END IF;
      v_total := v_total + pts;
    END;
  END LOOP;

  UPDATE public.tq_entries SET group_score = v_total WHERE id = p_entry_id;
  RETURN v_total;
END;
$$;

-- ── Scoring: daily match ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tq_score_daily(p_entry_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_comp UUID; v_cfg JSONB; v_total INT := 0; r RECORD;
  p_result INT; p_diff INT; p_first INT; p_exact INT; v_indep BOOLEAN;
BEGIN
  SELECT competition_id INTO v_comp FROM public.tq_entries WHERE id = p_entry_id;
  SELECT config_json INTO v_cfg FROM public.tq_competitions WHERE id = v_comp;
  p_result := COALESCE((v_cfg->'scoring'->'daily'->>'result')::int, 10);
  p_diff   := COALESCE((v_cfg->'scoring'->'daily'->>'goal_diff')::int, 15);
  p_first  := COALESCE((v_cfg->'scoring'->'daily'->>'first_scorer')::int, 8);
  p_exact  := COALESCE((v_cfg->'scoring'->'daily'->>'exact_score')::int, 12);
  v_indep  := COALESCE((v_cfg->'scoring'->'daily'->>'first_scorer_question_independent')::boolean, false);

  DELETE FROM public.tq_scoring_events WHERE entry_id = p_entry_id AND source_type = 'daily';
  FOR r IN
    SELECT dp.id, dp.predicted_result, dp.predicted_goal_diff_bucket, dp.predicted_first_scorer_team_id,
           dp.predicted_score_a, dp.predicted_score_b,
           m.score_a, m.score_b, m.first_scorer_team_id, m.team_a_id, m.status
    FROM public.tq_daily_predictions dp
    JOIN public.tq_matches m ON m.id = dp.match_id
    WHERE m.status = 'finished'
  LOOP
    DECLARE
      pts INT := 0; actual_result TEXT; actual_bucket TEXT; result_ok BOOLEAN := false; ad INT;
    BEGIN
      actual_result := CASE WHEN r.score_a > r.score_b THEN 'A' WHEN r.score_a < r.score_b THEN 'B' ELSE 'draw' END;
      ad := abs(COALESCE(r.score_a,0) - COALESCE(r.score_b,0));
      actual_bucket := CASE WHEN ad = 0 THEN 'draw' WHEN ad = 1 THEN '1' ELSE '2plus' END;

      IF r.predicted_result = actual_result THEN
        pts := pts + p_result; result_ok := true;
        -- goal diff only counts when the result is correct
        IF r.predicted_goal_diff_bucket = actual_bucket THEN pts := pts + p_diff; END IF;
      END IF;
      -- first scorer: independent of result if configured
      IF (result_ok OR v_indep) AND r.predicted_first_scorer_team_id IS NOT NULL
         AND r.predicted_first_scorer_team_id = r.first_scorer_team_id THEN
        pts := pts + p_first;
      END IF;
      -- exact score bonus
      IF r.predicted_score_a IS NOT NULL AND r.predicted_score_a = r.score_a
         AND r.predicted_score_b = r.score_b THEN
        pts := pts + p_exact;
      END IF;

      UPDATE public.tq_daily_predictions SET points_awarded = pts WHERE id = r.id;
      IF pts > 0 THEN
        INSERT INTO public.tq_scoring_events(entry_id, source_type, source_id, points, reason)
        VALUES (p_entry_id, 'daily', r.id, pts, 'daily match');
      END IF;
      v_total := v_total + pts;
    END;
  END LOOP;

  UPDATE public.tq_entries
    SET daily_score = v_total,
        exact_score_predictions_count = (
          SELECT count(*) FROM public.tq_daily_predictions dp JOIN public.tq_matches m ON m.id = dp.match_id
          WHERE dp.entry_id = p_entry_id AND m.status = 'finished'
            AND dp.predicted_score_a = m.score_a AND dp.predicted_score_b = m.score_b)
  WHERE id = p_entry_id;
  RETURN v_total;
END;
$$;

-- ── Scoring: bracket ─────────────────────────────────────────────────────────
-- A predicted team "reaches" round_key if it appears in a match of that round.
CREATE OR REPLACE FUNCTION public.tq_score_bracket(p_entry_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_comp UUID; v_cfg JSONB; v_total INT := 0; v_correct INT := 0; r RECORD;
BEGIN
  SELECT competition_id INTO v_comp FROM public.tq_entries WHERE id = p_entry_id;
  SELECT config_json INTO v_cfg FROM public.tq_competitions WHERE id = v_comp;

  DELETE FROM public.tq_scoring_events WHERE entry_id = p_entry_id AND source_type = 'bracket';
  FOR r IN
    SELECT bp.id, bp.round_key, bp.predicted_winner_team_id
    FROM public.tq_bracket_predictions bp WHERE bp.entry_id = p_entry_id
  LOOP
    DECLARE
      reached BOOLEAN; w INT;
    BEGIN
      w := COALESCE((v_cfg->'scoring'->'bracket'->>r.round_key)::int, 0);
      reached := EXISTS (
        SELECT 1 FROM public.tq_matches m
        WHERE m.competition_id = v_comp AND m.knockout_round = r.round_key
          AND (m.team_a_id = r.predicted_winner_team_id OR m.team_b_id = r.predicted_winner_team_id)
      );
      DECLARE pts INT := CASE WHEN reached THEN w ELSE 0 END;
      BEGIN
        UPDATE public.tq_bracket_predictions SET points_awarded = pts WHERE id = r.id;
        IF pts > 0 THEN
          v_correct := v_correct + 1;
          INSERT INTO public.tq_scoring_events(entry_id, source_type, source_id, points, reason)
          VALUES (p_entry_id, 'bracket', r.id, pts, 'reached ' || r.round_key);
        END IF;
        v_total := v_total + pts;
      END;
    END;
  END LOOP;

  UPDATE public.tq_entries SET bracket_score = v_total, correct_bracket_predictions_count = v_correct
  WHERE id = p_entry_id;
  RETURN v_total;
END;
$$;

-- ── Scoring: long-term ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tq_score_long_term(p_entry_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_comp UUID; v_cfg JSONB; v_total INT := 0; lt RECORD;
  v_champion UUID; v_finalists UUID[]; v_semis UUID[]; v_actual_goals INT; v_top JSONB;
BEGIN
  SELECT competition_id INTO v_comp FROM public.tq_entries WHERE id = p_entry_id;
  SELECT config_json INTO v_cfg FROM public.tq_competitions WHERE id = v_comp;
  SELECT * INTO lt FROM public.tq_long_term_predictions WHERE entry_id = p_entry_id;
  IF lt IS NULL THEN RETURN 0; END IF;

  -- Actual champion / finalists from the Final; semifinalists = everyone in SF matches.
  SELECT winner_team_id,
         ARRAY[team_a_id, team_b_id]
    INTO v_champion, v_finalists
  FROM public.tq_matches WHERE competition_id = v_comp AND knockout_round = 'F' AND status = 'finished' LIMIT 1;

  SELECT array_agg(t) INTO v_semis FROM (
    SELECT unnest(ARRAY[team_a_id, team_b_id]) t FROM public.tq_matches
    WHERE competition_id = v_comp AND knockout_round = 'SF'
  ) s WHERE t IS NOT NULL;

  -- champion scoring
  IF lt.champion_team_id IS NOT NULL THEN
    IF lt.champion_team_id = v_champion THEN
      v_total := v_total + COALESCE((v_cfg->'scoring'->'long_term'->>'champion_exact')::int, 150);
    ELSIF lt.champion_team_id = ANY(v_finalists) THEN
      v_total := v_total + COALESCE((v_cfg->'scoring'->'long_term'->>'champion_finalist')::int, 75);
    ELSIF lt.champion_team_id = ANY(v_semis) THEN
      v_total := v_total + COALESCE((v_cfg->'scoring'->'long_term'->>'champion_semi')::int, 30);
    END IF;
  END IF;

  -- finalist scoring
  IF lt.finalist_team_id IS NOT NULL THEN
    IF lt.finalist_team_id = ANY(v_finalists) THEN
      v_total := v_total + COALESCE((v_cfg->'scoring'->'long_term'->>'finalist_exact')::int, 100);
    ELSIF lt.finalist_team_id = ANY(v_semis) THEN
      v_total := v_total + COALESCE((v_cfg->'scoring'->'long_term'->>'finalist_semi')::int, 40);
    END IF;
  END IF;

  -- top scorer: config.results.top_scorer = exact id, top3/top10 = arrays of player ids
  v_top := v_cfg->'results'->'top_scorer';
  IF lt.top_scorer_player_id IS NOT NULL AND v_top IS NOT NULL THEN
    IF (v_top->>'exact') IS NOT NULL AND lt.top_scorer_player_id = (v_top->>'exact')::bigint THEN
      v_total := v_total + COALESCE((v_cfg->'scoring'->'long_term'->>'top_scorer_exact')::int, 100);
    ELSIF v_top->'top3' ? lt.top_scorer_player_id::text THEN
      v_total := v_total + COALESCE((v_cfg->'scoring'->'long_term'->>'top_scorer_top3')::int, 40);
    ELSIF v_top->'top10' ? lt.top_scorer_player_id::text THEN
      v_total := v_total + COALESCE((v_cfg->'scoring'->'long_term'->>'top_scorer_top10')::int, 15);
    END IF;
  END IF;

  -- total goals tie-break delta
  SELECT COALESCE(sum(COALESCE(score_a,0) + COALESCE(score_b,0)), 0) INTO v_actual_goals
  FROM public.tq_matches WHERE competition_id = v_comp AND status = 'finished';

  DELETE FROM public.tq_scoring_events WHERE entry_id = p_entry_id AND source_type = 'long_term';
  IF v_total > 0 THEN
    INSERT INTO public.tq_scoring_events(entry_id, source_type, source_id, points, reason)
    VALUES (p_entry_id, 'long_term', lt.id, v_total, 'long-term picks');
  END IF;

  UPDATE public.tq_long_term_predictions SET points_awarded = v_total WHERE id = lt.id;
  UPDATE public.tq_entries
    SET long_term_score = v_total,
        total_goals_tiebreak_delta = CASE WHEN lt.total_goals_prediction IS NOT NULL
          THEN abs(lt.total_goals_prediction - v_actual_goals) ELSE NULL END
  WHERE id = p_entry_id;
  RETURN v_total;
END;
$$;

-- ── Leaderboard recompute (with the full tie-break chain) ────────────────────
CREATE OR REPLACE FUNCTION public.tq_recalc_leaderboard(p_competition_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INTEGER;
BEGIN
  -- roll each entry's total
  UPDATE public.tq_entries e
    SET total_score = COALESCE(long_term_score,0) + COALESCE(group_score,0)
                    + COALESCE(daily_score,0) + COALESCE(bracket_score,0),
        updated_at = now()
  WHERE competition_id = p_competition_id;

  DELETE FROM public.tq_leaderboard WHERE competition_id = p_competition_id;
  INSERT INTO public.tq_leaderboard (competition_id, entry_id, user_id, username, avatar, total_score, tiebreak_delta, rank)
  SELECT p_competition_id, e.id, e.user_id,
         u.username, u.profile_picture_url, e.total_score, e.total_goals_tiebreak_delta,
         RANK() OVER (ORDER BY
            e.total_score DESC,
            e.total_goals_tiebreak_delta ASC NULLS LAST,
            e.exact_score_predictions_count DESC,
            e.correct_bracket_predictions_count DESC,
            e.last_prediction_at ASC NULLS LAST)
  FROM public.tq_entries e
  LEFT JOIN public.users u ON u.id = e.user_id
  WHERE e.competition_id = p_competition_id;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
GRANT EXECUTE ON FUNCTION public.tq_recalc_leaderboard(UUID) TO service_role;

-- ── Master resolve: score every entry, then rebuild the leaderboard ──────────
CREATE OR REPLACE FUNCTION public.tq_resolve(p_competition_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e RECORD;
BEGIN
  FOR e IN SELECT id FROM public.tq_entries WHERE competition_id = p_competition_id LOOP
    PERFORM public.tq_score_group(e.id);
    PERFORM public.tq_score_daily(e.id);
    PERFORM public.tq_score_bracket(e.id);
    PERFORM public.tq_score_long_term(e.id);
  END LOOP;
  PERFORM public.tq_recalc_leaderboard(p_competition_id);
  RETURN jsonb_build_object('ok', true, 'format', public.tq_detect_format(p_competition_id));
END;
$$;
GRANT EXECUTE ON FUNCTION public.tq_resolve(UUID) TO service_role;

-- ── Join: create the user's entry (deduct entry cost if any) ─────────────────
CREATE OR REPLACE FUNCTION public.tq_join_competition(p_user_id UUID, p_competition_id UUID)
RETURNS public.tq_entries LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_entry public.tq_entries; v_cost INT; v_bal INT;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT id INTO v_entry FROM public.tq_entries WHERE user_id = p_user_id AND competition_id = p_competition_id;
  IF v_entry.id IS NOT NULL THEN RETURN v_entry; END IF; -- idempotent

  SELECT entry_cost INTO v_cost FROM public.tq_competitions WHERE id = p_competition_id;
  IF COALESCE(v_cost,0) > 0 THEN
    SELECT coins INTO v_bal FROM public.users WHERE id = p_user_id FOR UPDATE;
    IF COALESCE(v_bal,0) < v_cost THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
    UPDATE public.users SET coins = coins - v_cost WHERE id = p_user_id;
  END IF;

  INSERT INTO public.tq_entries (user_id, competition_id) VALUES (p_user_id, p_competition_id)
  RETURNING * INTO v_entry;
  RETURN v_entry;
END;
$$;
GRANT EXECUTE ON FUNCTION public.tq_join_competition(UUID, UUID) TO authenticated, service_role;
