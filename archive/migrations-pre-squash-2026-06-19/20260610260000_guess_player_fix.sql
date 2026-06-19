-- fb_players.id is UUID; the API id is fb_players.api_id. Join transfers/stats on api_id.
CREATE OR REPLACE FUNCTION public.puzzle_generate_guess_player(p_level TEXT, p_count INTEGER, p_start_date DATE)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cfg public.puzzle_config; v_floor NUMERIC; v_need INT; v_seq INT; v_games INT := 0; v_gid UUID; v_rn INT := 0; rec RECORD; v_trail JSONB; v_era TEXT;
BEGIN
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  v_floor := CASE p_level WHEN 'big' THEN v_cfg.pop_floor_big ELSE v_cfg.pop_floor_all END;
  v_need := p_count * v_cfg.rounds_per_game;
  SELECT COALESCE(max(seq), 0) INTO v_seq FROM public.puzzle_games WHERE level = p_level AND game_type = 'guess_player';

  CREATE TEMP TABLE _pcand ON COMMIT DROP AS
  SELECT p.api_id AS id, p.name, p.photo, p.nationality, pn.noto, pn.pos, pn.smin, pn.smax, pn.tcount
  FROM public.fb_players p
  JOIN (
    SELECT pss.player_id, max(COALESCE(tp.popularity,30)) noto,
           mode() WITHIN GROUP (ORDER BY pss.position) pos, min(pss.season) smin, max(pss.season) smax,
           (SELECT count(*) FROM public.fb_transfers t WHERE t.player_id = pss.player_id) tcount
    FROM public.fb_player_season_stats pss
    LEFT JOIN public.team_popularity tp ON tp.team_api_id = pss.team_api_id
    GROUP BY pss.player_id
  ) pn ON pn.player_id = p.api_id
  WHERE pn.noto >= v_floor AND pn.tcount >= 2
    AND p.api_id NOT IN (SELECT answer_player_id FROM public.puzzle_rounds WHERE answer_player_id IS NOT NULL);

  FOR rec IN SELECT * FROM _pcand ORDER BY random() LIMIT v_need * 2 LOOP
    v_trail := public.puzzle_player_trail(rec.id);
    IF jsonb_array_length(v_trail) < 3 THEN CONTINUE; END IF;
    IF v_rn = 0 THEN
      v_seq := v_seq + 1; v_games := v_games + 1;
      INSERT INTO public.puzzle_games (game_type, level, puzzle_date, seq, status)
      VALUES ('guess_player', p_level, p_start_date + (v_games - 1), v_seq, 'scheduled') RETURNING id INTO v_gid;
    END IF;
    v_rn := v_rn + 1;
    v_era := CASE WHEN rec.smin = rec.smax THEN rec.smin::text ELSE rec.smin::text || '–' || rec.smax::text END;
    INSERT INTO public.puzzle_rounds (game_id, round_no, answer_player_id, payload)
    VALUES (v_gid, v_rn, rec.id, jsonb_build_object(
      'trail', v_trail,
      'hints', jsonb_build_array(
        jsonb_build_object('k','Position','v', COALESCE(rec.pos,'—')),
        jsonb_build_object('k','Nationality','v', COALESCE(rec.nationality,'—')),
        jsonb_build_object('k','Era','v', v_era))
    ));
    IF v_rn = v_cfg.rounds_per_game THEN v_rn := 0;
      IF v_games >= p_count THEN EXIT; END IF;
    END IF;
  END LOOP;
  RETURN v_games;
END $$;
