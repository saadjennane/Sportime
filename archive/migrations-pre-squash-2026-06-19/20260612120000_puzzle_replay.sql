-- Let a user replay a game (deletes their own play + attempts for that game). Generic.
CREATE OR REPLACE FUNCTION public.puzzle_replay(p_game_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_play_id UUID;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT id INTO v_play_id FROM public.puzzle_plays WHERE user_id=v_user AND game_id=p_game_id;
  IF v_play_id IS NOT NULL THEN
    DELETE FROM public.puzzle_round_attempts WHERE play_id=v_play_id;
    DELETE FROM public.puzzle_plays WHERE id=v_play_id;
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;
GRANT EXECUTE ON FUNCTION public.puzzle_replay(UUID) TO authenticated;
