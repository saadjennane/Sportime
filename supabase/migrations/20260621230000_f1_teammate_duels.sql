-- ============================================================================
-- Teammates Duels — an F1 game: 11 lines (one per constructor), pick which
-- teammate finishes ahead. Score = +10 per correct duel, +5 per upset (picking
-- the lower-ranked teammate who wins). Rewards by fault palier (0/1/2/3 faults).
-- ============================================================================

create table if not exists public.f1_duel_games (
  id          uuid primary key default gen_random_uuid(),
  race_id     bigint not null references public.f1_races(id) on delete cascade,
  status      text not null default 'open',          -- open | locked | settled
  entry_cost  integer not null default 0,            -- coins to join (0 = free)
  rewards     jsonb not null default '{"0":800,"1":400,"2":150,"3":50}'::jsonb, -- coins per fault count
  pairs       jsonb,                                  -- snapshot of the 11 duels at creation
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  locked_at   timestamptz,
  settled_at  timestamptz,
  updated_at  timestamptz not null default now(),
  unique (race_id)
);

create table if not exists public.f1_duel_picks (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references public.f1_duel_games(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  picks       jsonb not null default '{}'::jsonb,     -- { "<team_id>": <driver_id>, ... }
  correct     integer, upsets integer, faults integer, score integer, palier integer, reward integer,
  status      text not null default 'pending',        -- pending | settled
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  settled_at  timestamptz,
  unique (game_id, user_id)
);

alter table public.f1_duel_games enable row level security;
alter table public.f1_duel_picks enable row level security;

drop policy if exists "duel games readable" on public.f1_duel_games;
create policy "duel games readable" on public.f1_duel_games for select to authenticated using (true);
drop policy if exists "duel picks own read" on public.f1_duel_picks;
create policy "duel picks own read" on public.f1_duel_picks for select to authenticated using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Build (or fetch) the duel game for a race: snapshot the 11 teammate pairs,
-- favourite = the better-ranked teammate (lower championship position).
-- ----------------------------------------------------------------------------
create or replace function public.f1_duel_create_game(p_race_id bigint)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare v_season int; v_pairs jsonb; v_id uuid;
begin
  select season into v_season from public.f1_races where id = p_race_id;
  if v_season is null then raise exception 'Race not found'; end if;

  select id into v_id from public.f1_duel_games where race_id = p_race_id;
  if v_id is not null then return v_id; end if;

  select jsonb_agg(jsonb_build_object(
           'team_id', t.id, 'team_name', t.name, 'team_logo', t.logo,
           'a', t.arr[1], 'b', t.arr[2], 'fav_id', t.fav_id
         ) order by t.position nulls last)
    into v_pairs
  from (
    select c.id, c.name, c.logo, c.position,
      array_agg(jsonb_build_object('id', d.id, 'name', d.name, 'last_name', d.last_name,
                'image', d.image, 'number', d.number, 'position', d.position)
                order by d.position nulls last) arr,
      (array_agg(d.id order by d.position nulls last))[1] fav_id
    from public.f1_constructors c
    join public.f1_drivers d on d.constructor_id = c.id and d.season = c.season
    where c.season = v_season
    group by c.id, c.name, c.logo, c.position
    having count(d.id) >= 2
  ) t;

  insert into public.f1_duel_games (race_id, status, pairs) values (p_race_id, 'open', v_pairs)
  returning id into v_id;
  return v_id;
end $function$;

-- ----------------------------------------------------------------------------
-- Save/replace a user's card. Rejected once the race has started.
-- ----------------------------------------------------------------------------
create or replace function public.f1_duel_save_picks(p_game_id uuid, p_picks jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_user uuid := auth.uid(); v_race bigint; v_race_at timestamptz; v_status text; v_entry int; v_existing uuid; v_balance int;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  select g.race_id, g.status, g.entry_cost, r.race_at
    into v_race, v_status, v_entry, v_race_at
    from public.f1_duel_games g join public.f1_races r on r.id = g.race_id
   where g.id = p_game_id;
  if v_race is null then raise exception 'Game not found'; end if;
  if v_status = 'settled' then raise exception 'Game already settled'; end if;
  if v_race_at is not null and v_race_at <= now() then raise exception 'Picks closed (race started)'; end if;

  select id into v_existing from public.f1_duel_picks where game_id = p_game_id and user_id = v_user;
  if v_existing is null and coalesce(v_entry, 0) > 0 then
    select coins_balance into v_balance from public.users where id = v_user for update;
    if v_balance < v_entry then raise exception 'Insufficient balance'; end if;
    update public.users set coins_balance = coins_balance - v_entry where id = v_user;
  end if;

  insert into public.f1_duel_picks (game_id, user_id, picks, status, updated_at)
    values (p_game_id, v_user, p_picks, 'pending', now())
  on conflict (game_id, user_id) do update set picks = excluded.picks, updated_at = now()
    where public.f1_duel_picks.status = 'pending';
  return jsonb_build_object('ok', true);
end $function$;

-- ----------------------------------------------------------------------------
-- Settle: resolve each duel from f1_results, score, assign palier, credit coins.
-- Duel winner = better classified; DNF loses to a finisher; double-DNF → more
-- laps; unresolvable → line voided (denominator shrinks).
-- ----------------------------------------------------------------------------
create or replace function public.f1_duel_settle(p_race_id bigint)
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare
  v_game uuid; v_pairs jsonb; v_rewards jsonb; n int := 0;
  pk record; line jsonb;
  v_correct int; v_upsets int; v_counted int; v_faults int; v_score int; v_reward int; v_palier int;
  v_aid bigint; v_bid bigint; v_fav bigint; v_winner bigint; v_pick bigint;
  pa int; pb int; la int; lb int;
begin
  select id, pairs, rewards into v_game, v_pairs, v_rewards
    from public.f1_duel_games where race_id = p_race_id and status <> 'settled';
  if v_game is null then return 0; end if;
  if not exists (select 1 from public.f1_results where race_id = p_race_id) then return 0; end if;

  for pk in select * from public.f1_duel_picks where game_id = v_game and status = 'pending' for update loop
    v_correct := 0; v_upsets := 0; v_counted := 0;
    for line in select * from jsonb_array_elements(v_pairs) loop
      v_aid := (line->'a'->>'id')::bigint;
      v_bid := (line->'b'->>'id')::bigint;
      v_fav := (line->>'fav_id')::bigint;
      select position, laps into pa, la from public.f1_results where race_id = p_race_id and driver_id = v_aid;
      select position, laps into pb, lb from public.f1_results where race_id = p_race_id and driver_id = v_bid;

      v_winner := null;
      if pa is not null and pb is not null then v_winner := case when pa < pb then v_aid else v_bid end;
      elsif pa is not null then v_winner := v_aid;
      elsif pb is not null then v_winner := v_bid;
      elsif coalesce(la,0) <> coalesce(lb,0) then v_winner := case when coalesce(la,0) > coalesce(lb,0) then v_aid else v_bid end;
      end if;

      if v_winner is null then continue; end if;  -- voided line
      v_counted := v_counted + 1;
      v_pick := nullif(pk.picks ->> (line->>'team_id'), '')::bigint;
      if v_pick = v_winner then
        v_correct := v_correct + 1;
        if v_pick <> v_fav then v_upsets := v_upsets + 1; end if;  -- underdog called
      end if;
    end loop;

    v_faults := v_counted - v_correct;
    v_score  := v_correct * 10 + v_upsets * 5;
    v_reward := coalesce((v_rewards ->> v_faults::text)::int, 0);
    v_palier := case when v_reward > 0 then v_faults else null end;

    update public.f1_duel_picks set correct = v_correct, upsets = v_upsets, faults = v_faults,
      score = v_score, palier = v_palier, reward = v_reward, status = 'settled', settled_at = now(), updated_at = now()
     where id = pk.id;
    if v_reward > 0 then update public.users set coins_balance = coins_balance + v_reward where id = pk.user_id; end if;
    n := n + 1;
  end loop;

  update public.f1_duel_games set status = 'settled', settled_at = now(), updated_at = now() where id = v_game;
  return n;
end $function$;

-- Admin: edit the reward palier amounts.
create or replace function public.f1_duel_set_rewards(p_game_id uuid, p_rewards jsonb)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if not public.f1_is_admin() then raise exception 'Not authorized'; end if;
  update public.f1_duel_games set rewards = p_rewards, updated_at = now() where id = p_game_id;
end $function$;

-- Leaderboard (tie-break: fewer faults, then more upsets, then earliest entry).
create or replace function public.f1_duel_leaderboard(p_game_id uuid)
returns table(user_id uuid, username text, avatar text, correct int, upsets int, faults int, score int, palier int, reward int, rank bigint)
language sql security definer set search_path to 'public' as $function$
  select p.user_id, u.username, u.profile_picture_url,
    p.correct, p.upsets, p.faults, p.score, p.palier, p.reward,
    rank() over (order by p.faults asc nulls last, p.upsets desc nulls last, p.created_at asc)
  from public.f1_duel_picks p join public.users u on u.id = p.user_id
  where p.game_id = p_game_id and p.status = 'settled'
  order by p.faults asc nulls last, p.upsets desc nulls last, p.created_at asc
$function$;

-- Admin: edit rewards + entry cost + active flag in one call.
create or replace function public.f1_duel_set_config(p_game_id uuid, p_rewards jsonb, p_entry_cost integer, p_is_active boolean)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if not public.f1_is_admin() then raise exception 'Not authorized'; end if;
  update public.f1_duel_games
     set rewards = coalesce(p_rewards, rewards),
         entry_cost = coalesce(p_entry_cost, entry_cost),
         is_active = coalesce(p_is_active, is_active),
         updated_at = now()
   where id = p_game_id;
end $function$;

grant execute on function public.f1_duel_create_game(bigint) to authenticated;
grant execute on function public.f1_duel_set_config(uuid, jsonb, integer, boolean) to authenticated;
grant execute on function public.f1_duel_save_picks(uuid, jsonb) to authenticated;
grant execute on function public.f1_duel_settle(bigint) to authenticated;
grant execute on function public.f1_duel_set_rewards(uuid, jsonb) to authenticated;
grant execute on function public.f1_duel_leaderboard(uuid) to authenticated;
