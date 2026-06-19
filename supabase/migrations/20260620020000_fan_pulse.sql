-- Fan Pulse: fans build XIs for their club (legends / dream / match) and see the
-- aggregated "pulse" — % of fans picking each player. Reuses fb_players for squads.

create table if not exists public.fan_pulse_legends (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.fb_teams(id) on delete cascade,
  name text not null,
  position text not null check (position in ('GK','DEF','MID','FWD')),
  detail text,
  photo_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_fan_pulse_legends_team on public.fan_pulse_legends(team_id);
alter table public.fan_pulse_legends enable row level security;
drop policy if exists fan_pulse_legends_read on public.fan_pulse_legends;
create policy fan_pulse_legends_read on public.fan_pulse_legends for select using (true);
drop policy if exists fan_pulse_legends_admin on public.fan_pulse_legends;
create policy fan_pulse_legends_admin on public.fan_pulse_legends for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.fan_pulse_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  scope_type text not null check (scope_type in ('legends','dream','match')),
  scope_ref uuid not null,
  formation text not null default '4-3-3',
  picks jsonb not null default '[]'::jsonb,
  sell_list jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, scope_type, scope_ref)
);
create index if not exists idx_fan_pulse_entries_scope on public.fan_pulse_entries(scope_type, scope_ref);
alter table public.fan_pulse_entries enable row level security;
drop policy if exists fan_pulse_entries_own on public.fan_pulse_entries;
create policy fan_pulse_entries_own on public.fan_pulse_entries for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.fan_pulse_aggregate(p_scope_type text, p_scope_ref uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  with ent as (select user_id, picks from public.fan_pulse_entries where scope_type=p_scope_type and scope_ref=p_scope_ref),
  tot as (select count(*) n from ent),
  pk as (select e.user_id, p->>'player_key' player_key, p->>'name' name, p->>'photo' photo, p->>'position' position
         from ent e, jsonb_array_elements(e.picks) p where coalesce((p->>'is_starter')::boolean, true)),
  agg as (select player_key, max(name) name, max(photo) photo, max(position) position, count(distinct user_id) c
          from pk where player_key is not null group by player_key)
  select jsonb_build_object(
    'participants', (select n from tot),
    'players', coalesce((select jsonb_agg(jsonb_build_object(
        'player_key',player_key,'name',name,'photo',photo,'position',position,'count',c,
        'pct', case when (select n from tot)>0 then round(100.0*c/(select n from tot)) else 0 end) order by c desc) from agg),'[]'::jsonb));
$$;
grant execute on function public.fan_pulse_aggregate(text, uuid) to authenticated, anon, service_role;
