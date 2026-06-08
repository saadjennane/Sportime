-- Self-healing cron: every 30 min, reconcile stale fixtures (finished matches the
-- live sync missed during an API outage/quota block) so they can never stay stuck
-- 'upcoming' / unsettled. Idempotent + bounded; zero API calls when nothing is stale.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-fixtures-30min') THEN
      PERFORM cron.unschedule('reconcile-fixtures-30min');
    END IF;

    PERFORM cron.schedule(
      'reconcile-fixtures-30min',
      '*/30 * * * *',
      $job$
      SELECT net.http_post(
        url := 'https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/reconcile-fixtures',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyeXB1emR1cGxiemJtdmVmdnpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MjA1NjgsImV4cCI6MjA3NTM5NjU2OH0.jsUTKfIjsLF2wlbBPeJDlFPj2ICozE6VaqYA7egKrsQ'
        ),
        body := '{}'::jsonb
      );
      $job$
    );
  END IF;
END $$;
