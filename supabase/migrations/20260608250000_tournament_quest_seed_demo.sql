-- ============================================================================
-- TOURNAMENT QUEST — demo competition + self-test of the scoring engine.
-- 4 groups x 4 teams -> 8 qualifiers -> QF/SF/F (auto-detected). One entry with
-- predictions hitting every scoring path; expected total = 525 pts.
-- ============================================================================
DO $$
DECLARE
  v_comp UUID := 'b0000000-0000-4000-8000-000000000001';
  v_user UUID := '61da0a31-875b-4383-b951-c429c5f9def0';
  v_entry UUID;
  v_team UUID[];                 -- T1..T16
  v_grp UUID[] := ARRAY[]::UUID[]; -- groups A..D
  gi INT; ti INT; gid UUID; tid UUID;
  v_qf1 UUID; v_qf2 UUID; v_qf3 UUID; v_qf4 UUID;
  v_daily UUID;
BEGIN
  -- Clean re-run
  DELETE FROM public.tq_competitions WHERE id = v_comp;

  INSERT INTO public.tq_competitions (id, name, slug, status, start_date, end_date, entry_cost, config_json)
  VALUES (v_comp, 'Sportime Cup (Demo)', 'sportime-cup-demo', 'resolved',
          now() - interval '20 days', now() - interval '1 day', 0,
          jsonb_build_object(
            'format', jsonb_build_object('best_thirds_count', 0, 'third_place_match', false),
            'scoring', jsonb_build_object(
              'long_term', jsonb_build_object('champion_exact',150,'champion_finalist',75,'champion_semi',30,
                 'finalist_exact',100,'finalist_semi',40,'top_scorer_exact',100,'top_scorer_top3',40,'top_scorer_top10',15),
              'group', jsonb_build_object('qualified',5,'exact_position',5),
              'daily', jsonb_build_object('result',10,'goal_diff',15,'first_scorer',8,'exact_score',12,'first_scorer_question_independent',false),
              'bracket', jsonb_build_object('R32',10,'R16',15,'QF',30,'SF',60,'F',120)
            )
          ));

  -- 16 teams
  v_team := ARRAY[]::UUID[];
  FOR ti IN 1..16 LOOP
    tid := gen_random_uuid();
    INSERT INTO public.tq_teams (id, competition_id, name, short_name)
    VALUES (tid, v_comp, 'Team ' || ti, 'T' || ti);
    v_team := array_append(v_team, tid);
  END LOOP;

  -- 4 groups of 4, qualified_count = 2; final_rank = position within the group
  FOR gi IN 0..3 LOOP
    gid := gen_random_uuid();
    INSERT INTO public.tq_groups (id, competition_id, name, sort_order, qualified_count)
    VALUES (gid, v_comp, 'Group ' || chr(65 + gi), gi, 2);
    v_grp := array_append(v_grp, gid);
    FOR ti IN 1..4 LOOP
      INSERT INTO public.tq_group_teams (group_id, team_id, seed_order, final_rank)
      VALUES (gid, v_team[gi*4 + ti], ti, ti);  -- final_rank 1..4
    END LOOP;
  END LOOP;

  -- Phase windows
  INSERT INTO public.tq_phase_windows (competition_id, phase_key, state) VALUES
    (v_comp,'long_term','resolved'),(v_comp,'group','resolved'),
    (v_comp,'QF','resolved'),(v_comp,'SF','resolved'),(v_comp,'F','resolved');

  -- Qualifiers: A1,A2,B1,B2,C1,C2,D1,D2 = T1,T2,T5,T6,T9,T10,T13,T14
  -- QF matches (winners T1,T9,T5,T13)
  v_qf1 := gen_random_uuid(); v_qf2 := gen_random_uuid(); v_qf3 := gen_random_uuid(); v_qf4 := gen_random_uuid();
  INSERT INTO public.tq_matches (id, competition_id, knockout_round, bracket_slot, team_a_id, team_b_id, status, score_a, score_b, winner_team_id) VALUES
    (v_qf1, v_comp, 'QF', 0, v_team[1],  v_team[6],  'finished', 2, 1, v_team[1]),
    (v_qf2, v_comp, 'QF', 1, v_team[9],  v_team[14], 'finished', 1, 0, v_team[9]),
    (v_qf3, v_comp, 'QF', 2, v_team[5],  v_team[2],  'finished', 3, 2, v_team[5]),
    (v_qf4, v_comp, 'QF', 3, v_team[13], v_team[10], 'finished', 2, 0, v_team[13]);
  -- SF (winners T1, T9)
  INSERT INTO public.tq_matches (competition_id, knockout_round, bracket_slot, team_a_id, team_b_id, status, score_a, score_b, winner_team_id) VALUES
    (v_comp, 'SF', 0, v_team[1], v_team[5],  'finished', 2, 1, v_team[1]),
    (v_comp, 'SF', 1, v_team[9], v_team[13], 'finished', 1, 0, v_team[9]);
  -- Final (champion T1, finalist T9)
  INSERT INTO public.tq_matches (competition_id, knockout_round, bracket_slot, team_a_id, team_b_id, status, score_a, score_b, winner_team_id) VALUES
    (v_comp, 'F', 0, v_team[1], v_team[9], 'finished', 2, 0, v_team[1]);
  -- One official daily match (group A, T1 vs T2, 2-0, first scorer T1)
  v_daily := gen_random_uuid();
  INSERT INTO public.tq_matches (id, competition_id, group_id, team_a_id, team_b_id, status, score_a, score_b, first_scorer_team_id, is_official_quest_match, quest_slot_key)
  VALUES (v_daily, v_comp, v_grp[1], v_team[1], v_team[2], 'finished', 2, 0, v_team[1], true, 'demo-day-1');

  -- ── Entry + predictions (expected: 250 + 20 + 210 + 45 = 525) ──────────────
  INSERT INTO public.tq_entries (user_id, competition_id, last_prediction_at)
  VALUES (v_user, v_comp, now() - interval '21 days')
  RETURNING id INTO v_entry;

  -- long-term: champion T1 (exact 150), finalist T9 (exact 100), goals pred 20
  INSERT INTO public.tq_long_term_predictions (entry_id, champion_team_id, finalist_team_id, total_goals_prediction)
  VALUES (v_entry, v_team[1], v_team[9], 20);

  -- group A: T1 pos1, T2 pos2 (both qualified + exact = 20)
  INSERT INTO public.tq_group_predictions (entry_id, group_id, predicted_team_id, predicted_position) VALUES
    (v_entry, v_grp[1], v_team[1], 1),
    (v_entry, v_grp[1], v_team[2], 2);

  -- bracket: T1 reaches QF(30), SF(60), F(120) = 210
  INSERT INTO public.tq_bracket_predictions (entry_id, round_key, predicted_winner_team_id) VALUES
    (v_entry, 'QF', v_team[1]),
    (v_entry, 'SF', v_team[1]),
    (v_entry, 'F',  v_team[1]);

  -- daily: result A, bucket 2plus, first scorer T1, exact 2-0 = 45
  INSERT INTO public.tq_daily_predictions (entry_id, match_id, predicted_result, predicted_goal_diff_bucket, predicted_first_scorer_team_id, predicted_score_a, predicted_score_b)
  VALUES (v_entry, v_daily, 'A', '2plus', v_team[1], 2, 0);

  -- Resolve the whole competition (scores every entry + rebuilds the leaderboard)
  PERFORM public.tq_resolve(v_comp);

  RAISE NOTICE 'TQ demo resolved. Format = %', public.tq_detect_format(v_comp);
END $$;
