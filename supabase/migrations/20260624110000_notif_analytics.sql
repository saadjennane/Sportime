-- Phase 3 — notification measurement.
create table if not exists public.notif_delivery_stats (
  onesignal_id text primary key, notif_key text,
  successful int, failed int, errored int, converted int, fetched_at timestamptz default now()
);
alter table public.notif_delivery_stats enable row level security;

-- Client calls this when a push is opened → stamps opened_at on the matching log row.
create or replace function public.mark_notif_opened(p_notif_key text) returns void language sql security definer set search_path to 'public' as $$
  update public.notification_log set opened_at = now()
  where id = (select id from public.notification_log
              where user_id = auth.uid() and notif_key = p_notif_key and opened_at is null
                and created_at > now() - interval '3 days' order by created_at desc limit 1);
$$;
grant execute on function public.mark_notif_opened(text) to authenticated;

-- Per-notif performance (sent / opened / open-rate).
create or replace function public.get_notif_performance(p_days int default 30) returns jsonb language sql security definer set search_path to 'public' as $$
  select jsonb_agg(row order by sent desc) from (
    select jsonb_build_object('notif_key', notif_key, 'category', category,
      'sent', count(*) filter (where status='sent'),
      'opened', count(*) filter (where opened_at is not null),
      'open_rate_pct', round(100.0*count(*) filter (where opened_at is not null)/nullif(count(*) filter (where status='sent'),0),1),
      'capped', count(*) filter (where status like 'skipped_cap%'),
      'held', count(*) filter (where status='held')) as row,
      count(*) filter (where status='sent') as sent
    from public.notification_log where created_at > now() - (p_days||' days')::interval
    group by notif_key, category
  ) s;
$$;

-- Directional holdout lift: active-rate of treated (push-enabled, non-holdout) vs 10% holdout,
-- among addressable users (have an active push subscription).
create or replace function public.get_notif_holdout_lift(p_days int default 30) returns jsonb language sql security definer set search_path to 'public' as $$
  with base as (
    select d.user_id, u.mkt_holdout,
      exists(select 1 from public.fct_user_day f where f.user_id=d.user_id and f.active and f.day > now()::date - p_days) active_recent
    from public.dim_users d join public.users u on u.id=d.user_id
    where exists(select 1 from public.user_onesignal_players p where p.user_id=d.user_id and p.is_active)
  )
  select jsonb_build_object(
    'window_days', p_days,
    'treated_n', count(*) filter (where not mkt_holdout),
    'holdout_n', count(*) filter (where mkt_holdout),
    'treated_active_pct', round(100.0*count(*) filter (where not mkt_holdout and active_recent)/nullif(count(*) filter (where not mkt_holdout),0),1),
    'holdout_active_pct', round(100.0*count(*) filter (where mkt_holdout and active_recent)/nullif(count(*) filter (where mkt_holdout),0),1)
  ) from base;
$$;

grant execute on function public.get_notif_performance(int), public.get_notif_holdout_lift(int) to service_role, authenticated;
