-- Higher/Lower: numeric attribute index (many criteria) + daily game per criterion.
CREATE OR REPLACE FUNCTION public.puzzle_value_index()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH pool AS (SELECT DISTINCT player_id FROM public.tm_transfers)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.player_id, 'n', p.name, 'p', p.photo_url,
    'mv', p.current_market_value_eur, 'maxv', p.max_market_value_eur,
    'h', p.height_cm, 'by', EXTRACT(YEAR FROM p.date_of_birth)::int,
    'fee', (SELECT max(fee_eur) FROM public.tm_transfers t WHERE t.player_id=p.player_id),
    'tro', (SELECT count(*) FROM public.tm_trophies tr WHERE tr.player_id=p.player_id),
    'clubs', (SELECT count(*) FROM (
                SELECT from_club_name c FROM public.tm_transfers t WHERE t.player_id=p.player_id AND from_club_name IS NOT NULL
                UNION SELECT to_club_name FROM public.tm_transfers t WHERE t.player_id=p.player_id AND to_club_name IS NOT NULL
              ) z WHERE c !~* '(U1[5-9]|U2[0-3]|youth|yth|giov|reserve|castilla|madrileñ|without club|retired|career break|unknown| B$| II$| C$)')
  )), '[]'::jsonb)
  FROM public.tm_players p JOIN pool ON pool.player_id = p.player_id WHERE p.name IS NOT NULL;
$$;
GRANT EXECUTE ON FUNCTION public.puzzle_value_index() TO anon, authenticated;

-- daily game per criterion (auto-created; sequence is generated client-side)
CREATE OR REPLACE FUNCTION public.puzzle_get_today_hl(p_criterion TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_crit TEXT; v_has BOOLEAN; v_date DATE; v_game public.puzzle_games; v_play public.puzzle_plays;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT level INTO v_crit FROM public.puzzle_user_prefs WHERE user_id=v_user AND game_type='higherlower';
  v_has := (v_crit IS NOT NULL);
  IF p_criterion IS NOT NULL THEN
    v_crit := p_criterion;
    INSERT INTO public.puzzle_user_prefs (user_id, game_type, level) VALUES (v_user, 'higherlower', v_crit)
    ON CONFLICT (user_id, game_type) DO UPDATE SET level = EXCLUDED.level, updated_at = now();
  END IF;
  v_crit := COALESCE(v_crit, 'value');
  v_date := public.puzzle_current_date();
  SELECT * INTO v_game FROM public.puzzle_games WHERE game_type='higherlower' AND level=v_crit AND puzzle_date=v_date;
  IF v_game.id IS NULL THEN
    INSERT INTO public.puzzle_games (game_type, level, puzzle_date, seq, status) VALUES ('higherlower', v_crit, v_date, 1, 'live')
    ON CONFLICT (game_type, level, puzzle_date) DO NOTHING;
    SELECT * INTO v_game FROM public.puzzle_games WHERE game_type='higherlower' AND level=v_crit AND puzzle_date=v_date;
  END IF;
  INSERT INTO public.puzzle_plays (user_id, game_id) VALUES (v_user, v_game.id) ON CONFLICT (user_id, game_id) DO NOTHING;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=v_game.id;
  RETURN jsonb_build_object(
    'ok', true, 'criterion', v_crit, 'has_prefs', v_has, 'date', v_date,
    'play', jsonb_build_object('id', v_play.id, 'finished_at', v_play.finished_at, 'rounds_solved', v_play.rounds_solved, 'score', v_play.score),
    'game', jsonb_build_object('id', v_game.id),
    'best', (SELECT max(score) FROM public.puzzle_plays WHERE user_id=v_user AND game_id IN (SELECT id FROM public.puzzle_games WHERE game_type='higherlower' AND level=v_crit)),
    'dist', (SELECT COALESCE(jsonb_agg(score), '[]'::jsonb) FROM public.puzzle_plays WHERE game_id=v_game.id AND finished_at IS NOT NULL AND user_id <> v_user)
  );
END $$;
GRANT EXECUTE ON FUNCTION public.puzzle_get_today_hl(TEXT) TO authenticated;
