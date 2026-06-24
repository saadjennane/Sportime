-- Fan Pulse F1 v2:
--  • Favourite Pilot + Favourite Team (constructor) on the user profile, each with a
--    fan count (like Football's favourite club).
--  • Two ranked grids reusing the existing f1_hof infrastructure:
--      - Hall of Fame  → kind='driver'          (all-time legends, already seeded)
--      - Current Grid  → kind='current_driver'  (this season's drivers, seeded below)

-- 1) Favourites on the user profile (store f1_drivers.id / f1_constructors.id as text)
alter table public.users
  add column if not exists favorite_f1_driver text,
  add column if not exists favorite_f1_constructor text;

-- 2) Allow the new 'current_driver' kind in the save RPC (driver + constructor unchanged)
create or replace function public.f1_hof_save(p_kind text, p_picks jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_kind not in ('driver','constructor','current_driver') then raise exception 'Bad kind'; end if;
  insert into public.f1_hof_entries (user_id, kind, picks, updated_at)
    values (v_user, p_kind, coalesce(p_picks,'[]'::jsonb), now())
  on conflict (user_id, kind) do update set picks = excluded.picks, updated_at = now();
  return jsonb_build_object('ok', true);
end $function$;

-- 3) Seed Current Grid candidates from the latest F1 season's drivers (rebuild in place
--    so the pool tracks the active grid; picks are stored by key so this is idempotent).
delete from public.f1_hof_candidates where kind = 'current_driver';
insert into public.f1_hof_candidates (kind, key, name, image, sort_order)
select 'current_driver', d.id::text, d.name, d.image, coalesce(d.position, 999)
from public.f1_drivers d
where d.season = (select max(season) from public.f1_drivers);
