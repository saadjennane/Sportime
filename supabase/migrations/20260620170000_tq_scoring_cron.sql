-- Tournament Quest scoring was never automated (functions existed, no cron) → daily
-- picks stayed "pending" forever. This adds a periodic resolver + backfills the
-- locked odds that were missing on already-saved picks (so correct picks actually pay).

-- 1. Backfill locked_odds from each pick's match odds where it's missing.
update public.tq_daily_predictions dp
set locked_odds = case dp.predicted_result
  when 'A' then m.odds_home when 'B' then m.odds_away else m.odds_draw end
from public.tq_matches m
where m.id = dp.match_id and dp.locked_odds is null
  and (case dp.predicted_result when 'A' then m.odds_home when 'B' then m.odds_away else m.odds_draw end) is not null;

-- 2. Resolver for every open/running competition (scores groups/daily/bracket/long-term + leaderboard).
create or replace function public.tq_resolve_running()
returns int language plpgsql security definer set search_path to 'public' as $$
declare c record; n int := 0;
begin
  for c in select id from public.tq_competitions where status in ('open','running') loop
    perform public.tq_resolve(c.id); n := n + 1;
  end loop;
  return n;
end $$;

-- 3. Cron: resolve every 15 minutes (picks settle automatically as matches finish).
do $$
declare anon text;
begin
  perform cron.unschedule('tq-resolve-running') from cron.job where jobname = 'tq-resolve-running';
  perform cron.schedule('tq-resolve-running', '*/15 * * * *', 'select public.tq_resolve_running();');
end $$;
