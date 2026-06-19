-- =============================================================================
-- Match bets — real, persisted predictions on individual fixtures (Matches page)
-- Replaces the previous local/in-memory quick-bet with a server-backed flow:
--   * persistence + atomic coin deduction
--   * server-side enforcement of the per-level bet limit
--   * automatic settlement when a fixture finishes (pg_cron)
-- Note: fb_fixtures.id is a UUID (api_id holds the numeric API-Football id).
-- =============================================================================

-- 1) Table -------------------------------------------------------------------
create table if not exists public.match_bets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  fixture_id    uuid not null references public.fb_fixtures(id) on delete cascade,
  prediction    text not null check (prediction in ('teamA','draw','teamB')),
  amount        integer not null check (amount > 0),
  odds          numeric(8,2) not null check (odds >= 0),
  potential_win integer not null default 0,
  status        text not null default 'pending' check (status in ('pending','won','lost','void')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  settled_at    timestamptz,
  unique (user_id, fixture_id) -- one bet per match per user
);

create index if not exists idx_match_bets_user    on public.match_bets(user_id);
create index if not exists idx_match_bets_fixture on public.match_bets(fixture_id);
create index if not exists idx_match_bets_status  on public.match_bets(status);

-- 2) RLS ---------------------------------------------------------------------
-- Users may read their own bets. All writes go through the SECURITY DEFINER
-- RPCs below (no direct insert/update/delete policy on purpose).
alter table public.match_bets enable row level security;

drop policy if exists "match_bets_select_own" on public.match_bets;
create policy "match_bets_select_own" on public.match_bets
  for select using (auth.uid() = user_id);

-- 3) Server-side level -> limit (mirrors client getLevelBetLimit) -------------
create or replace function public.match_bet_limit_for_level(p_level text)
returns integer
language plpgsql
immutable
as $$
declare
  v text := lower(trim(coalesce(p_level, '')));
begin
  if v = '' then return 500; end if;
  case v
    when 'rookie'        then return 500;
    when 'rising star'   then return 1000;
    when 'rising_star'   then return 1000;
    when 'pro'           then return 2000;
    when 'elite'         then return 5000;
    when 'expert'        then return 5000;
    when 'legend'        then return 15000;
    when 'master'        then return 40000;
    when 'goat'          then return null; -- unlimited
    else return 500;
  end case;
end;
$$;

-- 4) Place (or modify) a bet — atomic, validates the level limit server-side --
create or replace function public.place_match_bet(
  p_fixture_id uuid,
  p_prediction text,
  p_amount     integer,
  p_odds       numeric
)
returns table(success boolean, new_balance integer, bet_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_level     text;
  v_limit     integer;
  v_balance   integer;
  v_kickoff   timestamptz;
  v_status    text;
  v_existing  public.match_bets%rowtype;
  v_refund    integer := 0;
  v_potential integer;
  v_bet_id    uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_prediction not in ('teamA','draw','teamB') then raise exception 'Invalid prediction'; end if;
  if p_amount <= 0 then raise exception 'Amount must be positive'; end if;

  -- Fixture must exist and not have started yet.
  select date, status into v_kickoff, v_status
    from public.fb_fixtures where id = p_fixture_id;
  if not found then raise exception 'Fixture not found'; end if;
  if v_kickoff <= now() or coalesce(v_status, 'NS') <> 'NS' then
    raise exception 'Match already started';
  end if;

  -- Server-side per-level limit (read the same value the client uses).
  select coalesce(nullif(trim(current_level::text), ''), nullif(trim(level_name::text), ''))
    into v_level from public.users where id = v_user;
  v_limit := public.match_bet_limit_for_level(v_level);
  if v_limit is not null and p_amount > v_limit then
    raise exception 'Amount exceeds your level limit of % coins', v_limit;
  end if;

  -- Existing pending bet on this fixture? It gets refunded then replaced.
  select * into v_existing from public.match_bets
    where user_id = v_user and fixture_id = p_fixture_id for update;
  if found then
    if v_existing.status <> 'pending' then raise exception 'Bet already settled'; end if;
    v_refund := v_existing.amount;
  end if;

  -- Balance check (available = current balance + refund of the old bet).
  select coins_balance into v_balance from public.users where id = v_user for update;
  if (v_balance + v_refund) < p_amount then
    raise exception 'Insufficient balance';
  end if;

  v_potential := ceil(p_amount * p_odds)::integer;

  -- Apply the coin movement atomically.
  update public.users
    set coins_balance = coins_balance + v_refund - p_amount
    where id = v_user
    returning coins_balance into v_balance;

  -- Upsert the bet.
  insert into public.match_bets(user_id, fixture_id, prediction, amount, odds, potential_win, status, updated_at)
    values (v_user, p_fixture_id, p_prediction, p_amount, p_odds, v_potential, 'pending', now())
  on conflict (user_id, fixture_id) do update
    set prediction    = excluded.prediction,
        amount        = excluded.amount,
        odds          = excluded.odds,
        potential_win = excluded.potential_win,
        status        = 'pending',
        updated_at    = now()
  returning id into v_bet_id;

  return query select true, v_balance, v_bet_id;
end;
$$;

-- 5) Cancel a bet — refund if still pending ----------------------------------
create or replace function public.cancel_match_bet(p_fixture_id uuid)
returns table(success boolean, new_balance integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_bet     public.match_bets%rowtype;
  v_balance integer;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  select * into v_bet from public.match_bets
    where user_id = v_user and fixture_id = p_fixture_id for update;
  if not found then raise exception 'Bet not found'; end if;
  if v_bet.status <> 'pending' then raise exception 'Bet already settled'; end if;

  update public.users set coins_balance = coins_balance + v_bet.amount
    where id = v_user returning coins_balance into v_balance;
  delete from public.match_bets where id = v_bet.id;

  return query select true, v_balance;
end;
$$;

-- 6) Settlement — settle pending bets for finished fixtures -------------------
create or replace function public.settle_match_bets(p_fixture_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r         record;
  v_outcome text;
  v_count   integer := 0;
begin
  for r in
    select b.id, b.user_id, b.amount, b.potential_win, b.prediction,
           f.goals_home, f.goals_away
    from public.match_bets b
    join public.fb_fixtures f on f.id = b.fixture_id
    where b.status = 'pending'
      and f.status = 'FT'
      and f.goals_home is not null
      and f.goals_away is not null
      and (p_fixture_id is null or b.fixture_id = p_fixture_id)
    for update of b
  loop
    v_outcome := case
      when r.goals_home > r.goals_away then 'teamA'
      when r.goals_home < r.goals_away then 'teamB'
      else 'draw'
    end;

    if r.prediction = v_outcome then
      update public.match_bets set status = 'won', settled_at = now(), updated_at = now() where id = r.id;
      update public.users set coins_balance = coins_balance + r.potential_win where id = r.user_id;
    else
      update public.match_bets set status = 'lost', settled_at = now(), updated_at = now() where id = r.id;
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- 7) Grants ------------------------------------------------------------------
grant execute on function public.match_bet_limit_for_level(text) to authenticated;
grant execute on function public.place_match_bet(uuid, text, integer, numeric) to authenticated;
grant execute on function public.cancel_match_bet(uuid) to authenticated;
grant execute on function public.settle_match_bets(uuid) to authenticated, service_role;

-- 8) Automatic settlement every 10 minutes (pg_cron, already used for odds) ---
create extension if not exists pg_cron;
do $$
begin
  if exists (select 1 from cron.job where jobname = 'settle-match-bets') then
    perform cron.unschedule('settle-match-bets');
  end if;
  perform cron.schedule('settle-match-bets', '*/10 * * * *', $cron$ select public.settle_match_bets(); $cron$);
exception when others then
  raise notice 'pg_cron scheduling skipped: %', sqlerrm;
end;
$$;
