-- ============================================================================
-- TOURNAMENT QUEST — an OPEN, playable demo: 8 groups x 4 -> 16 qualifiers -> R16.
-- Predictions open; one official daily match scheduled in the near future.
-- ============================================================================
DO $$
DECLARE
  v_comp UUID := 'b0000000-0000-4000-8000-000000000002';
  v_grp UUID; gi INT; ti INT; tid UUID;
  v_a1 UUID; v_a2 UUID;
  names TEXT[] := ARRAY[
    'Morocco','Spain','France','Brazil','Argentina','Portugal','England','Germany',
    'Netherlands','Italy','Croatia','Belgium','Uruguay','Senegal','Japan','USA',
    'Mexico','Colombia','Denmark','Switzerland','Nigeria','Cameroon','Ghana','Egypt',
    'Korea Rep','Serbia','Poland','Ecuador','Canada','Australia','Tunisia','Ivory Coast'];
  short3 TEXT[] := ARRAY[
    'MAR','ESP','FRA','BRA','ARG','POR','ENG','GER','NED','ITA','CRO','BEL','URU','SEN','JPN','USA',
    'MEX','COL','DEN','SUI','NGA','CMR','GHA','EGY','KOR','SRB','POL','ECU','CAN','AUS','TUN','CIV'];
BEGIN
  DELETE FROM public.tq_competitions WHERE id = v_comp;

  INSERT INTO public.tq_competitions (id, name, slug, status, start_date, end_date, entry_cost, config_json)
  VALUES (v_comp, 'Sportime Cup 2026', 'sportime-cup-2026', 'open',
          now() + interval '2 days', now() + interval '32 days', 0,
          jsonb_build_object(
            'format', jsonb_build_object('best_thirds_count', 0, 'third_place_match', true),
            'scoring', jsonb_build_object(
              'long_term', jsonb_build_object('champion_exact',150,'champion_finalist',75,'champion_semi',30,
                 'finalist_exact',100,'finalist_semi',40,'top_scorer_exact',100,'top_scorer_top3',40,'top_scorer_top10',15),
              'group', jsonb_build_object('qualified',5,'exact_position',5),
              'daily', jsonb_build_object('result',10,'goal_diff',15,'first_scorer',8,'exact_score',12,'first_scorer_question_independent',false),
              'bracket', jsonb_build_object('R32',10,'R16',15,'QF',30,'SF',60,'F',120)
            )
          ));

  -- 8 groups (A..H) of 4 teams
  FOR gi IN 0..7 LOOP
    v_grp := gen_random_uuid();
    INSERT INTO public.tq_groups (id, competition_id, name, sort_order, qualified_count)
    VALUES (v_grp, v_comp, 'Group ' || chr(65 + gi), gi, 2);
    FOR ti IN 1..4 LOOP
      tid := gen_random_uuid();
      INSERT INTO public.tq_teams (id, competition_id, name, short_name)
      VALUES (tid, v_comp, names[gi*4 + ti], short3[gi*4 + ti]);
      INSERT INTO public.tq_group_teams (group_id, team_id, seed_order) VALUES (v_grp, tid, ti);
      IF gi = 0 AND ti = 1 THEN v_a1 := tid; END IF;
      IF gi = 0 AND ti = 2 THEN v_a2 := tid; END IF;
    END LOOP;
  END LOOP;

  -- Phases open for long-term + group; bracket rounds locked until groups resolve
  INSERT INTO public.tq_phase_windows (competition_id, phase_key, state, locks_at) VALUES
    (v_comp,'long_term','open', now() + interval '2 days'),
    (v_comp,'group','open', now() + interval '2 days'),
    (v_comp,'R16','locked', NULL),(v_comp,'QF','locked', NULL),
    (v_comp,'SF','locked', NULL),(v_comp,'F','locked', NULL);

  -- One official daily match, scheduled ~4h from now (playable, not yet locked)
  INSERT INTO public.tq_matches (competition_id, team_a_id, team_b_id, start_time, status, is_official_quest_match, quest_slot_key)
  VALUES (v_comp, v_a1, v_a2, now() + interval '4 hours', 'scheduled', true, 'opening-day');
END $$;
