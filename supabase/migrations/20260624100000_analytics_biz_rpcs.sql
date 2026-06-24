-- Activation funnel (server-truth from dim_users).
create or replace function public.get_activation_funnel() returns jsonb language sql security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'signups', count(*) filter (where registered_at is not null),
    'activated', count(*) filter (where is_activated),
    'activation_rate_pct', round(100.0*count(*) filter (where is_activated)/nullif(count(*) filter (where registered_at is not null),0),1),
    'joined_a_game', count(*) filter (where games_played_total > 0),
    'in_squad', count(*) filter (where in_squad),
    'median_activation_offset_days', percentile_cont(0.5) within group (order by activation_day_offset) filter (where activation_day_offset is not null)
  ) from public.dim_users;
$$;

-- Coin economy (sources vs sinks, inflation).
create or replace function public.get_coin_economy(p_days int default 30) returns jsonb language sql security definer set search_path to 'public' as $$
  with tx as (select * from public.coin_transactions where created_at > now() - (p_days||' days')::interval)
  select jsonb_build_object(
    'window_days', p_days,
    'issued', coalesce(sum(amount) filter (where amount>0),0),
    'spent', coalesce(-sum(amount) filter (where amount<0),0),
    'net_issuance', coalesce(sum(amount),0),
    'sink_source_ratio', round(coalesce(-sum(amount) filter (where amount<0),0)::numeric / nullif(sum(amount) filter (where amount>0),0),2),
    'by_source', (select jsonb_object_agg(transaction_type, s) from (select transaction_type, sum(amount) s from tx where amount>0 group by transaction_type) a),
    'by_sink', (select jsonb_object_agg(transaction_type, -s) from (select transaction_type, sum(amount) s from tx where amount<0 group by transaction_type) b),
    'median_balance', (select percentile_cont(0.5) within group (order by coins_balance) from public.users where user_type='user')
  ) from tx;
$$;

-- Premium (server bottom-of-funnel: purchases/churn/active). View-stage lives in PostHog.
create or replace function public.get_premium_funnel(p_days int default 30) returns jsonb language sql security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'window_days', p_days,
    'premium_users', (select count(*) from public.dim_users where is_premium),
    'new_purchases', (select count(*) from public.analytics_events where event='premium_purchased' and occurred_at > now()-(p_days||' days')::interval),
    'renewals', (select count(*) from public.analytics_events where event='premium_renewed' and occurred_at > now()-(p_days||' days')::interval),
    'cancellations', (select count(*) from public.analytics_events where event='premium_cancelled' and occurred_at > now()-(p_days||' days')::interval),
    'payment_failures', (select count(*) from public.analytics_events where event='premium_payment_failed' and occurred_at > now()-(p_days||' days')::interval),
    'conversion_pct', (select round(100.0*count(*) filter (where is_premium)/nullif(count(*),0),2) from public.dim_users where registered_at is not null)
  );
$$;

-- Retention curve (avg retention % by week offset, recent cohorts).
create or replace function public.get_retention_curve(p_weeks int default 8) returns jsonb language sql security definer set search_path to 'public' as $$
  select jsonb_agg(jsonb_build_object('week_offset', week_offset, 'cohorts', c, 'avg_retained_pct', pct) order by week_offset)
  from (
    select week_offset, count(*) c, round(avg(100.0*retained/nullif(cohort_size,0)),1) pct
    from public.fct_retention where cohort_week > (now() - (p_weeks||' weeks')::interval)::date
    group by week_offset
  ) s;
$$;

grant execute on function public.get_activation_funnel(), public.get_coin_economy(int), public.get_premium_funnel(int), public.get_retention_curve(int) to service_role, authenticated;
