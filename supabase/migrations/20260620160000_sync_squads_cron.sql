-- Rolling squad refresh cron (team membership + shirt numbers), every 2 hours.
do $$
declare anon text;
begin
  select substring(command from 'Bearer ([A-Za-z0-9._-]+)') into anon from cron.job where jobname = 'sync-odds-30min' limit 1;
  if anon is null then return; end if;
  perform cron.unschedule('sync-squads-rolling') from cron.job where jobname = 'sync-squads-rolling';
  perform cron.schedule('sync-squads-rolling', '0 */2 * * *', format($cmd$
    select net.http_post(
      url := 'https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/sync-squads',
      headers := jsonb_build_object('Authorization', 'Bearer %s', 'Content-Type', 'application/json'),
      body := '{"limit":40}'::jsonb
    );$cmd$, anon));
end $$;
