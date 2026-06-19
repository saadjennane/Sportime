-- =============================================================================
-- Automated data pipeline — keep fixtures & live scores fresh with no manual
-- "Import" click. Schedules the sync edge functions via pg_cron + pg_net.
--
-- Auth: we pass the PUBLIC anon key as the bearer. The edge functions verify a
-- JWT (the anon key is a valid one) and use their own service-role key
-- server-side for DB writes — so no privileged key lives in the schedule, and
-- this does not depend on the `supabase.service_role_key` GUC that the older
-- crons assumed (and which may never have been set).
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  -- Daily fixture import. The function queries BOTH the current and next season
  -- internally, so it is robust to how each league's season is labelled.
  if exists (select 1 from cron.job where jobname = 'sync-fixtures-daily') then
    perform cron.unschedule('sync-fixtures-daily');
  end if;
  perform cron.schedule('sync-fixtures-daily', '0 5 * * *', $job$
    select net.http_post(
      url := 'https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/sync-fixture-schedules',
      headers := jsonb_build_object(
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyeXB1emR1cGxiemJtdmVmdnpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MjA1NjgsImV4cCI6MjA3NTM5NjU2OH0.jsUTKfIjsLF2wlbBPeJDlFPj2ICozE6VaqYA7egKrsQ',
        'Content-Type', 'application/json'
      ),
      body := '{"days_ahead": 14}'::jsonb
    );
  $job$);

  -- Live scores every 5 minutes — keeps fb_fixtures statuses/goals current so
  -- match bets settle automatically (settle-match-bets cron, every 10 min).
  if exists (select 1 from cron.job where jobname = 'sync-live-scores-5min') then
    perform cron.unschedule('sync-live-scores-5min');
  end if;
  perform cron.schedule('sync-live-scores-5min', '*/5 * * * *', $job$
    select net.http_post(
      url := 'https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/sync-live-scores',
      headers := jsonb_build_object(
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyeXB1emR1cGxiemJtdmVmdnpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MjA1NjgsImV4cCI6MjA3NTM5NjU2OH0.jsUTKfIjsLF2wlbBPeJDlFPj2ICozE6VaqYA7egKrsQ',
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $job$);

exception when others then
  raise notice 'sync automation cron setup skipped: %', sqlerrm;
end;
$$;
