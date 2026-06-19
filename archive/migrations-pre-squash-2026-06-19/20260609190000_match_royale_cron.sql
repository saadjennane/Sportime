-- Drive Match Royale automatically: tick every non-finished game each minute.
CREATE OR REPLACE FUNCTION public.mr_tick_all()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g UUID; n INTEGER := 0;
BEGIN
  FOR g IN SELECT id FROM public.mr_games WHERE status NOT IN ('finished','cancelled') LOOP
    BEGIN PERFORM public.mr_tick(g); n := n + 1; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'mr_tick % failed: %', g, SQLERRM; END;
  END LOOP;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.mr_tick_all() TO authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'match-royale-tick') THEN PERFORM cron.unschedule('match-royale-tick'); END IF;
    PERFORM cron.schedule('match-royale-tick', '* * * * *', $cron$ SELECT public.mr_tick_all(); $cron$);
  END IF;
END $$;
