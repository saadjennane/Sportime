-- Live Fantasy (Phase B.3): pot resolution + settle (payout) + lifecycle tick + cron.

ALTER TABLE public.lf_config ADD COLUMN IF NOT EXISTS reward_split JSONB NOT NULL DEFAULT '[{"rank":1,"pct":50},{"rank":2,"pct":30},{"rank":3,"pct":20}]'::jsonb;

-- Pot assignment for Live Fantasy (priority match>team>league>global), game-scoped.
CREATE OR REPLACE FUNCTION public.lf_resolve_pot(p_fixture_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_league UUID; v_home UUID; v_away UUID; r RECORD;
BEGIN
  SELECT league_id, home_team_id, away_team_id INTO v_league, v_home, v_away FROM public.fb_fixtures WHERE id=p_fixture_id;
  SELECT * INTO r FROM public.mr_pot_assignments WHERE is_active AND game='live_fantasy' AND scope='match' AND fixture_id=p_fixture_id LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('pot_profile_id',r.pot_profile_id,'override_amount',r.override_amount); END IF;
  SELECT * INTO r FROM public.mr_pot_assignments WHERE is_active AND game='live_fantasy' AND scope='team' AND team_id IN (v_home,v_away) LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('pot_profile_id',r.pot_profile_id,'override_amount',r.override_amount); END IF;
  SELECT * INTO r FROM public.mr_pot_assignments WHERE is_active AND game='live_fantasy' AND scope='league' AND league_id=v_league LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('pot_profile_id',r.pot_profile_id,'override_amount',r.override_amount); END IF;
  SELECT * INTO r FROM public.mr_pot_assignments WHERE is_active AND game='live_fantasy' AND scope='global' LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('pot_profile_id',r.pot_profile_id,'override_amount',r.override_amount); END IF;
  RETURN jsonb_build_object('pot_profile_id', null);
END; $$;

-- Final recalc + pot + payout by reward split.
CREATE OR REPLACE FUNCTION public.lf_settle(p_game_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_g public.lf_games; v_count INT; v_pot INT := 0; v_profile public.mr_pot_profiles; v_assign JSONB; v_split JSONB; sp JSONB; v_amt INT; v_n INT; w RECORD;
BEGIN
  SELECT * INTO v_g FROM public.lf_games WHERE id=p_game_id;
  IF v_g.id IS NULL OR v_g.status='settled' THEN RETURN jsonb_build_object('ok',true,'already',true); END IF;
  PERFORM public.lf_recalc(p_game_id);
  SELECT count(*) INTO v_count FROM public.lf_teams WHERE game_id=p_game_id;

  v_assign := public.lf_resolve_pot(v_g.fixture_id);
  IF (v_assign->>'pot_profile_id') IS NOT NULL THEN
    SELECT * INTO v_profile FROM public.mr_pot_profiles WHERE id=(v_assign->>'pot_profile_id')::uuid;
    IF (v_assign->>'override_amount') IS NOT NULL THEN v_pot := (v_assign->>'override_amount')::int;
    ELSIF v_profile.type='fixed' THEN v_pot := COALESCE(v_profile.fixed_amount,0);
    ELSIF v_profile.type='progressive' THEN
      SELECT COALESCE((t->>'amount')::int,0) INTO v_pot FROM jsonb_array_elements(v_profile.tiers) t
      WHERE v_count >= (t->>'min')::int AND (t->>'max' IS NULL OR v_count <= (t->>'max')::int) LIMIT 1;
    ELSIF v_profile.type='funded' THEN
      v_pot := FLOOR(v_count * COALESCE(v_profile.entry_cost,0) * COALESCE(v_profile.redistribution_pct,100) / 100.0);
    END IF;
  END IF;

  -- distribute by reward split (each rank's pct shared among ties)
  SELECT reward_split INTO v_split FROM public.lf_config WHERE id=1;
  IF v_pot > 0 THEN
    FOR sp IN SELECT * FROM jsonb_array_elements(v_split) LOOP
      SELECT count(*) INTO v_n FROM public.lf_teams WHERE game_id=p_game_id AND rank=(sp->>'rank')::int;
      IF v_n > 0 THEN
        v_amt := FLOOR(v_pot * (sp->>'pct')::numeric / 100.0 / v_n);
        FOR w IN SELECT * FROM public.lf_teams WHERE game_id=p_game_id AND rank=(sp->>'rank')::int LOOP
          PERFORM public.add_coins(w.user_id, v_amt, 'live_fantasy', jsonb_build_object('lf_game',p_game_id,'rank',w.rank));
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.lf_games SET status='settled', settled_at=now(), pot_amount=v_pot, pot_profile_id=(v_assign->>'pot_profile_id')::uuid WHERE id=p_game_id;
  RETURN jsonb_build_object('ok',true,'pot',v_pot,'teams',v_count);
END; $$;

-- Lifecycle tick driven by the live fixture status.
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
    PERFORM public.lf_recalc(p_game_id);
  ELSIF v_status IN ('FT','AET','PEN') THEN
    PERFORM public.lf_settle(p_game_id);
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.lf_tick_all()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g UUID;
BEGIN
  FOR g IN SELECT id FROM public.lf_games WHERE status <> 'settled' LOOP PERFORM public.lf_tick(g); END LOOP;
END; $$;
GRANT EXECUTE ON FUNCTION public.lf_tick_all() TO service_role;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.unschedule('live-fantasy-tick') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='live-fantasy-tick');
    PERFORM cron.schedule('live-fantasy-tick', '* * * * *', $cron$ SELECT public.lf_tick_all(); $cron$);
  END IF;
END $$;
