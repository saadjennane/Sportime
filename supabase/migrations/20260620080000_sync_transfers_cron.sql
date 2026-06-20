-- Daily transfers sync — applies recent moves (API-Football /transfers) to the
-- imported squads so Fan Pulse / Dream XI team rosters stay current automatically.
-- The edge function (sync-transfers) is cron-invoked with the anon bearer, mirroring
-- the existing sync-odds job. Idempotent: reschedules if it already exists.
do $$
declare anon text;
begin
  select substring(command from 'Bearer ([A-Za-z0-9._-]+)') into anon from cron.job where jobname = 'sync-odds-30min' limit 1;
  if anon is null then return; end if; -- nothing to derive the bearer from
  perform cron.unschedule('sync-transfers-daily') from cron.job where jobname = 'sync-transfers-daily';
  perform cron.schedule('sync-transfers-daily', '0 4 * * *', format($cmd$
    select net.http_post(
      url := 'https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/sync-transfers',
      headers := jsonb_build_object('Authorization', 'Bearer %s', 'Content-Type', 'application/json'),
      body := '{}'::jsonb
    );$cmd$, anon));
end $$;
