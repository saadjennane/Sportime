-- Accent-insensitive search for players and clubs (so "alva"/"julian" match
-- "Álvarez"/"Julián"). PostgREST ilike is accent-sensitive; these RPCs use unaccent.
create extension if not exists unaccent;

create or replace function public.fb_search_players(p_q text, p_pos text default null)
returns table(id uuid, name text, photo text, photo_url text, "position" text, club text)
language sql stable security definer
set search_path to 'public'
as $$
  select p.id, p.name, p.photo, p.photo_url, p.position,
    (select t.name from public.fb_player_team_association a join public.fb_teams t on t.id = a.team_id where a.player_id = p.id limit 1)
  from public.fb_players p
  where public.unaccent(lower(p.name || ' ' || coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''))) like '%' || public.unaccent(lower(p_q)) || '%'
    and (p_pos is null or p.position = p_pos)
  order by
    (public.unaccent(lower(p.name)) like public.unaccent(lower(p_q)) || '%') desc,        -- name starts with query
    (public.unaccent(lower(p.name)) like '%' || public.unaccent(lower(p_q)) || '%') desc, -- query in the display name
    length(p.name),
    p.name
  limit 40;
$$;
grant execute on function public.fb_search_players(text, text) to anon, authenticated;

create or replace function public.fb_search_clubs(p_q text)
returns table(id uuid, name text, logo_url text, logo text)
language sql stable security definer
set search_path to 'public'
as $$
  select t.id, t.name, t.logo_url, t.logo
  from public.fb_teams t
  where public.unaccent(lower(t.name)) like '%' || public.unaccent(lower(p_q)) || '%'
  order by t.name
  limit 25;
$$;
grant execute on function public.fb_search_clubs(text) to anon, authenticated;
