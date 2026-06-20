-- Fan Pulse: aggregate per slot (not just per position bucket) so the consensus XI
-- places each player in the slot fans actually chose. With a single voter the
-- consensus then mirrors that voter's XI exactly (left-to-right included).
create or replace function public.fan_pulse_aggregate(p_scope_type text, p_scope_ref uuid)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  with ent as (select user_id, picks from public.fan_pulse_entries where scope_type=p_scope_type and scope_ref=p_scope_ref),
  tot as (select count(*) n from ent),
  pk as (select e.user_id, (p->>'slot')::int slot, p->>'player_key' player_key, p->>'name' name, p->>'photo' photo, p->>'position' position
         from ent e, jsonb_array_elements(e.picks) p where coalesce((p->>'is_starter')::boolean, true)),
  agg as (select player_key, max(name) name, max(photo) photo, max(position) position, count(distinct user_id) c
          from pk where player_key is not null group by player_key),
  slot_agg as (
    select slot, player_key, max(name) name, max(photo) photo, max(position) position, count(distinct user_id) c,
           row_number() over (partition by slot order by count(distinct user_id) desc, max(name)) rn
    from pk where player_key is not null and slot is not null group by slot, player_key)
  select jsonb_build_object(
    'participants', (select n from tot),
    'players', coalesce((select jsonb_agg(jsonb_build_object(
        'player_key',player_key,'name',name,'photo',photo,'position',position,'count',c,
        'pct', case when (select n from tot)>0 then round(100.0*c/(select n from tot)) else 0 end) order by c desc) from agg),'[]'::jsonb),
    'slots', coalesce((select jsonb_agg(jsonb_build_object(
        'slot',slot,'player_key',player_key,'name',name,'photo',photo,'position',position,'count',c,
        'pct', case when (select n from tot)>0 then round(100.0*c/(select n from tot)) else 0 end) order by slot) from slot_agg where rn=1),'[]'::jsonb));
$function$;
