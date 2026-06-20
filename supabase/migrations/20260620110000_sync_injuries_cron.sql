-- Daily injuries sync cron — flags players injured for upcoming fixtures (Fan Pulse
-- "Upcoming match" shows a cross). Mirrors the sync-odds anon-bearer pattern.
do $$
declare anon text;
begin
  select substring(command from 'Bearer ([A-Za-z0-9._-]+)') into anon from cron.job where jobname = 'sync-odds-30min' limit 1;
  if anon is null then return; end if;
  perform cron.unschedule('sync-injuries-daily') from cron.job where jobname = 'sync-injuries-daily';
  perform cron.schedule('sync-injuries-daily', '30 4 * * *', format($cmd$
    select net.http_post(
      url := 'https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/sync-injuries',
      headers := jsonb_build_object('Authorization', 'Bearer %s', 'Content-Type', 'application/json'),
      body := '{}'::jsonb
    );$cmd$, anon));
end $$;
