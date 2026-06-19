-- Switch Guess the Player to the proprietary Transfermarkt warehouse: complete trails
-- (cross-league) + market-value notoriety. Reads now hit tm_players / tm_transfers.

-- Clean, de-duplicated club trail for a player (youth/reserve/"Without Club" filtered).
CREATE OR REPLACE FUNCTION public.tm_player_trail(p_player_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE seqarr TEXT[]; out TEXT[] := '{}'; cl TEXT; prev TEXT := '';
BEGIN
  SELECT array_agg(club ORDER BY ord) INTO seqarr FROM (
    (SELECT from_club_name AS club, 0::numeric AS ord FROM public.tm_transfers WHERE player_id=p_player_id ORDER BY seq LIMIT 1)
    UNION ALL
    (SELECT to_club_name, row_number() OVER (ORDER BY seq) FROM public.tm_transfers WHERE player_id=p_player_id)
  ) z;
  IF seqarr IS NULL THEN RETURN '[]'::jsonb; END IF;
  FOREACH cl IN ARRAY seqarr LOOP
    CONTINUE WHEN cl IS NULL OR cl = '';
    CONTINUE WHEN cl ~* '(U1[5-9]|U2[0-3]|youth|yth|giov|jugend|reserve|castilla|without club| B$| II$| C$)';
    IF cl <> prev THEN out := array_append(out, cl); prev := cl; END IF;
  END LOOP;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('name', e)) FROM unnest(out) e), '[]'::jsonb);
END $$;

-- Autocomplete index now from tm_players (notoriety = market value). No photos yet.
CREATE OR REPLACE FUNCTION public.puzzle_player_index()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', player_id, 'n', name, 'p', photo_url,
           'r', COALESCE(current_market_value_eur, 0))), '[]'::jsonb)
  FROM public.tm_players WHERE name IS NOT NULL;
$$;

-- Generator: tm trails + market-value scope.
CREATE OR REPLACE FUNCTION public.puzzle_generate_player_tm(p_scope TEXT, p_count INTEGER, p_start_date DATE)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cfg public.puzzle_config; v_floor BIGINT; v_need INT; v_seq INT; v_games INT := 0; v_gid UUID; v_rn INT := 0; rec RECORD; v_trail JSONB; v_era TEXT;
BEGIN
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  v_floor := CASE p_scope WHEN 'big' THEN 15000000 ELSE 0 END;   -- big = ≥ €15M current value
  v_need := p_count * v_cfg.rounds_per_game;
  SELECT COALESCE(max(seq), 0) INTO v_seq FROM public.puzzle_games WHERE level=p_scope AND game_type='guess_player';

  FOR rec IN
    SELECT p.player_id, p.name, p.position, p.nationality
    FROM public.tm_players p
    WHERE p.name IS NOT NULL AND COALESCE(p.current_market_value_eur,0) >= v_floor
      AND p.player_id NOT IN (SELECT answer_player_id FROM public.puzzle_rounds WHERE answer_player_id IS NOT NULL)
      AND (SELECT count(*) FROM public.tm_transfers t WHERE t.player_id=p.player_id) >= 3
    ORDER BY random() LIMIT v_need * 3            -- oversample; many get filtered by trail length
  LOOP
    v_trail := public.tm_player_trail(rec.player_id);
    CONTINUE WHEN jsonb_array_length(v_trail) < 3;       -- need a real trail
    SELECT (min(date_part('year', transfer_date))::int)::text || '–' || (max(date_part('year', transfer_date))::int)::text
      INTO v_era FROM public.tm_transfers WHERE player_id=rec.player_id AND transfer_date IS NOT NULL;

    IF v_rn = 0 THEN
      v_seq := v_seq + 1; v_games := v_games + 1;
      INSERT INTO public.puzzle_games (game_type, level, puzzle_date, seq, status)
      VALUES ('guess_player', p_scope, p_start_date + (v_games - 1), v_seq, 'scheduled') RETURNING id INTO v_gid;
    END IF;
    v_rn := v_rn + 1;
    INSERT INTO public.puzzle_rounds (game_id, round_no, answer_player_id, payload)
    VALUES (v_gid, v_rn, rec.player_id, jsonb_build_object(
      'trail', v_trail,
      'hints', jsonb_build_array(
        jsonb_build_object('k','Position','v', COALESCE(rec.position,'—')),
        jsonb_build_object('k','Nationality','v', COALESCE(rec.nationality,'—')),
        jsonb_build_object('k','Era','v', COALESCE(v_era,'—')))));
    IF v_rn = v_cfg.rounds_per_game THEN v_rn := 0; END IF;
    EXIT WHEN v_games >= p_count AND v_rn = 0;
  END LOOP;
  RETURN v_games;
END $$;
GRANT EXECUTE ON FUNCTION public.puzzle_generate_player_tm(TEXT, INTEGER, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tm_player_trail(BIGINT) TO authenticated, anon;
