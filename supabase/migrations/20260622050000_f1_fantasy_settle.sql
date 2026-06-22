-- Sportime Fantasy F1 — scoring engine. Settles a GP from f1_results: per-driver
-- points (finish/quali/duel/fastest lap/progression) × energy × captain, plus the
-- constructor score and the Fastest-Lap-Prediction booster. Then updates the
-- per-user energy ledger (depletion on fielded entities, +10 recovery elsewhere).

create or replace function public.f1_fantasy_finish_pts(p_pos int, p_dnf boolean)
returns int language sql immutable as $function$
  select case when p_dnf or p_pos is null then 0
    when p_pos=1 then 25 when p_pos=2 then 20 when p_pos=3 then 16 when p_pos=4 then 13
    when p_pos=5 then 11 when p_pos=6 then 10 when p_pos=7 then 9 when p_pos=8 then 8
    when p_pos=9 then 7 when p_pos=10 then 6 when p_pos between 11 and 15 then 3
    when p_pos between 16 and 22 then 1 else 0 end
$function$;

create or replace function public.f1_fantasy_settle_race(p_race_id bigint)
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare v_game uuid; rk record; n int := 0;
begin
  select id into v_game from public.f1_fantasy_games where race_id = p_race_id and status <> 'settled';
  if v_game is null then return 0; end if;
  if not exists (select 1 from public.f1_results where race_id = p_race_id) then return 0; end if;

  for rk in select * from public.f1_fantasy_rosters where game_id = v_game and status = 'pending' for update loop
    declare
      total numeric := 0; drv_bd jsonb := '[]'::jsonb; d bigint;
      pos int; grd int; dnf boolean; pole boolean; flap boolean; cons bigint; mate_pos int; cat text;
      fin int; qpts int; dpts int; fpts int; prog int; base numeric; e0 int; eused int; depl int; cap boolean; dscore numeric;
      con bigint; ccat text; csum int; p1c int; pod int; pts int; dnfc int; cbonus int; ce0 int; ceused int; cdepl int; cscore numeric;
      flp_hit boolean;
    begin
      con := rk.constructor_id;
      foreach d in array rk.drivers loop
        select res.position, res.grid, res.is_dnf, res.is_pole, res.is_fastest_lap, dr.constructor_id, dr.category
          into pos, grd, dnf, pole, flap, cons, cat
          from public.f1_results res join public.f1_drivers dr on dr.id = res.driver_id
          where res.race_id = p_race_id and res.driver_id = d;
        fin  := public.f1_fantasy_finish_pts(pos, dnf);
        qpts := case when pole then 8 when coalesce(grd,99) <= 3 then 5 when coalesce(grd,99) <= 10 then 2 else 0 end;
        select min(res2.position) into mate_pos from public.f1_results res2 join public.f1_drivers dr2 on dr2.id = res2.driver_id
          where res2.race_id = p_race_id and dr2.constructor_id = cons and res2.driver_id <> d;
        dpts := case when not coalesce(dnf,false) and mate_pos is not null and pos < mate_pos then 3 else 0 end;
        fpts := case when flap then 5 else 0 end;
        prog := case when coalesce(dnf,false) then 0 else coalesce(grd,20) - coalesce(pos,20) end;
        base := fin + qpts + dpts + fpts + prog;
        e0 := coalesce((select energy from public.f1_fantasy_energy where user_id=rk.user_id and entity_type='driver' and entity_id=d), 100);
        eused := least(100, e0 + case when exists (select 1 from jsonb_array_elements(rk.energy_shots) s where s->>'type'='driver' and (s->>'id')::bigint=d) then 10 else 0 end);
        cap := rk.captain_driver_id = d;
        -- Floor each driver's banked score at 0 (a disastrous GP = 0, never negative;
        -- the captain ×2 can therefore never penalise). Live progression may still show
        -- a negative delta during the race for drama.
        dscore := greatest(0, round(base * (eused/100.0) * (case when cap then 2 else 1 end), 1));
        total := total + dscore;
        drv_bd := drv_bd || jsonb_build_object('driver', d, 'base', base, 'energy', eused, 'captain', cap, 'score', dscore);
        depl := case cat when 'elite' then 30 when 'confirmed' then 20 else 10 end;
        insert into public.f1_fantasy_energy(user_id, entity_type, entity_id, energy, updated_at)
          values (rk.user_id, 'driver', d, greatest(0, eused - depl), now())
          on conflict (user_id, entity_type, entity_id) do update set energy = excluded.energy, updated_at = now();
      end loop;

      -- constructor: its two drivers' finish points + bonuses, × energy
      select category into ccat from public.f1_constructors where id = con;
      select coalesce(sum(public.f1_fantasy_finish_pts(res.position, res.is_dnf)),0),
             count(*) filter (where res.position = 1),
             count(*) filter (where res.position between 1 and 3),
             count(*) filter (where res.position between 1 and 10),
             count(*) filter (where res.is_dnf)
        into csum, p1c, pod, pts, dnfc
        from public.f1_results res join public.f1_drivers dr on dr.id = res.driver_id
        where res.race_id = p_race_id and dr.constructor_id = con;
      cbonus := (case when p1c >= 1 then 8 else 0 end) + (case when pod >= 2 then 8 else 0 end)
              + (case when pts >= 2 then 6 when pts = 1 then 3 else 0 end) + (case when dnfc >= 2 then -8 else 0 end);
      ce0 := coalesce((select energy from public.f1_fantasy_energy where user_id=rk.user_id and entity_type='constructor' and entity_id=con), 100);
      ceused := least(100, ce0 + case when exists (select 1 from jsonb_array_elements(rk.energy_shots) s where s->>'type'='constructor' and (s->>'id')::bigint=con) then 10 else 0 end);
      cscore := round((csum + cbonus) * (ceused/100.0), 1);
      total := total + cscore;
      cdepl := case ccat when 'elite' then 40 when 'confirmed' then 20 else 10 end;
      insert into public.f1_fantasy_energy(user_id, entity_type, entity_id, energy, updated_at)
        values (rk.user_id, 'constructor', con, greatest(0, ceused - cdepl), now())
        on conflict (user_id, entity_type, entity_id) do update set energy = excluded.energy, updated_at = now();

      -- Fastest-Lap-Prediction booster
      flp_hit := rk.flp_driver_id is not null and exists (select 1 from public.f1_results where race_id = p_race_id and driver_id = rk.flp_driver_id and is_fastest_lap);
      if flp_hit then total := total + 15; end if;

      -- recover +10 on this user's other tracked entities (not fielded here)
      update public.f1_fantasy_energy set energy = least(100, energy + 10), updated_at = now()
        where user_id = rk.user_id
          and not ((entity_type='driver' and entity_id = any(rk.drivers)) or (entity_type='constructor' and entity_id = con));

      update public.f1_fantasy_rosters set score = total,
        breakdown = jsonb_build_object('drivers', drv_bd, 'constructor', cscore, 'constructor_bonus', cbonus, 'flp', case when flp_hit then 15 else 0 end, 'total', total),
        status = 'settled', settled_at = now(), updated_at = now() where id = rk.id;
      n := n + 1;
    end;
  end loop;

  update public.f1_fantasy_games set status = 'settled', settled_at = now(), updated_at = now() where id = v_game;
  return n;
end $function$;

create or replace function public.f1_fantasy_leaderboard(p_game_id uuid)
returns table(user_id uuid, username text, avatar text, score numeric, rank bigint)
language sql security definer set search_path to 'public' as $function$
  select r.user_id, u.username, u.profile_picture_url, coalesce(r.score,0),
    rank() over (order by coalesce(r.score,0) desc, r.created_at asc)
  from public.f1_fantasy_rosters r join public.users u on u.id = r.user_id
  where r.game_id = p_game_id order by coalesce(r.score,0) desc, r.created_at asc;
$function$;

grant execute on function public.f1_fantasy_settle_race(bigint) to authenticated;
grant execute on function public.f1_fantasy_leaderboard(uuid) to authenticated;
