-- After hints are exhausted, progressively reveal the answer name letter by letter.
-- Returns only the first p_n chars revealed (rest masked) — no full-name leak.
CREATE OR REPLACE FUNCTION public.puzzle_reveal_letters(p_game_id UUID, p_round_no INTEGER, p_n INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_play public.puzzle_plays; v_round public.puzzle_rounds; v_name TEXT; v_masked TEXT;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=p_game_id;
  IF v_play.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_started'); END IF;
  SELECT * INTO v_round FROM public.puzzle_rounds WHERE game_id=p_game_id AND round_no=p_round_no;
  IF v_round.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_round'); END IF;
  SELECT name INTO v_name FROM public.fb_players WHERE api_id = v_round.answer_player_id;
  IF v_name IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_name'); END IF;

  SELECT string_agg(CASE WHEN t.ord <= GREATEST(0,p_n) THEN t.ch WHEN t.ch ~ '[[:alnum:]]' THEN '_' ELSE t.ch END, '' ORDER BY t.ord)
  INTO v_masked
  FROM regexp_split_to_table(v_name, '') WITH ORDINALITY AS t(ch, ord);

  RETURN jsonb_build_object('ok', true, 'masked', v_masked, 'length', char_length(v_name));
END $$;
GRANT EXECUTE ON FUNCTION public.puzzle_reveal_letters(UUID, INTEGER, INTEGER) TO authenticated;
