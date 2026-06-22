-- ============================================================================
-- Sportime Fantasy F1 — Phase 1 schema. A game per GP with a "condition" (the
-- required driver-category mix), per-user rosters (3 drivers + 1 constructor +
-- boosters), and a per-user energy ledger (freshness 0-100% per entity).
-- Categories come from f1_fantasy_recalc_categories (Performance Rating).
-- ============================================================================

create table if not exists public.f1_fantasy_games (
  id          uuid primary key default gen_random_uuid(),
  race_id     bigint not null references public.f1_races(id) on delete cascade,
  condition   text not null default 'standard',          -- standard|no_stars|double_star|underdog|constructor_chaos|free
  rule        jsonb not null default '{}'::jsonb,         -- {drivers:{elite,confirmed,outsider}|null, constructor_block:'elite'|null}
  status      text not null default 'open',               -- open|locked|live|settled
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  settled_at  timestamptz,
  updated_at  timestamptz not null default now(),
  unique (race_id)
);

create table if not exists public.f1_fantasy_rosters (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references public.f1_fantasy_games(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  drivers       bigint[] not null default '{}',           -- exactly 3
  constructor_id bigint,
  captain_driver_id bigint,
  flp_driver_id bigint,                                   -- fastest-lap prediction
  energy_shots  jsonb not null default '[]'::jsonb,       -- [{type:'driver'|'constructor', id}]
  score         numeric, breakdown jsonb, status text not null default 'pending',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  settled_at    timestamptz,
  unique (game_id, user_id)
);

create table if not exists public.f1_fantasy_energy (
  user_id     uuid not null references public.users(id) on delete cascade,
  entity_type text not null,                              -- driver|constructor
  entity_id   bigint not null,
  energy      integer not null default 100,
  updated_at  timestamptz not null default now(),
  primary key (user_id, entity_type, entity_id)
);

alter table public.f1_fantasy_games enable row level security;
alter table public.f1_fantasy_rosters enable row level security;
alter table public.f1_fantasy_energy enable row level security;
drop policy if exists "ff games readable" on public.f1_fantasy_games;
create policy "ff games readable" on public.f1_fantasy_games for select to authenticated using (true);
drop policy if exists "ff rosters own" on public.f1_fantasy_rosters;
create policy "ff rosters own" on public.f1_fantasy_rosters for select to authenticated using (user_id = auth.uid());
drop policy if exists "ff energy own" on public.f1_fantasy_energy;
create policy "ff energy own" on public.f1_fantasy_energy for select to authenticated using (user_id = auth.uid());

-- Build (or fetch) the fantasy game for a race with a given condition.
create or replace function public.f1_fantasy_create_game(p_race_id bigint, p_condition text)
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
  insert into public.f1_fantasy_games (race_id, condition, rule)
    values (p_race_id, p_condition, v_rule)
  on conflict (race_id) do update set condition = excluded.condition, rule = excluded.rule, updated_at = now()
  returning id into v_id;
  return v_id;
end $function$;

-- Save a roster. Enforces the GP condition (category mix), constructor block,
-- captain caps (≤2/season per driver, 1/GP) and energy-shot limits.
create or replace function public.f1_fantasy_save_roster(
  p_game_id uuid, p_drivers bigint[], p_constructor bigint,
  p_captain bigint, p_flp bigint, p_energy_shots jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  v_user uuid := auth.uid(); v_race bigint; v_quali timestamptz; v_status text; v_rule jsonb; v_season int;
  v_e int; v_c int; v_o int; v_need jsonb; v_block text; v_capcount int; v_shots int; sh jsonb;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  select g.race_id, g.status, g.rule, r.quali_start_at, r.season
    into v_race, v_status, v_rule, v_quali, v_season
    from public.f1_fantasy_games g join public.f1_races r on r.id = g.race_id where g.id = p_game_id;
  if v_race is null then raise exception 'Game not found'; end if;
  if v_status = 'settled' then raise exception 'Game already settled'; end if;
  if v_quali is not null and v_quali <= now() then raise exception 'Locked (qualifying started)'; end if;
  if array_length(p_drivers,1) is distinct from 3 then raise exception 'Pick exactly 3 drivers'; end if;
  if (select count(distinct d) from unnest(p_drivers) d) <> 3 then raise exception 'Drivers must be distinct'; end if;
  if p_constructor is null then raise exception 'Pick a constructor'; end if;

  -- category mix
  select count(*) filter (where category='elite'), count(*) filter (where category='confirmed'), count(*) filter (where category='outsider')
    into v_e, v_c, v_o from public.f1_drivers where id = any(p_drivers);
  v_need := v_rule->'drivers';
  if v_need is not null and v_need <> 'null'::jsonb then
    if v_e <> (v_need->>'elite')::int or v_c <> (v_need->>'confirmed')::int or v_o <> (v_need->>'outsider')::int then
      raise exception 'Composition must be % Elite / % Confirmed / % Outsider', v_need->>'elite', v_need->>'confirmed', v_need->>'outsider';
    end if;
  end if;
  -- constructor block
  v_block := v_rule->>'constructor_block';
  if v_block is not null and exists (select 1 from public.f1_constructors where id = p_constructor and category = v_block) then
    raise exception 'This GP blocks % constructors', v_block;
  end if;

  -- captain must be one of the 3, ≤ 2 times per season per driver
  if p_captain is not null then
    if not (p_captain = any(p_drivers)) then raise exception 'Captain must be one of your drivers'; end if;
    select count(*) into v_capcount from public.f1_fantasy_rosters fr
      join public.f1_fantasy_games g on g.id = fr.game_id
      join public.f1_races r on r.id = g.race_id
      where fr.user_id = v_user and fr.captain_driver_id = p_captain and r.season = v_season and fr.game_id <> p_game_id;
    if v_capcount >= 2 then raise exception 'Captain already used twice on this driver this season'; end if;
  end if;

  -- energy shots: ≤ 4 / season, one per entity / season
  if p_energy_shots is not null and jsonb_array_length(p_energy_shots) > 0 then
    select count(*) into v_shots from public.f1_fantasy_rosters fr
      join public.f1_fantasy_games g on g.id = fr.game_id join public.f1_races r on r.id = g.race_id
      where fr.user_id = v_user and r.season = v_season and fr.game_id <> p_game_id
        and jsonb_array_length(fr.energy_shots) > 0;
    if v_shots + jsonb_array_length(p_energy_shots) > 4 then raise exception 'Max 4 Energy Shots per season'; end if;
  end if;

  insert into public.f1_fantasy_rosters (game_id, user_id, drivers, constructor_id, captain_driver_id, flp_driver_id, energy_shots, status, updated_at)
    values (p_game_id, v_user, p_drivers, p_constructor, p_captain, p_flp, coalesce(p_energy_shots,'[]'::jsonb), 'pending', now())
  on conflict (game_id, user_id) do update
    set drivers = excluded.drivers, constructor_id = excluded.constructor_id, captain_driver_id = excluded.captain_driver_id,
        flp_driver_id = excluded.flp_driver_id, energy_shots = excluded.energy_shots, updated_at = now()
    where public.f1_fantasy_rosters.status = 'pending';
  return jsonb_build_object('ok', true);
end $function$;

grant execute on function public.f1_fantasy_create_game(bigint, text) to authenticated;
grant execute on function public.f1_fantasy_save_roster(uuid, bigint[], bigint, bigint, bigint, jsonb) to authenticated;
