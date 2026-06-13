-- Cron: create Live Fantasy games when lineups publish (every 5 min).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.unschedule('live-fantasy-autocreate') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='live-fantasy-autocreate');
    PERFORM cron.schedule('live-fantasy-autocreate', '*/5 * * * *', $cron$
      SELECT net.http_post(
        url := 'https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/lf-autocreate',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true), 'Content-Type', 'application/json'),
        body := '{}'::jsonb);
    $cron$);
  END IF;
END $$;
