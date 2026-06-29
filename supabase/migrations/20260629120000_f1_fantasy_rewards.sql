-- Fantasy F1 reward packs: store a prize ladder per game (same shape as
-- football challenge `prizes` / TQ `rewards_json`) so the mobile GameHeader
-- can surface the 🎁 Rewards button data-driven, like every other game.

alter table public.f1_fantasy_games
  add column if not exists rewards_json jsonb not null default '[]'::jsonb;

-- Extend the create RPC with an optional rewards ladder. Drop the old 2-arg
-- version so the 3-arg (defaulted) signature is unambiguous.
drop function if exists public.f1_fantasy_create_game(bigint, text);

-- p_rewards defaults to NULL: a condition-only edit (NULL) preserves the
-- existing reward ladder; passing a non-null array overwrites it.
create or replace function public.f1_fantasy_create_game(
  p_race_id bigint, p_condition text, p_rewards jsonb default null)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare v_id uuid; v_rule jsonb;
begin
  if not public.f1_is_admin() then raise exception 'Not authorized'; end if;
  v_rule := case p_condition
    when 'standard'          then '{"drivers":{"elite":1,"confirmed":1,"outsider":1}}'
    when 'no_stars'          then '{"drivers":{"elite":0,"confirmed":2,"outsider":1}}'
    when 'double_star'       then '{"drivers":{"elite":2,"confirmed":0,"outsider":1}}'
    when 'underdog'          then '{"drivers":{"elite":1,"confirmed":0,"outsider":2}}'
    when 'constructor_chaos' then '{"drivers":null,"constructor_block":"elite"}'
    else '{"drivers":null}' end::jsonb;
  insert into public.f1_fantasy_games (race_id, condition, rule, rewards_json)
    values (p_race_id, p_condition, v_rule, coalesce(p_rewards, '[]'::jsonb))
  on conflict (race_id) do update set
    condition = excluded.condition, rule = excluded.rule,
    rewards_json = coalesce(p_rewards, public.f1_fantasy_games.rewards_json),
    updated_at = now()
  returning id into v_id;
  return v_id;
end $function$;

grant execute on function public.f1_fantasy_create_game(bigint, text, jsonb) to authenticated;
