-- Analytics Phase 2 — marts + nightly jobs. Server-truth aggregates over the ledgers.
-- All server-only (RLS on, no policy; dashboards read via service role / admin RPCs).

create table if not exists public.fct_user_day (
  user_id uuid not null references public.users(id) on delete cascade,
  day date not null,
  sessions int default 0, picks int default 0, games_joined int default 0,
  coins_earned bigint default 0, coins_spent bigint default 0, xp_earned bigint default 0,
  active boolean default true,
  primary key (user_id, day)
);
create index if not exists fct_user_day_day on public.fct_user_day (day);

create table if not exists public.dim_users (
  user_id uuid primary key references public.users(id) on delete cascade,
  signup_date date, registered_at timestamptz, acquisition_source text,
  first_pick_at timestamptz, is_activated boolean, activation_day_offset int,
  lifecycle_stage text, is_premium boolean, premium_since timestamptz,
  follows_football boolean, follows_f1 boolean, favourite_club text,
  lifetime_coins_earned bigint, lifetime_coins_spent bigint, level text,
  games_played_total int, in_squad boolean, last_active_date date,
  updated_at timestamptz default now()
);

create table if not exists public.fct_retention (
  cohort_week date not null, week_offset int not null,
  cohort_size int not null, retained int not null,
  primary key (cohort_week, week_offset)
);

alter table public.fct_user_day enable row level security;
alter table public.dim_users    enable row level security;
alter table public.fct_retention enable row level security;

-- Rebuild the user dimension from users + ledgers.
create or replace function public.refresh_dim_users() returns void language sql security definer set search_path to 'public' as $$
  insert into public.dim_users as d (user_id, signup_date, registered_at, first_pick_at, is_activated,
    activation_day_offset, lifecycle_stage, is_premium, follows_football, follows_f1, favourite_club,
    lifetime_coins_earned, lifetime_coins_spent, level, games_played_total, in_squad, last_active_date, updated_at)
  select u.id, u.created_at::date,
    case when u.user_type in ('user','admin','super_admin') then u.registered_at end,
    fp.first_pick_at, (fp.first_pick_at is not null),
    case when fp.first_pick_at is not null and u.registered_at is not null
         then floor(extract(epoch from fp.first_pick_at - u.registered_at)/86400)::int end,
    case when u.last_active_at is null then 'new'
         when extract(epoch from now()-u.last_active_at)/86400 >= 90 then 'churned'
         when extract(epoch from now()-u.last_active_at)/86400 >= 30 then 'deep_dormant'
         when extract(epoch from now()-u.last_active_at)/86400 >= 7  then 'dormant'
         when extract(epoch from now()-u.last_active_at)/86400 >= 3  then 'at_risk'
         else 'core' end,
    coalesce(u.is_subscribed,false),
    coalesce(u.sports, array['football','f1']) @> array['football'],
    coalesce(u.sports, array['football','f1']) @> array['f1'],
    u.favorite_club,
    coalesce(ct.earned,0), coalesce(ct.spent,0), u.current_level,
    coalesce(gp.games,0),
    exists(select 1 from public.squad_members sm where sm.user_id=u.id),
    u.last_active_at::date, now()
  from public.users u
  left join (select user_id, min(created_at) first_pick_at from public.match_bets group by user_id) fp on fp.user_id=u.id
  left join (select user_id, sum(amount) filter (where amount>0) earned, -sum(amount) filter (where amount<0) spent
             from public.coin_transactions group by user_id) ct on ct.user_id=u.id
  left join (select user_id, count(*) games from (
               select user_id from public.challenge_participants
               union all select user_id from public.tq_entries
               union all select user_id from public.live_game_entries
               union all select user_id from public.user_fantasy_teams) x group by user_id) gp on gp.user_id=u.id
  on conflict (user_id) do update set
    signup_date=excluded.signup_date, registered_at=excluded.registered_at, first_pick_at=excluded.first_pick_at,
    is_activated=excluded.is_activated, activation_day_offset=excluded.activation_day_offset,
    lifecycle_stage=excluded.lifecycle_stage, is_premium=excluded.is_premium,
    follows_football=excluded.follows_football, follows_f1=excluded.follows_f1, favourite_club=excluded.favourite_club,
    lifetime_coins_earned=excluded.lifetime_coins_earned, lifetime_coins_spent=excluded.lifetime_coins_spent,
    level=excluded.level, games_played_total=excluded.games_played_total, in_squad=excluded.in_squad,
    last_active_date=excluded.last_active_date, updated_at=now();
$$;

-- Roll up one day's per-user activity (engaged DAU = did something economic/game that day).
create or replace function public.rollup_user_day(p_day date) returns void language sql security definer set search_path to 'public' as $$
  insert into public.fct_user_day as f (user_id, day, picks, coins_earned, coins_spent, xp_earned, active)
  select uid, p_day, coalesce(sum(picks),0), coalesce(sum(ce),0), coalesce(sum(cs),0), coalesce(sum(xpe),0), true
  from (
    select user_id uid, count(*) picks, 0::bigint ce, 0::bigint cs, 0::bigint xpe from public.match_bets where created_at::date=p_day group by user_id
    union all
    select user_id, 0, coalesce(sum(amount) filter (where amount>0),0), coalesce(-sum(amount) filter (where amount<0),0), 0 from public.coin_transactions where created_at::date=p_day group by user_id
    union all
    select user_id, 0,0,0, coalesce(sum(amount),0) from public.xp_events where created_at::date=p_day group by user_id
    union all
    select user_id, 0,0,0,0 from public.analytics_events where occurred_at::date=p_day group by user_id
  ) s group by uid
  on conflict (user_id, day) do update set picks=excluded.picks, coins_earned=excluded.coins_earned,
    coins_spent=excluded.coins_spent, xp_earned=excluded.xp_earned, active=true;
$$;

-- Rebuild retention (signup-week cohort × week offset → retained users).
create or replace function public.compute_retention() returns void language plpgsql security definer set search_path to 'public' as $$
begin
  truncate public.fct_retention;
  insert into public.fct_retention (cohort_week, week_offset, cohort_size, retained)
  with cohorts as (select user_id, date_trunc('week', registered_at)::date cw from public.dim_users where registered_at is not null),
  sizes as (select cw, count(*) n from cohorts group by cw),
  act as (select c.cw, floor((f.day - c.cw)/7.0)::int wo, c.user_id
          from cohorts c join public.fct_user_day f on f.user_id=c.user_id and f.active and f.day >= c.cw),
  ret as (select cw, wo, count(distinct user_id) r from act where wo >= 0 group by cw, wo)
  select s.cw, r.wo, s.n, r.r from sizes s join ret r on r.cw=s.cw;
end $$;

-- Nightly orchestration: refresh dim, roll up yesterday & today, recompute retention.
create or replace function public.analytics_nightly() returns void language plpgsql security definer set search_path to 'public' as $$
begin
  perform public.refresh_dim_users();
  perform public.rollup_user_day((now()-interval '1 day')::date);
  perform public.rollup_user_day(now()::date);
  perform public.compute_retention();
end $$;

grant execute on function public.refresh_dim_users(), public.rollup_user_day(date), public.compute_retention(), public.analytics_nightly() to service_role;
