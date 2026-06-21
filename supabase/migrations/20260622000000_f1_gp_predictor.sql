-- ============================================================================
-- GP Predictor — an F1 prediction game. A game spans 1..N Grands Prix; for each
-- GP the player predicts Pole, Winner, Top 5 (ordered, partial credit), Fastest
-- lap and First retirement. The game leaderboard is the cumulative score over its
-- GPs; fixed coins are paid by final rank. Cards lock at each GP's qualifying.
-- (Season Forecast = kind 'season', built separately.)
-- ============================================================================

create table if not exists public.f1_pred_games (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null default 'gp',                 -- gp | season
  name       text not null,
  season     integer,
  race_ids   bigint[] not null default '{}',
  scoring    jsonb not null default '{"pole":10,"winner":15,"top5_exact":10,"top5_partial":4,"fastest_lap":8,"first_dnf":8}'::jsonb,
  rewards    jsonb not null default '[{"upto":1,"coins":1000},{"upto":3,"coins":500},{"upto":10,"coins":150}]'::jsonb,
  entry_cost integer not null default 0,
  is_active  boolean not null default true,
  status     text not null default 'open',               -- open | settled
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.f1_pred_picks (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references public.f1_pred_games(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  race_id     bigint not null references public.f1_races(id) on delete cascade,
  pole        bigint, winner bigint, top5 jsonb default '[]'::jsonb, fastest_lap bigint, first_dnf bigint,
  score       integer, breakdown jsonb, status text not null default 'pending',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  settled_at  timestamptz,
  unique (game_id, user_id, race_id)
);

alter table public.f1_pred_games enable row level security;
alter table public.f1_pred_picks enable row level security;
drop policy if exists "pred games readable" on public.f1_pred_games;
create policy "pred games readable" on public.f1_pred_games for select to authenticated using (true);
drop policy if exists "pred picks own read" on public.f1_pred_picks;
create policy "pred picks own read" on public.f1_pred_picks for select to authenticated using (user_id = auth.uid());

-- Admin: create a GP Predictor game over a chosen set of races.
create or replace function public.f1_pred_create_game(p_name text, p_race_ids bigint[])
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare v_id uuid; v_season int;
begin
  if not public.f1_is_admin() then raise exception 'Not authorized'; end if;
  if coalesce(array_length(p_race_ids, 1), 0) = 0 then raise exception 'Pick at least one Grand Prix'; end if;
  select season into v_season from public.f1_races where id = p_race_ids[1];
  insert into public.f1_pred_games (kind, name, season, race_ids)
    values ('gp', coalesce(nullif(trim(p_name), ''), 'GP Predictor'), v_season, p_race_ids)
  returning id into v_id;
  return v_id;
end $function$;

-- Save/replace a player's card for one GP of a game. Locked at qualifying start.
create or replace function public.f1_pred_save_picks(p_game_id uuid, p_race_id bigint, p_picks jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_user uuid := auth.uid(); v_quali timestamptz; v_races bigint[]; v_status text; v_entry int; v_exists uuid; v_bal int;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  select race_ids, status, entry_cost into v_races, v_status, v_entry from public.f1_pred_games where id = p_game_id;
  if v_races is null then raise exception 'Game not found'; end if;
  if v_status = 'settled' then raise exception 'Game already settled'; end if;
  if not (p_race_id = any(v_races)) then raise exception 'This Grand Prix is not part of the game'; end if;
  select quali_start_at into v_quali from public.f1_races where id = p_race_id;
  if v_quali is not null and v_quali <= now() then raise exception 'Predictions closed (qualifying started)'; end if;

  -- entry cost charged once per game (on the first GP card)
  select id into v_exists from public.f1_pred_picks where game_id = p_game_id and user_id = v_user limit 1;
  if v_exists is null and coalesce(v_entry, 0) > 0 then
    select coins_balance into v_bal from public.users where id = v_user for update;
    if v_bal < v_entry then raise exception 'Insufficient balance'; end if;
    update public.users set coins_balance = coins_balance - v_entry where id = v_user;
  end if;

  insert into public.f1_pred_picks (game_id, user_id, race_id, pole, winner, top5, fastest_lap, first_dnf, status, updated_at)
    values (p_game_id, v_user, p_race_id,
            nullif(p_picks->>'pole','')::bigint, nullif(p_picks->>'winner','')::bigint,
            coalesce(p_picks->'top5','[]'::jsonb), nullif(p_picks->>'fastest_lap','')::bigint,
            nullif(p_picks->>'first_dnf','')::bigint, 'pending', now())
  on conflict (game_id, user_id, race_id) do update
    set pole = excluded.pole, winner = excluded.winner, top5 = excluded.top5,
        fastest_lap = excluded.fastest_lap, first_dnf = excluded.first_dnf, updated_at = now()
    where public.f1_pred_picks.status = 'pending';
  return jsonb_build_object('ok', true);
end $function$;

-- Settle every GP-predictor card for a finished race, then finalise any game
-- whose races are all in (cumulative rank → fixed coin rewards).
create or replace function public.f1_pred_settle_race(p_race_id bigint)
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare
  g record; pk record; n int := 0;
  v_pole bigint; v_winner bigint; v_fl bigint; v_dnf bigint; v_top5 bigint[];
  s jsonb; pts int; bd jsonb; i int; pred bigint; v_complete boolean;
begin
  if not exists (select 1 from public.f1_results where race_id = p_race_id) then return 0; end if;
  select driver_id into v_pole   from public.f1_results where race_id = p_race_id and is_pole limit 1;
  select driver_id into v_winner from public.f1_results where race_id = p_race_id and position = 1 limit 1;
  select driver_id into v_fl     from public.f1_results where race_id = p_race_id and is_fastest_lap limit 1;
  select driver_id into v_dnf    from public.f1_results where race_id = p_race_id and is_dnf order by laps asc nulls first limit 1;
  select array_agg(driver_id order by position) into v_top5 from public.f1_results where race_id = p_race_id and position between 1 and 5;

  for g in select * from public.f1_pred_games where kind = 'gp' and status <> 'settled' and p_race_id = any(race_ids) loop
    s := g.scoring;
    for pk in select * from public.f1_pred_picks where game_id = g.id and race_id = p_race_id and status = 'pending' for update loop
      pts := 0; bd := '{}'::jsonb;
      if pk.pole is not null and pk.pole = v_pole then pts := pts + (s->>'pole')::int; bd := bd || jsonb_build_object('pole',(s->>'pole')::int); end if;
      if pk.winner is not null and pk.winner = v_winner then pts := pts + (s->>'winner')::int; bd := bd || jsonb_build_object('winner',(s->>'winner')::int); end if;
      if pk.fastest_lap is not null and pk.fastest_lap = v_fl then pts := pts + (s->>'fastest_lap')::int; bd := bd || jsonb_build_object('fastest_lap',(s->>'fastest_lap')::int); end if;
      if pk.first_dnf is not null and v_dnf is not null and pk.first_dnf = v_dnf then pts := pts + (s->>'first_dnf')::int; bd := bd || jsonb_build_object('first_dnf',(s->>'first_dnf')::int); end if;
      -- top 5 ordered, with partial credit
      if v_top5 is not null then
        declare t5 int := 0;
        begin
          for i in 1..least(5, jsonb_array_length(coalesce(pk.top5,'[]'::jsonb))) loop
            pred := nullif(pk.top5->>(i-1),'')::bigint;
            if pred is null then continue; end if;
            if i <= array_length(v_top5,1) and pred = v_top5[i] then t5 := t5 + (s->>'top5_exact')::int;
            elsif pred = any(v_top5) then t5 := t5 + (s->>'top5_partial')::int;
            end if;
          end loop;
          if t5 > 0 then bd := bd || jsonb_build_object('top5', t5); end if;
          pts := pts + t5;
        end;
      end if;

      update public.f1_pred_picks set score = pts, breakdown = bd, status = 'settled', settled_at = now(), updated_at = now() where id = pk.id;
      n := n + 1;
    end loop;

    -- finalise the game once every GP it covers has results
    select bool_and(exists (select 1 from public.f1_results fr where fr.race_id = rid)) into v_complete
      from unnest(g.race_ids) rid;
    if coalesce(v_complete, false) then
      declare r record; v_reward int;
      begin
        for r in
          select user_id, rk from (
            select user_id, rank() over (order by sum(coalesce(score,0)) desc, min(created_at) asc) rk
            from public.f1_pred_picks where game_id = g.id group by user_id
          ) x
        loop
          select (elem->>'coins')::int into v_reward
            from jsonb_array_elements(g.rewards) elem
            where (elem->>'upto')::int >= r.rk order by (elem->>'upto')::int asc limit 1;
          if coalesce(v_reward,0) > 0 then update public.users set coins_balance = coins_balance + v_reward where id = r.user_id; end if;
        end loop;
        update public.f1_pred_games set status = 'settled', settled_at = now(), updated_at = now() where id = g.id;
      end;
    end if;
  end loop;
  return n;
end $function$;

-- Cumulative leaderboard (+ computed rank reward).
create or replace function public.f1_pred_leaderboard(p_game_id uuid)
returns table(user_id uuid, username text, avatar text, score bigint, gps_played bigint, rank bigint, reward integer)
language sql security definer set search_path to 'public' as $function$
  with tot as (
    select p.user_id, sum(coalesce(p.score,0)) score, count(*) filter (where p.status='settled') gps_played, min(p.created_at) c
    from public.f1_pred_picks p where p.game_id = p_game_id group by p.user_id
  ), ranked as (
    select t.*, rank() over (order by t.score desc, t.c asc) rk from tot t
  )
  select r.user_id, u.username, u.profile_picture_url, r.score, r.gps_played, r.rk,
    coalesce((select (elem->>'coins')::int from public.f1_pred_games g, jsonb_array_elements(g.rewards) elem
              where g.id = p_game_id and (elem->>'upto')::int >= r.rk order by (elem->>'upto')::int asc limit 1), 0)
  from ranked r join public.users u on u.id = r.user_id
  order by r.rk asc;
$function$;

-- Admin: edit scoring / rewards / entry / active.
create or replace function public.f1_pred_set_config(p_game_id uuid, p_scoring jsonb, p_rewards jsonb, p_entry_cost integer, p_is_active boolean)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if not public.f1_is_admin() then raise exception 'Not authorized'; end if;
  update public.f1_pred_games
     set scoring = coalesce(p_scoring, scoring), rewards = coalesce(p_rewards, rewards),
         entry_cost = coalesce(p_entry_cost, entry_cost), is_active = coalesce(p_is_active, is_active), updated_at = now()
   where id = p_game_id;
end $function$;

grant execute on function public.f1_pred_create_game(text, bigint[]) to authenticated;
grant execute on function public.f1_pred_save_picks(uuid, bigint, jsonb) to authenticated;
grant execute on function public.f1_pred_settle_race(bigint) to authenticated;
grant execute on function public.f1_pred_leaderboard(uuid) to authenticated;
grant execute on function public.f1_pred_set_config(uuid, jsonb, jsonb, integer, boolean) to authenticated;
