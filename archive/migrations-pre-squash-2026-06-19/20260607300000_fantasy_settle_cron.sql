-- Fantasy 2 — auto-settle: cron every 30 min calls process-all-finished-gameweeks
-- (which scores every finished, unprocessed game week). Uses the PUBLIC anon key
-- in the Authorization header (never the service_role key); the function uses its
-- own service key (from env) internally.
DO $$
DECLARE
  v_anon TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyeXB1emR1cGxiemJtdmVmdnpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MjA1NjgsImV4cCI6MjA3NTM5NjU2OH0.jsUTKfIjsLF2wlbBPeJDlFPj2ICozE6VaqYA7egKrsQ';
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'settle-fantasy-gameweeks') THEN
      PERFORM cron.unschedule('settle-fantasy-gameweeks');
    END IF;
    PERFORM cron.schedule(
      'settle-fantasy-gameweeks',
      '*/30 * * * *',
      format($cron$
        SELECT net.http_post(
          url := 'https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/process-all-finished-gameweeks',
          headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'),
          body := '{}'::jsonb
        );
      $cron$, v_anon)
    );
  END IF;
END $$;
