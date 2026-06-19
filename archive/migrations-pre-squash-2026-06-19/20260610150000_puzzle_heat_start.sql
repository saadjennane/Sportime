-- Result-aware heat: predicting the wrong winner (e.g. 0-1 vs 1-0) is cold, not burning.
CREATE OR REPLACE FUNCTION public.puzzle_heat(gh INTEGER, ga INTEGER, ah INTEGER, aa INTEGER)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE d INTEGER := abs(gh - ah) + abs(ga - aa); b JSONB; v_key TEXT := 'cold'; gr INTEGER; ar INTEGER;
BEGIN
  FOR b IN SELECT * FROM jsonb_array_elements((SELECT heat_bands FROM public.puzzle_config WHERE id = 1)) LOOP
    IF d <= (b->>'max')::int THEN v_key := b->>'key'; EXIT; END IF;
  END LOOP;
  IF v_key = 'exact' THEN RETURN 'exact'; END IF;
  gr := sign(gh - ga); ar := sign(ah - aa);
  IF gr <> ar THEN RETURN 'cold'; END IF;  -- wrong 1X2 outcome -> cold regardless of distance
  RETURN v_key;
END $$;

-- Start (or resume) the clock when the player hits Play.
CREATE OR REPLACE FUNCTION public.puzzle_start(p_game_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_play public.puzzle_plays;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  INSERT INTO public.puzzle_plays (user_id, game_id) VALUES (v_user, p_game_id) ON CONFLICT (user_id, game_id) DO NOTHING;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id = v_user AND game_id = p_game_id;
  IF v_play.finished_at IS NULL AND NOT EXISTS (SELECT 1 FROM public.puzzle_round_attempts WHERE play_id = v_play.id) THEN
    UPDATE public.puzzle_plays SET started_at = now() WHERE id = v_play.id;
    RETURN jsonb_build_object('ok', true, 'started_at', now());
  END IF;
  RETURN jsonb_build_object('ok', true, 'started_at', v_play.started_at);
END $$;
GRANT EXECUTE ON FUNCTION public.puzzle_start(UUID) TO authenticated;
