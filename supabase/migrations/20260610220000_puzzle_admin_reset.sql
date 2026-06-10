-- Admin tool: clear puzzle plays (lets a user replay today's game). Test/ops use.
CREATE OR REPLACE FUNCTION public.puzzle_admin_reset_plays()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INTEGER;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin only'; END IF;
  DELETE FROM public.puzzle_plays;   -- cascades puzzle_round_attempts
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.puzzle_admin_reset_plays() TO authenticated;
