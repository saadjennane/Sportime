-- Teammates Duels: upsets now pay a coin bonus on top of the fault palier
-- (only inside a paying palier, 0–3 faults). Admin-configurable per game.
alter table public.f1_duel_games add column if not exists upset_bonus integer not null default 25;

create or replace function public.f1_duel_settle(p_race_id bigint)
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare
  v_game uuid; v_pairs jsonb; v_rewards jsonb; v_bonus int; n int := 0;
  pk record; line jsonb;
  v_correct int; v_upsets int; v_counted int; v_faults int; v_score int; v_reward int; v_base int; v_palier int;
  v_aid bigint; v_bid bigint; v_fav bigint; v_winner bigint; v_pick bigint;
  pa int; pb int; la int; lb int;
begin
  select id, pairs, rewards, upset_bonus into v_game, v_pairs, v_rewards, v_bonus
    from public.f1_duel_games where race_id = p_race_id and status <> 'settled';
  if v_game is null then return 0; end if;
  if not exists (select 1 from public.f1_results where race_id = p_race_id) then return 0; end if;

  for pk in select * from public.f1_duel_picks where game_id = v_game and status = 'pending' for update loop
    v_correct := 0; v_upsets := 0; v_counted := 0;
    for line in select * from jsonb_array_elements(v_pairs) loop
      v_aid := (line->'a'->>'id')::bigint; v_bid := (line->'b'->>'id')::bigint; v_fav := (line->>'fav_id')::bigint;
      select position, laps into pa, la from public.f1_results where race_id = p_race_id and driver_id = v_aid;
      select position, laps into pb, lb from public.f1_results where race_id = p_race_id and driver_id = v_bid;
      v_winner := null;
      if pa is not null and pb is not null then v_winner := case when pa < pb then v_aid else v_bid end;
      elsif pa is not null then v_winner := v_aid;
      elsif pb is not null then v_winner := v_bid;
      elsif coalesce(la,0) <> coalesce(lb,0) then v_winner := case when coalesce(la,0) > coalesce(lb,0) then v_aid else v_bid end;
      end if;
      if v_winner is null then continue; end if;
      v_counted := v_counted + 1;
      v_pick := nullif(pk.picks ->> (line->>'team_id'), '')::bigint;
      if v_pick = v_winner then v_correct := v_correct + 1; if v_pick <> v_fav then v_upsets := v_upsets + 1; end if; end if;
    end loop;

    v_faults := v_counted - v_correct;
    v_score  := v_correct * 10 + v_upsets * 5;
    v_base   := coalesce((v_rewards ->> v_faults::text)::int, 0);
    v_reward := case when v_base > 0 then v_base + v_upsets * coalesce(v_bonus,0) else 0 end;
    v_palier := case when v_base > 0 then v_faults else null end;

    update public.f1_duel_picks set correct=v_correct, upsets=v_upsets, faults=v_faults,
      score=v_score, palier=v_palier, reward=v_reward, status='settled', settled_at=now(), updated_at=now()
     where id = pk.id;
    if v_reward > 0 then update public.users set coins_balance = coins_balance + v_reward where id = pk.user_id; end if;
    n := n + 1;
  end loop;

  update public.f1_duel_games set status='settled', settled_at=now(), updated_at=now() where id=v_game;
  return n;
end $function$;

drop function if exists public.f1_duel_set_config(uuid, jsonb, integer, boolean);
create or replace function public.f1_duel_set_config(p_game_id uuid, p_rewards jsonb, p_entry_cost integer, p_is_active boolean, p_upset_bonus integer)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if not public.f1_is_admin() then raise exception 'Not authorized'; end if;
  update public.f1_duel_games
     set rewards = coalesce(p_rewards, rewards), entry_cost = coalesce(p_entry_cost, entry_cost),
         is_active = coalesce(p_is_active, is_active), upset_bonus = coalesce(p_upset_bonus, upset_bonus), updated_at = now()
   where id = p_game_id;
end $function$;

grant execute on function public.f1_duel_set_config(uuid, jsonb, integer, boolean, integer) to authenticated;
