-- Auto-create a Match Royale ~1h before kickoff for every activated, not-yet-started fixture.
-- Activated = fixture-level enabled, OR its league enabled (unless the fixture is explicitly disabled).
CREATE OR REPLACE FUNCTION public.mr_autocreate_games()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f RECORD; n INTEGER := 0;
BEGIN
  FOR f IN
    SELECT fx.id, fx.league_id, ht.name AS h, at2.name AS a
    FROM public.fb_fixtures fx
    LEFT JOIN public.fb_teams ht  ON ht.id  = fx.home_team_id
    LEFT JOIN public.fb_teams at2 ON at2.id = fx.away_team_id
    WHERE fx.date BETWEEN now() AND now() + INTERVAL '60 minutes'
      AND COALESCE(fx.status,'NS') = 'NS'
      AND NOT EXISTS (SELECT 1 FROM public.mr_games g WHERE g.fixture_id = fx.id)
      AND (
        EXISTS (SELECT 1 FROM public.mr_activation a WHERE a.scope='fixture' AND a.target_id=fx.id AND a.enabled)
        OR (EXISTS (SELECT 1 FROM public.mr_activation a WHERE a.scope='league' AND a.target_id=fx.league_id AND a.enabled)
            AND NOT EXISTS (SELECT 1 FROM public.mr_activation a WHERE a.scope='fixture' AND a.target_id=fx.id AND NOT a.enabled))
      )
  LOOP
    BEGIN
      PERFORM public.mr_create_game(f.id, COALESCE(f.h,'Home') || ' vs ' || COALESCE(f.a,'Away'));
      n := n + 1;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'autocreate % failed: %', f.id, SQLERRM; END;
  END LOOP;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.mr_autocreate_games() TO authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'match-royale-autocreate') THEN PERFORM cron.unschedule('match-royale-autocreate'); END IF;
    PERFORM cron.schedule('match-royale-autocreate', '*/5 * * * *', $cron$ SELECT public.mr_autocreate_games(); $cron$);
  END IF;
END $$;
