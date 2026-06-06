-- =============================================================================
-- Automate odds so imported fixtures get their odds without manual action.
-- Runs sync-odds every 30 minutes (anon bearer, like the other automation crons).
-- Combined with the daily fixture import, every match from today onward gets its
-- odds picked up automatically within the cron interval.
-- Rule (enforced inside sync-odds): matches FROM today onward, any status.
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  -- Drop the old hourly job that relied on the (possibly unset) service_role GUC.
  if exists (select 1 from cron.job where jobname = 'sync-odds-upcoming') then
    perform cron.unschedule('sync-odds-upcoming');
  end if;

  if exists (select 1 from cron.job where jobname = 'sync-odds-30min') then
    perform cron.unschedule('sync-odds-30min');
  end if;
  perform cron.schedule('sync-odds-30min', '*/30 * * * *', $job$
    select net.http_post(
      url := 'https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/sync-odds',
      headers := jsonb_build_object(
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyeXB1emR1cGxiemJtdmVmdnpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MjA1NjgsImV4cCI6MjA3NTM5NjU2OH0.jsUTKfIjsLF2wlbBPeJDlFPj2ICozE6VaqYA7egKrsQ',
        'Content-Type', 'application/json'
      ),
      body := '{"mode":"upcoming","days_ahead":14}'::jsonb
    );
  $job$);

exception when others then
  raise notice 'sync-odds cron setup skipped: %', sqlerrm;
end;
$$;
