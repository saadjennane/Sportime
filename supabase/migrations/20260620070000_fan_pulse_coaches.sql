-- Fan Pulse: selectable coach per XI, ranked by matches managed.
create table if not exists public.fan_pulse_coaches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  coach_key text not null,
  name text not null,
  photo_url text,
  matches int not null default 0,
  unique (team_id, coach_key)
);
alter table public.fan_pulse_coaches enable row level security;
drop policy if exists fan_pulse_coaches_read on public.fan_pulse_coaches;
create policy fan_pulse_coaches_read on public.fan_pulse_coaches for select using (true);
drop policy if exists fan_pulse_coaches_admin on public.fan_pulse_coaches;
create policy fan_pulse_coaches_admin on public.fan_pulse_coaches for all using (is_admin()) with check (is_admin());

-- The picked coach is stored on the entry: { coach_key, name, photo }.
alter table public.fan_pulse_entries add column if not exists coach jsonb;

-- Aggregate now also returns the fans' consensus coach (most-picked + %).
create or replace function public.fan_pulse_aggregate(p_scope_type text, p_scope_ref uuid)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  with ent as (select user_id, picks, coach from public.fan_pulse_entries where scope_type=p_scope_type and scope_ref=p_scope_ref),
  tot as (select count(*) n from ent),
  pk as (select e.user_id, (p->>'slot')::int slot, p->>'player_key' player_key, p->>'name' name, p->>'photo' photo, p->>'position' position
         from ent e, jsonb_array_elements(e.picks) p where coalesce((p->>'is_starter')::boolean, true)),
  agg as (select player_key, max(name) name, max(photo) photo, max(position) position, count(distinct user_id) c
          from pk where player_key is not null group by player_key),
  slot_agg as (
    select slot, player_key, max(name) name, max(photo) photo, max(position) position, count(distinct user_id) c,
           row_number() over (partition by slot order by count(distinct user_id) desc, max(name)) rn
    from pk where player_key is not null and slot is not null group by slot, player_key),
  coach_agg as (
    select coach->>'coach_key' k, max(coach->>'name') name, max(coach->>'photo') photo, count(*) c
    from ent where coach is not null and coalesce(coach->>'coach_key','') <> '' group by coach->>'coach_key'
    order by count(*) desc limit 1)
  select jsonb_build_object(
    'participants', (select n from tot),
    'players', coalesce((select jsonb_agg(jsonb_build_object(
        'player_key',player_key,'name',name,'photo',photo,'position',position,'count',c,
        'pct', case when (select n from tot)>0 then round(100.0*c/(select n from tot)) else 0 end) order by c desc) from agg),'[]'::jsonb),
    'slots', coalesce((select jsonb_agg(jsonb_build_object(
        'slot',slot,'player_key',player_key,'name',name,'photo',photo,'position',position,'count',c,
        'pct', case when (select n from tot)>0 then round(100.0*c/(select n from tot)) else 0 end) order by slot) from slot_agg where rn=1),'[]'::jsonb),
    'coach', (select case when k is not null then jsonb_build_object('coach_key',k,'name',name,'photo',photo,'count',c,
        'pct', case when (select n from tot)>0 then round(100.0*c/(select n from tot)) else 0 end) else null end from coach_agg));
$function$;
