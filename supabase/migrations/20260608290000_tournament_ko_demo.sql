-- ============================================================================
-- TOURNAMENT QUEST — a demo in KNOCKOUT stage to test the living bracket.
-- 8 groups resolved -> R16 auto-generated and OPEN (predict who advances).
-- ============================================================================
DO $$
DECLARE
  v_comp UUID := 'b0000000-0000-4000-8000-000000000003';
  v_grp UUID; gi INT; ti INT; tid UUID; res JSONB;
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
  VALUES (v_comp, 'Sportime Cup — KO Stage', 'sportime-cup-ko', 'running',
          now() - interval '10 days', now() + interval '10 days', 0,
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

  FOR gi IN 0..7 LOOP
    v_grp := gen_random_uuid();
    INSERT INTO public.tq_groups (id, competition_id, name, sort_order, qualified_count)
    VALUES (v_grp, v_comp, 'Group ' || chr(65 + gi), gi, 2);
    FOR ti IN 1..4 LOOP
      tid := gen_random_uuid();
      INSERT INTO public.tq_teams (id, competition_id, name, short_name)
      VALUES (tid, v_comp, names[gi*4 + ti], short3[gi*4 + ti]);
      -- final_rank = seed (resolved standings)
      INSERT INTO public.tq_group_teams (group_id, team_id, seed_order, final_rank) VALUES (v_grp, tid, ti, ti);
    END LOOP;
  END LOOP;

  INSERT INTO public.tq_phase_windows (competition_id, phase_key, state) VALUES
    (v_comp,'long_term','resolved'),(v_comp,'group','resolved');

  -- Generate the R16 bracket from standings (also opens the R16 window)
  res := public.tq_generate_bracket(v_comp);
  RAISE NOTICE 'KO demo bracket: %', res;
END $$;
