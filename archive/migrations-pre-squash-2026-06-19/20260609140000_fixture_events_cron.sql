-- Capture events + statistics for live fixtures every minute.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'capture-fixture-events') THEN
      PERFORM cron.unschedule('capture-fixture-events');
    END IF;
    PERFORM cron.schedule(
      'capture-fixture-events',
      '* * * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/sync-fixture-events',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      );
      $cron$
    );
  END IF;
END $$;
