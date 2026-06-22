-- Sportime Fantasy F1 — live scoring. A live tick (edge function f1-fantasy-live)
-- polls the running order every ~60-90s into f1_live_positions, snapshots a
-- progression checkpoint every 10 laps, then calls f1_fantasy_live_score to
-- recompute every roster's live score (no energy change — that happens only at
-- the final settle). Driver scores are floored at 0, same as the final settle.

create table if not exists public.f1_live_positions (
  race_id   bigint not null,
  driver_id bigint not null,
  position  integer, grid integer, laps integer,
  is_fastest_lap boolean default false, is_dnf boolean default false,
  checkpoint_pos integer,                 -- position at the last 10-lap checkpoint
  updated_at timestamptz not null default now(),
  primary key (race_id, driver_id)
);
create table if not exists public.f1_live_state (
  race_id bigint primary key,
  current_lap integer, total_laps integer, last_checkpoint integer not null default 0,
  status text not null default 'live',
  updated_at timestamptz not null default now()
);
alter table public.f1_live_positions enable row level security;
alter table public.f1_live_state enable row level security;
drop policy if exists "live pos readable" on public.f1_live_positions;
create policy "live pos readable" on public.f1_live_positions for select to authenticated using (true);
drop policy if exists "live state readable" on public.f1_live_state;
create policy "live state readable" on public.f1_live_state for select to authenticated using (true);

create or replace function public.f1_fantasy_live_score(p_race_id bigint)
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare v_game uuid; rk record; n int := 0;
begin
  select id into v_game from public.f1_fantasy_games where race_id = p_race_id and status <> 'settled';
  if v_game is null then return 0; end if;
  if not exists (select 1 from public.f1_live_positions where race_id = p_race_id) then return 0; end if;

  for rk in select * from public.f1_fantasy_rosters where game_id = v_game and status = 'pending' for update loop
    declare
      total numeric := 0; drv_bd jsonb := '[]'::jsonb; d bigint;
      pos int; grd int; cpos int; dnf boolean; flap boolean; cons bigint; mate int; cat text;
      fin int; q int; du int; fl int; prog int; base numeric; e0 int; eused int; cap boolean; ds numeric;
      con bigint; ccat text; csum int; p1 int; pod int; pts int; dnfc int; cb int; ce0 int; ceu int; cs numeric; flp_hit boolean;
    begin
      con := rk.constructor_id;
      foreach d in array rk.drivers loop
        select lp.position, lp.grid, lp.checkpoint_pos, lp.is_dnf, lp.is_fastest_lap, dr.constructor_id, dr.category
          into pos, grd, cpos, dnf, flap, cons, cat
          from public.f1_live_positions lp join public.f1_drivers dr on dr.id = lp.driver_id
          where lp.race_id = p_race_id and lp.driver_id = d;
        fin  := public.f1_fantasy_finish_pts(pos, dnf);
        q    := case when coalesce(grd,99)=1 then 8 when coalesce(grd,99)<=3 then 5 when coalesce(grd,99)<=10 then 2 else 0 end;
        select min(l2.position) into mate from public.f1_live_positions l2 join public.f1_drivers d2 on d2.id=l2.driver_id
          where l2.race_id=p_race_id and d2.constructor_id=cons and l2.driver_id<>d;
        du   := case when not coalesce(dnf,false) and mate is not null and pos < mate then 3 else 0 end;
        fl   := case when flap then 5 else 0 end;
        prog := case when cpos is null then 0 else coalesce(grd,20) - cpos end;     -- locked at last 10-lap checkpoint
        base := fin + q + du + fl + prog;
        e0 := coalesce((select energy from public.f1_fantasy_energy where user_id=rk.user_id and entity_type='driver' and entity_id=d), 100);
        eused := least(100, e0 + case when exists (select 1 from jsonb_array_elements(rk.energy_shots) s where s->>'type'='driver' and (s->>'id')::bigint=d) then 10 else 0 end);
        cap := rk.captain_driver_id = d;
        ds := greatest(0, round(base * (eused/100.0) * (case when cap then 2 else 1 end), 1));
        total := total + ds;
        drv_bd := drv_bd || jsonb_build_object('driver',d,'base',base,'energy',eused,'captain',cap,'score',ds,'pos',pos,'grid',grd);
      end loop;

      select category into ccat from public.f1_constructors where id=con;
      select coalesce(sum(public.f1_fantasy_finish_pts(lp.position, lp.is_dnf)),0),
             count(*) filter (where lp.position=1), count(*) filter (where lp.position between 1 and 3),
             count(*) filter (where lp.position between 1 and 10), count(*) filter (where lp.is_dnf)
        into csum, p1, pod, pts, dnfc
        from public.f1_live_positions lp join public.f1_drivers dr on dr.id=lp.driver_id
        where lp.race_id=p_race_id and dr.constructor_id=con;
      cb := (case when p1>=1 then 8 else 0 end)+(case when pod>=2 then 8 else 0 end)+(case when pts>=2 then 6 when pts=1 then 3 else 0 end)+(case when dnfc>=2 then -8 else 0 end);
      ce0 := coalesce((select energy from public.f1_fantasy_energy where user_id=rk.user_id and entity_type='constructor' and entity_id=con), 100);
      ceu := least(100, ce0 + case when exists (select 1 from jsonb_array_elements(rk.energy_shots) s where s->>'type'='constructor' and (s->>'id')::bigint=con) then 10 else 0 end);
      cs := round((csum + cb) * (ceu/100.0), 1);
      total := total + cs;

      flp_hit := rk.flp_driver_id is not null and exists (select 1 from public.f1_live_positions where race_id=p_race_id and driver_id=rk.flp_driver_id and is_fastest_lap);
      if flp_hit then total := total + 15; end if;

      update public.f1_fantasy_rosters set score = total,
        breakdown = jsonb_build_object('drivers',drv_bd,'constructor',cs,'constructor_bonus',cb,'flp',case when flp_hit then 15 else 0 end,'total',total,'live',true),
        updated_at = now() where id = rk.id;
      n := n + 1;
    end;
  end loop;
  update public.f1_fantasy_games set status='live', updated_at=now() where id=v_game and status<>'settled';
  return n;
end $function$;

grant execute on function public.f1_fantasy_live_score(bigint) to authenticated;
