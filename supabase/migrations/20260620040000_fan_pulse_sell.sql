-- Aggregate the "players to sell" lists across dream-XI voters.
create or replace function public.fan_pulse_sell_aggregate(p_scope_ref uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  with ent as (select user_id, sell_list from public.fan_pulse_entries where scope_type='dream' and scope_ref=p_scope_ref),
  tot as (select count(*) n from ent),
  s as (select e.user_id, p->>'player_key' k, p->>'name' name, p->>'photo' photo from ent e, jsonb_array_elements(coalesce(e.sell_list,'[]'::jsonb)) p),
  agg as (select k, max(name) name, max(photo) photo, count(distinct user_id) c from s where k is not null group by k)
  select jsonb_build_object('participants',(select n from tot),'players',
    coalesce((select jsonb_agg(jsonb_build_object('player_key',k,'name',name,'photo',photo,'count',c,
      'pct', case when (select n from tot)>0 then round(100.0*c/(select n from tot)) else 0 end) order by c desc) from agg),'[]'::jsonb));
$$;
grant execute on function public.fan_pulse_sell_aggregate(uuid) to authenticated, anon, service_role;
