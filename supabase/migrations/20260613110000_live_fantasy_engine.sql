-- Live Fantasy (Phase B): scoring function + gameplay RPCs (read, save team, transfer).

-- Points for one player at a slot position, from live player_match_stats + fixture goals.
CREATE OR REPLACE FUNCTION public.lf_player_points(p_game_id UUID, p_player_id UUID, p_pos TEXT)
RETURNS NUMERIC LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fix RECORD; v_gp RECORD; st RECORD; sc JSONB; s JSONB; opp INT; pts NUMERIC := 0; mins INT;
BEGIN
  SELECT scoring INTO sc FROM public.lf_config WHERE id=1;
  s := sc->p_pos; IF s IS NULL THEN RETURN 0; END IF;
  SELECT f.* INTO v_fix FROM public.lf_games g JOIN public.fb_fixtures f ON f.id=g.fixture_id WHERE g.id=p_game_id;
  SELECT side INTO v_gp FROM public.lf_game_players WHERE game_id=p_game_id AND player_id=p_player_id;
  SELECT * INTO st FROM public.player_match_stats WHERE fixture_id=v_fix.id AND player_id=p_player_id;
  IF st IS NULL THEN RETURN 0; END IF;
  opp := CASE WHEN v_gp.side='home' THEN COALESCE(v_fix.goals_away,0) ELSE COALESCE(v_fix.goals_home,0) END;
  mins := COALESCE(st.minutes_played,0);

  pts := pts + COALESCE(st.goals,0)   * COALESCE((s->>'goal')::numeric,0);
  pts := pts + COALESCE(st.assists,0) * COALESCE((s->>'assist')::numeric,0);
  IF p_pos IN ('D','M','A') THEN pts := pts + COALESCE(st.shots_on_target,0) * COALESCE((s->>'shot_on_target')::numeric,0); END IF;
  IF p_pos = 'D' THEN
    pts := pts + COALESCE(st.tackles_total,0) * COALESCE((s->>'tackle')::numeric,0);
    pts := pts + COALESCE(st.tackles_interceptions,0) * COALESCE((s->>'interception')::numeric,0);
    IF opp >= 2 THEN pts := pts + (opp-1) * COALESCE((s->>'conceded_per_from_2')::numeric,0); END IF;
  END IF;
  IF p_pos IN ('M','A') THEN pts := pts + COALESCE(st.fouls_drawn,0) * COALESCE((s->>'foul_drawn')::numeric,0); END IF;
  IF p_pos = 'GK' THEN
    pts := pts + COALESCE(st.saves,0) * COALESCE((s->>'save')::numeric,0);
    IF COALESCE(st.saves,0) >= 3 THEN pts := pts + COALESCE((s->>'save_bonus_3plus')::numeric,0); END IF;
    pts := pts + opp * COALESCE((s->>'conceded')::numeric,0);
  END IF;
  IF p_pos IN ('GK','D') AND opp = 0 AND mins >= 60 THEN pts := pts + COALESCE((s->>'clean_sheet')::numeric,0); END IF;
  IF st.yellow_card THEN pts := pts + COALESCE((s->>'yellow')::numeric,0); END IF;
  IF st.red_card THEN pts := pts + COALESCE((s->>'red')::numeric,0); END IF;
  RETURN pts;
END $$;

-- Read everything for the UI.
CREATE OR REPLACE FUNCTION public.lf_get_game(p_fixture_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_game public.lf_games; v_cfg public.lf_config; v_team public.lf_teams;
BEGIN
  SELECT * INTO v_cfg FROM public.lf_config WHERE id=1;
  SELECT * INTO v_game FROM public.lf_games WHERE fixture_id=p_fixture_id;
  IF v_game.id IS NULL THEN RETURN jsonb_build_object('ok', true, 'game', NULL); END IF;
  SELECT * INTO v_team FROM public.lf_teams WHERE game_id=v_game.id AND user_id=v_user;
  RETURN jsonb_build_object('ok', true,
    'config', jsonb_build_object('captain_multiplier', v_cfg.captain_multiplier, 'max_transfers', v_cfg.max_transfers, 'outfield_per_team', v_cfg.outfield_per_team),
    'game', jsonb_build_object('id', v_game.id, 'status', v_game.status, 'lock_at', v_game.lock_at, 'gk_underdog', v_game.gk_underdog),
    'pool', (SELECT COALESCE(jsonb_agg(jsonb_build_object('player_id', player_id, 'name', name, 'photo', photo, 'pos', position, 'side', side, 'shirt', shirt_no, 'available', available, 'on_pitch', on_pitch) ORDER BY side, CASE position WHEN 'GK' THEN 0 WHEN 'D' THEN 1 WHEN 'M' THEN 2 ELSE 3 END), '[]'::jsonb)
             FROM public.lf_game_players WHERE game_id=v_game.id),
    'my_team', CASE WHEN v_team.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', v_team.id, 'captain', v_team.captain_player_id, 'transfers_used', v_team.transfers_used, 'score', v_team.score, 'rank', v_team.rank,
        'players', (SELECT jsonb_agg(jsonb_build_object('player_id', player_id, 'pos', position, 'side', side, 'is_captain', is_captain)) FROM public.lf_team_players WHERE team_id=v_team.id AND active)
      ) END,
    'leaderboard', (SELECT COALESCE(jsonb_agg(jsonb_build_object('rank', rank, 'score', score, 'is_me', user_id=v_user) ORDER BY score DESC), '[]'::jsonb)
                    FROM (SELECT * FROM public.lf_teams WHERE game_id=v_game.id ORDER BY score DESC LIMIT 50) z),
    'total_players', (SELECT count(*) FROM public.lf_teams WHERE game_id=v_game.id)
  );
END $$;
GRANT EXECUTE ON FUNCTION public.lf_get_game(UUID) TO authenticated;

-- Save / create the team: 1 GK (any side) + 6 outfield (2 D, 2 M, 2 A) with 3 per side. captain in the 7.
CREATE OR REPLACE FUNCTION public.lf_save_team(p_game_id UUID, p_gk UUID, p_outfield UUID[], p_captain UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_game public.lf_games; v_cfg public.lf_config; v_team_id UUID;
  v_nd INT; v_nm INT; v_na INT; v_home INT; v_away INT; v_all UUID[]; pid UUID; v_pos TEXT; v_side TEXT;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT * INTO v_cfg FROM public.lf_config WHERE id=1;
  SELECT * INTO v_game FROM public.lf_games WHERE id=p_game_id;
  IF v_game.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_game'); END IF;
  IF v_game.status NOT IN ('upcoming','open') THEN RETURN jsonb_build_object('ok', false, 'error', 'locked'); END IF;
  IF array_length(p_outfield,1) <> 6 THEN RETURN jsonb_build_object('ok', false, 'error', 'need_6_outfield'); END IF;
  -- GK valid
  PERFORM 1 FROM public.lf_game_players WHERE game_id=p_game_id AND player_id=p_gk AND position='GK';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'bad_gk'); END IF;
  -- outfield counts by position + side
  SELECT count(*) FILTER (WHERE position='D'), count(*) FILTER (WHERE position='M'), count(*) FILTER (WHERE position='A'),
         count(*) FILTER (WHERE side='home'), count(*) FILTER (WHERE side='away')
    INTO v_nd, v_nm, v_na, v_home, v_away
  FROM public.lf_game_players WHERE game_id=p_game_id AND player_id = ANY(p_outfield) AND position IN ('D','M','A');
  IF (v_nd + v_nm + v_na) <> 6 THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_outfield'); END IF;
  IF v_nd <> 2 OR v_nm <> 2 OR v_na <> 2 THEN RETURN jsonb_build_object('ok', false, 'error', 'need_2_2_2'); END IF;
  IF v_home <> v_cfg.outfield_per_team OR v_away <> v_cfg.outfield_per_team THEN RETURN jsonb_build_object('ok', false, 'error', 'need_3_each_side'); END IF;
  v_all := p_outfield || p_gk;
  IF NOT (p_captain = ANY(v_all)) THEN RETURN jsonb_build_object('ok', false, 'error', 'bad_captain'); END IF;

  INSERT INTO public.lf_teams (game_id, user_id, captain_player_id) VALUES (p_game_id, v_user, p_captain)
  ON CONFLICT (game_id, user_id) DO UPDATE SET captain_player_id=p_captain RETURNING id INTO v_team_id;
  DELETE FROM public.lf_team_players WHERE team_id=v_team_id;
  FOREACH pid IN ARRAY v_all LOOP
    SELECT position, side INTO v_pos, v_side FROM public.lf_game_players WHERE game_id=p_game_id AND player_id=pid;
    INSERT INTO public.lf_team_players (team_id, player_id, position, side, is_captain) VALUES (v_team_id, pid, v_pos, v_side, pid=p_captain);
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'team_id', v_team_id);
END $$;
GRANT EXECUTE ON FUNCTION public.lf_save_team(UUID, UUID, UUID[], UUID) TO authenticated;

-- Transfer: swap out_player for in_player (same real team, same position, in_player available). Keeps composition.
CREATE OR REPLACE FUNCTION public.lf_transfer(p_game_id UUID, p_out UUID, p_in UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_cfg public.lf_config; v_team public.lf_teams; v_out RECORD; v_in RECORD; v_was_cap BOOLEAN;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT * INTO v_cfg FROM public.lf_config WHERE id=1;
  SELECT * INTO v_team FROM public.lf_teams WHERE game_id=p_game_id AND user_id=v_user;
  IF v_team.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_team'); END IF;
  IF v_team.transfers_used >= v_cfg.max_transfers THEN RETURN jsonb_build_object('ok', false, 'error', 'no_transfers_left'); END IF;
  SELECT * INTO v_out FROM public.lf_team_players WHERE team_id=v_team.id AND player_id=p_out AND active;
  IF v_out.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_in_team'); END IF;
  SELECT position, side, available INTO v_in FROM public.lf_game_players WHERE game_id=p_game_id AND player_id=p_in;
  IF v_in.position IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_in_pool'); END IF;
  IF NOT v_in.available THEN RETURN jsonb_build_object('ok', false, 'error', 'player_unavailable'); END IF;
  IF v_in.position <> v_out.position OR v_in.side <> v_out.side THEN RETURN jsonb_build_object('ok', false, 'error', 'must_match_pos_side'); END IF;
  IF EXISTS (SELECT 1 FROM public.lf_team_players WHERE team_id=v_team.id AND player_id=p_in AND active) THEN RETURN jsonb_build_object('ok', false, 'error', 'already_in_team'); END IF;
  v_was_cap := v_out.is_captain;
  UPDATE public.lf_team_players SET active=false WHERE id=v_out.id;
  INSERT INTO public.lf_team_players (team_id, player_id, position, side, is_captain) VALUES (v_team.id, p_in, v_in.position, v_in.side, v_was_cap);
  UPDATE public.lf_teams SET transfers_used = transfers_used + 1, captain_player_id = CASE WHEN v_was_cap THEN p_in ELSE captain_player_id END WHERE id=v_team.id;
  RETURN jsonb_build_object('ok', true, 'transfers_left', v_cfg.max_transfers - v_team.transfers_used - 1);
END $$;
GRANT EXECUTE ON FUNCTION public.lf_transfer(UUID, UUID, UUID) TO authenticated;
