-- ============================================================================
-- Season Forecast (kind 'season' on f1_pred_games): predict the Champion, the
-- Top 3 drivers and Top 3 constructors. Locks after round 1, settles at season
-- end from the championship standings. Fixed coins by final rank.
-- ============================================================================

alter table public.f1_pred_games add column if not exists lock_at timestamptz;

create table if not exists public.f1_pred_season_picks (
  id                 uuid primary key default gen_random_uuid(),
  game_id            uuid not null references public.f1_pred_games(id) on delete cascade,
  user_id            uuid not null references public.users(id) on delete cascade,
  champion           bigint,
  top3_drivers       jsonb not null default '[]'::jsonb,
  top3_constructors  jsonb not null default '[]'::jsonb,
  score integer, breakdown jsonb, status text not null default 'pending',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), settled_at timestamptz,
  unique (game_id, user_id)
);
alter table public.f1_pred_season_picks enable row level security;
drop policy if exists "season picks own read" on public.f1_pred_season_picks;
create policy "season picks own read" on public.f1_pred_season_picks for select to authenticated using (user_id = auth.uid());

-- Admin: create the season forecast. Locks at round 1 by default.
create or replace function public.f1_pred_create_season(p_name text, p_season integer, p_lock_at timestamptz)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare v_id uuid; v_lock timestamptz;
begin
  if not public.f1_is_admin() then raise exception 'Not authorized'; end if;
  v_lock := coalesce(p_lock_at, (select race_at from public.f1_races where season = p_season order by round asc nulls last limit 1));
  insert into public.f1_pred_games (kind, name, season, race_ids, lock_at,
    scoring, rewards)
  values ('season', coalesce(nullif(trim(p_name),''), 'Season Forecast'), p_season, '{}', v_lock,
    '{"champion":40,"driver_exact":20,"driver_partial":8,"constructor_exact":15,"constructor_partial":6}'::jsonb,
    '[{"upto":1,"coins":3000},{"upto":3,"coins":1500},{"upto":10,"coins":500}]'::jsonb)
  returning id into v_id;
  return v_id;
end $function$;

create or replace function public.f1_pred_save_season(p_game_id uuid, p_picks jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_user uuid := auth.uid(); v_lock timestamptz; v_status text; v_entry int; v_exists uuid; v_bal int;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  select lock_at, status, entry_cost into v_lock, v_status, v_entry from public.f1_pred_games where id = p_game_id and kind = 'season';
  if v_status is null then raise exception 'Game not found'; end if;
  if v_status = 'settled' then raise exception 'Season already settled'; end if;
  if v_lock is not null and v_lock <= now() then raise exception 'Forecast locked (season under way)'; end if;

  select id into v_exists from public.f1_pred_season_picks where game_id = p_game_id and user_id = v_user;
  if v_exists is null and coalesce(v_entry,0) > 0 then
    select coins_balance into v_bal from public.users where id = v_user for update;
    if v_bal < v_entry then raise exception 'Insufficient balance'; end if;
    update public.users set coins_balance = coins_balance - v_entry where id = v_user;
  end if;

  insert into public.f1_pred_season_picks (game_id, user_id, champion, top3_drivers, top3_constructors, status, updated_at)
    values (p_game_id, v_user, nullif(p_picks->>'champion','')::bigint,
            coalesce(p_picks->'top3_drivers','[]'::jsonb), coalesce(p_picks->'top3_constructors','[]'::jsonb), 'pending', now())
  on conflict (game_id, user_id) do update
    set champion = excluded.champion, top3_drivers = excluded.top3_drivers, top3_constructors = excluded.top3_constructors, updated_at = now()
    where public.f1_pred_season_picks.status = 'pending';
  return jsonb_build_object('ok', true);
end $function$;

-- Admin: settle from the current championship standings.
create or replace function public.f1_pred_settle_season(p_game_id uuid)
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare
  g record; pk record; n int := 0; s jsonb;
  v_champ bigint; v_td bigint[]; v_tc bigint[]; pts int; bd jsonb; i int; pred bigint; v_reward int; r record;
begin
  if not public.f1_is_admin() then raise exception 'Not authorized'; end if;
  select * into g from public.f1_pred_games where id = p_game_id and kind = 'season';
  if g.id is null then raise exception 'Game not found'; end if;
  if g.status = 'settled' then return 0; end if;
  s := g.scoring;
  select array_agg(id order by position) into v_td from public.f1_drivers where season = g.season and position between 1 and 3;
  select array_agg(id order by position) into v_tc from public.f1_constructors where season = g.season and position between 1 and 3;
  v_champ := (select id from public.f1_drivers where season = g.season and position = 1 limit 1);

  for pk in select * from public.f1_pred_season_picks where game_id = p_game_id and status = 'pending' for update loop
    pts := 0; bd := '{}'::jsonb;
    if pk.champion is not null and pk.champion = v_champ then pts := pts + (s->>'champion')::int; bd := bd || jsonb_build_object('champion',(s->>'champion')::int); end if;
    if v_td is not null then
      declare d3 int := 0; begin
        for i in 1..least(3, jsonb_array_length(coalesce(pk.top3_drivers,'[]'::jsonb))) loop
          pred := nullif(pk.top3_drivers->>(i-1),'')::bigint; if pred is null then continue; end if;
          if i <= array_length(v_td,1) and pred = v_td[i] then d3 := d3 + (s->>'driver_exact')::int;
          elsif pred = any(v_td) then d3 := d3 + (s->>'driver_partial')::int; end if;
        end loop;
        if d3 > 0 then bd := bd || jsonb_build_object('drivers', d3); end if; pts := pts + d3;
      end;
    end if;
    if v_tc is not null then
      declare c3 int := 0; begin
        for i in 1..least(3, jsonb_array_length(coalesce(pk.top3_constructors,'[]'::jsonb))) loop
          pred := nullif(pk.top3_constructors->>(i-1),'')::bigint; if pred is null then continue; end if;
          if i <= array_length(v_tc,1) and pred = v_tc[i] then c3 := c3 + (s->>'constructor_exact')::int;
          elsif pred = any(v_tc) then c3 := c3 + (s->>'constructor_partial')::int; end if;
        end loop;
        if c3 > 0 then bd := bd || jsonb_build_object('constructors', c3); end if; pts := pts + c3;
      end;
    end if;
    update public.f1_pred_season_picks set score = pts, breakdown = bd, status = 'settled', settled_at = now(), updated_at = now() where id = pk.id;
    n := n + 1;
  end loop;

  for r in select user_id, rank() over (order by score desc nulls last, created_at asc) rk from public.f1_pred_season_picks where game_id = p_game_id loop
    select (elem->>'coins')::int into v_reward from jsonb_array_elements(g.rewards) elem where (elem->>'upto')::int >= r.rk order by (elem->>'upto')::int asc limit 1;
    if coalesce(v_reward,0) > 0 then update public.users set coins_balance = coins_balance + v_reward where id = r.user_id; end if;
  end loop;
  update public.f1_pred_games set status = 'settled', settled_at = now(), updated_at = now() where id = p_game_id;
  return n;
end $function$;

create or replace function public.f1_pred_season_leaderboard(p_game_id uuid)
returns table(user_id uuid, username text, avatar text, score integer, rank bigint, reward integer)
language sql security definer set search_path to 'public' as $function$
  with ranked as (
    select p.user_id, coalesce(p.score,0) score, rank() over (order by coalesce(p.score,0) desc, p.created_at asc) rk
    from public.f1_pred_season_picks p where p.game_id = p_game_id
  )
  select r.user_id, u.username, u.profile_picture_url, r.score, r.rk,
    coalesce((select (elem->>'coins')::int from public.f1_pred_games g, jsonb_array_elements(g.rewards) elem
              where g.id = p_game_id and (elem->>'upto')::int >= r.rk order by (elem->>'upto')::int asc limit 1), 0)
  from ranked r join public.users u on u.id = r.user_id order by r.rk asc;
$function$;

grant execute on function public.f1_pred_create_season(text, integer, timestamptz) to authenticated;
grant execute on function public.f1_pred_save_season(uuid, jsonb) to authenticated;
grant execute on function public.f1_pred_settle_season(uuid) to authenticated;
grant execute on function public.f1_pred_season_leaderboard(uuid) to authenticated;
