-- B3 — notification rails: the log that powers frequency caps, quiet-hours holds,
-- dedup, the marketing holdout and per-notification analytics. Every send is logged here.
create table if not exists public.notification_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  notif_key     text not null,                 -- catalog id, e.g. 'MC-3','ON-1'
  category      text not null,                 -- onboarding|activation|daily|matches|fantasy|social|rewards|premium|reactivation|churn
  pref_type     text not null,                 -- gameplay|league|squad|premium|reminder|system
  priority      smallint not null,             -- 0=P0,1=P1,2=P2
  dedup_key     text,
  channel       text not null default 'push',  -- push|inapp|email
  status        text not null default 'queued',-- queued|held|sent|skipped_cap|skipped_pref|skipped_dedup|skipped_holdout|failed
  skip_reason   text,
  scheduled_for timestamptz,
  sent_at       timestamptz,
  opened_at     timestamptz,
  onesignal_id  text,
  payload       jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists notif_log_user_time     on public.notification_log (user_id, created_at desc);
create index if not exists notif_log_user_cat_time on public.notification_log (user_id, category, created_at desc);
create unique index if not exists notif_log_dedup   on public.notification_log (user_id, dedup_key)
  where dedup_key is not null and status in ('queued','held','sent');

-- ~10% deterministic marketing holdout (stable per user) for incrementality measurement.
alter table public.users add column if not exists mkt_holdout boolean
  generated always as ((('x'||substr(md5(id::text),1,7))::bit(28)::int % 10) = 0) stored;
