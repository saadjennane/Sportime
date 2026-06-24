-- Analytics Phase 0 — server event sink + writer. Client events go to PostHog; this is the
-- canonical stream for server-emitted business events (settlements, grants, premium, social).
create table if not exists public.analytics_events (
  id          bigint generated always as identity primary key,
  user_id     uuid references public.users(id) on delete set null,
  event       text not null,
  props       jsonb not null default '{}',
  source      text not null default 'server',
  session_id  text,
  occurred_at timestamptz not null default now()
);
create index if not exists analytics_events_user_time  on public.analytics_events (user_id, occurred_at desc);
create index if not exists analytics_events_event_time on public.analytics_events (event, occurred_at desc);

-- Server-only: RLS on, no policy (service_role bypasses; no client access).
alter table public.analytics_events enable row level security;

create or replace function public.track_server_event(p_user uuid, p_event text, p_props jsonb default '{}')
returns void language sql security definer set search_path to 'public' as $$
  insert into public.analytics_events (user_id, event, props) values (p_user, p_event, coalesce(p_props, '{}'::jsonb));
$$;
grant execute on function public.track_server_event(uuid, text, jsonb) to service_role, authenticated;
