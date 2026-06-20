-- Rotating cursor for the daily squad refresh (sync-squads): keeps team rosters +
-- shirt numbers current by re-reading API-Football squads a slice at a time.
create table if not exists public.fb_squad_sync (id int primary key default 1, next_offset int not null default 0);
insert into public.fb_squad_sync(id, next_offset) values (1, 0) on conflict (id) do nothing;

create or replace function public.fb_teams_with_squads(p_offset int, p_limit int)
returns table(id uuid, api_id bigint)
language sql stable security definer set search_path to 'public' as $$
  select t.id, t.api_id from public.fb_teams t
  where t.api_id is not null and exists (select 1 from public.fb_player_team_association a where a.team_id = t.id)
  order by t.id offset p_offset limit p_limit;
$$;
