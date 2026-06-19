-- Live Fantasy: keep the selectable pool in sync with real substitutions during the match.
-- A sub who comes on becomes selectable; a player subbed off becomes permanently unavailable.
CREATE OR REPLACE FUNCTION public.lf_sync_pool(p_game_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fix RECORD; st RECORD; v_side TEXT; v_pos TEXT;
BEGIN
  SELECT f.id AS fid, f.home_team_id, f.away_team_id INTO v_fix
  FROM public.lf_games g JOIN public.fb_fixtures f ON f.id=g.fixture_id WHERE g.id=p_game_id;
  IF v_fix.fid IS NULL THEN RETURN; END IF;
  FOR st IN
    SELECT pms.player_id, pms.api_id, pms.team_id, pms.position, pms.minutes_played, pms.substitute_out, pl.name, pl.photo
    FROM public.player_match_stats pms JOIN public.players pl ON pl.id=pms.player_id
    WHERE pms.fixture_id=v_fix.fid
  LOOP
    v_side := CASE WHEN st.team_id=v_fix.home_team_id THEN 'home' WHEN st.team_id=v_fix.away_team_id THEN 'away' ELSE NULL END;
    CONTINUE WHEN v_side IS NULL;
    v_pos := CASE WHEN st.position ~* '(goal|keeper|^g$)' THEN 'GK'
                  WHEN st.position ~* '(def|back|^d$)' THEN 'D'
                  WHEN st.position ~* '(mid|^m$)' THEN 'M'
                  WHEN st.position ~* '(att|forw|strik|wing|^f$)' THEN 'A' ELSE 'M' END;
    IF COALESCE(st.minutes_played,0) > 0 THEN
      INSERT INTO public.lf_game_players (game_id, player_id, api_id, team_id, side, position, name, photo, is_starter, available, on_pitch)
      VALUES (p_game_id, st.player_id, st.api_id, st.team_id, v_side, v_pos, st.name, st.photo, false, true, true)
      ON CONFLICT (game_id, player_id) DO NOTHING;
    END IF;
    IF st.substitute_out THEN
      UPDATE public.lf_game_players SET available=false, on_pitch=false WHERE game_id=p_game_id AND player_id=st.player_id;
    END IF;
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.lf_sync_pool(UUID) TO service_role, authenticated;

-- Tick: also sync the pool while live (before recalc).
CREATE OR REPLACE FUNCTION public.lf_tick(p_game_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_g public.lf_games; v_status TEXT;
BEGIN
  SELECT * INTO v_g FROM public.lf_games WHERE id=p_game_id;
  IF v_g.status='settled' THEN RETURN; END IF;
  SELECT status INTO v_status FROM public.fb_fixtures WHERE id=v_g.fixture_id;
  IF v_g.status IN ('open','upcoming') AND v_status IN ('1H','LIVE','HT','2H','ET','BT','P','FT','AET','PEN') THEN
    PERFORM public.lf_lock(p_game_id);
  END IF;
  IF v_status IN ('1H','LIVE','HT','2H','ET','BT','P') THEN
    UPDATE public.lf_games SET status='live' WHERE id=p_game_id AND status<>'live';
    PERFORM public.lf_sync_pool(p_game_id);
    PERFORM public.lf_recalc(p_game_id);
  ELSIF v_status IN ('FT','AET','PEN') THEN
    PERFORM public.lf_sync_pool(p_game_id);
    PERFORM public.lf_settle(p_game_id);
  END IF;
END $$;
