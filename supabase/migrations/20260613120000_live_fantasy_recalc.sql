-- Live Fantasy (Phase B.2): live leaderboard recalc + lock (GK underdog bonus).

-- Recompute every team's score + ranks (captain ×mult, GK underdog ×mult).
CREATE OR REPLACE FUNCTION public.lf_recalc(p_game_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cfg public.lf_config; t RECORD; tp RECORD; v_score NUMERIC; v_mult NUMERIC; v_gk JSONB;
BEGIN
  SELECT * INTO v_cfg FROM public.lf_config WHERE id=1;
  SELECT gk_underdog INTO v_gk FROM public.lf_games WHERE id=p_game_id;
  FOR t IN SELECT * FROM public.lf_teams WHERE game_id=p_game_id LOOP
    v_score := 0;
    FOR tp IN SELECT * FROM public.lf_team_players WHERE team_id=t.id AND active LOOP
      v_mult := 1;
      IF tp.is_captain THEN v_mult := v_mult * v_cfg.captain_multiplier; END IF;
      IF tp.position='GK' AND v_gk ? tp.player_id::text THEN v_mult := v_mult * (v_gk->>tp.player_id::text)::numeric; END IF;
      v_score := v_score + public.lf_player_points(p_game_id, tp.player_id, tp.position) * v_mult;
    END LOOP;
    UPDATE public.lf_teams SET score = v_score WHERE id=t.id;
  END LOOP;
  -- ranks
  WITH r AS (SELECT id, rank() OVER (ORDER BY score DESC) rk FROM public.lf_teams WHERE game_id=p_game_id)
  UPDATE public.lf_teams t SET rank = r.rk FROM r WHERE t.id=r.id;
  RETURN jsonb_build_object('ok', true, 'teams', (SELECT count(*) FROM public.lf_teams WHERE game_id=p_game_id));
END $$;
GRANT EXECUTE ON FUNCTION public.lf_recalc(UUID) TO authenticated, anon;

-- Lock at kickoff: compute GK pick distribution -> underdog multiplier per the admin tiers.
CREATE OR REPLACE FUNCTION public.lf_lock(p_game_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total INT; gk RECORD; v_pct NUMERIC; v_min_pct NUMERIC; v_tiers JSONB; v_map JSONB := '{}'::jsonb; tier JSONB; v_mult NUMERIC;
BEGIN
  SELECT gk_underdog_tiers INTO v_tiers FROM public.lf_config WHERE id=1;
  SELECT count(*) INTO v_total FROM public.lf_teams WHERE game_id=p_game_id;
  IF v_total = 0 THEN UPDATE public.lf_games SET status='locked' WHERE id=p_game_id; RETURN jsonb_build_object('ok', true, 'note', 'no_teams'); END IF;
  -- min pick% among picked GKs = the underdog
  SELECT min(pct) INTO v_min_pct FROM (
    SELECT 100.0 * count(*) / v_total pct FROM public.lf_team_players WHERE team_id IN (SELECT id FROM public.lf_teams WHERE game_id=p_game_id) AND position='GK' AND active GROUP BY player_id
  ) z;
  FOR gk IN SELECT player_id, 100.0 * count(*) / v_total AS pct FROM public.lf_team_players
            WHERE team_id IN (SELECT id FROM public.lf_teams WHERE game_id=p_game_id) AND position='GK' AND active GROUP BY player_id LOOP
    v_mult := 1.0;
    IF gk.pct = v_min_pct AND gk.pct < 50 THEN   -- the underdog (and not a majority/tie at >=50)
      FOR tier IN SELECT * FROM jsonb_array_elements(v_tiers) ORDER BY (value->>'max_pct')::numeric LOOP
        IF gk.pct <= (tier->>'max_pct')::numeric THEN v_mult := (tier->>'mult')::numeric; EXIT; END IF;
      END LOOP;
    END IF;
    v_map := v_map || jsonb_build_object(gk.player_id::text, v_mult);
  END LOOP;
  UPDATE public.lf_games SET status='locked', gk_underdog=v_map WHERE id=p_game_id;
  UPDATE public.lf_teams SET locked=true WHERE game_id=p_game_id;
  RETURN jsonb_build_object('ok', true, 'gk_underdog', v_map);
END $$;
GRANT EXECUTE ON FUNCTION public.lf_lock(UUID) TO authenticated;
