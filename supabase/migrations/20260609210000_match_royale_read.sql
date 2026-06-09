-- Aggregate reads for the mobile UI (no individual answer exposure).
CREATE OR REPLACE FUNCTION public.mr_question_stats(p_question_id UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_object_agg(option_key, c), '{}'::jsonb)
  FROM (SELECT option_key, count(*) c FROM public.mr_answers WHERE question_id = p_question_id GROUP BY option_key) s;
$$;
GRANT EXECUTE ON FUNCTION public.mr_question_stats(UUID) TO anon, authenticated;

-- Game counts (players total / alive) for the UI.
CREATE OR REPLACE FUNCTION public.mr_game_counts(p_game_id UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM public.mr_participants WHERE game_id = p_game_id),
    'alive', (SELECT count(*) FROM public.mr_participants WHERE game_id = p_game_id AND status = 'alive')
  );
$$;
GRANT EXECUTE ON FUNCTION public.mr_game_counts(UUID) TO anon, authenticated;
