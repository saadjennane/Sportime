-- Phase 1b: settlement-derived squad moments (game_settled + near_miss).
-- Cron-driven & idempotent — NO triggers on settlement tables (a trigger error there
-- would roll back settlement). Activates automatically once squads link games that finish.

-- Squad's standings for a game (top rows), by game_type. Returns ordered jsonb array.
create or replace function public.squad_game_standings(p_squad uuid, p_game uuid, p_type text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v jsonb;
begin
  if p_type in ('betting','prediction') then
    select jsonb_agg(jsonb_build_object('name', u.username, 'score', cp.points, 'user_id', cp.user_id)
                     order by cp.points desc nulls last)
      into v
    from public.challenge_participants cp
    join public.squad_members sm on sm.user_id = cp.user_id and sm.squad_id = p_squad
    join public.users u on u.id = cp.user_id
    where cp.challenge_id = p_game;
  elsif p_type = 'fantasy' then
    select jsonb_agg(jsonb_build_object('name', u.username, 'score', t.score, 'user_id', t.user_id)
                     order by t.score desc nulls last)
      into v
    from (select user_id, sum(total_points) score from public.user_fantasy_teams where game_id = p_game group by user_id) t
    join public.squad_members sm on sm.user_id = t.user_id and sm.squad_id = p_squad
    join public.users u on u.id = t.user_id;
  elsif p_type = 'tournament' then
    select jsonb_agg(jsonb_build_object('name', u.username, 'score', e.total_score, 'user_id', e.user_id)
                     order by e.total_score desc nulls last)
      into v
    from public.tq_entries e
    join public.squad_members sm on sm.user_id = e.user_id and sm.squad_id = p_squad
    join public.users u on u.id = e.user_id
    where e.competition_id = p_game;
  end if;
  return coalesce(v, '[]'::jsonb);
end $$;

-- Scan linked games; for each finished one not yet posted, emit game_settled (+ near_miss).
create or replace function public.squad_emit_due_moments()
returns int language plpgsql security definer set search_path to 'public' as $$
declare r record; rows jsonb; top jsonb; v_name text; v_fin boolean; gap numeric; n int := 0;
begin
  for r in select * from public.squad_games loop
    begin
      if exists (select 1 from public.squad_feed
                 where squad_id = r.squad_id and post_type = 'game_settled' and related_game_id = r.game_id) then
        continue; -- already emitted
      end if;

      v_name := null; v_fin := false;
      if r.game_type in ('betting','prediction') then
        select name, (status in ('finished','resolved') or (end_date is not null and end_date < now()))
          into v_name, v_fin from public.challenges where id = r.game_id;
      elsif r.game_type = 'fantasy' then
        select name, (status = 'Finished' or (end_date is not null and end_date < now()))
          into v_name, v_fin from public.fantasy_games where id = r.game_id;
      elsif r.game_type = 'tournament' then
        select name, (status = 'resolved') into v_name, v_fin from public.tq_competitions where id = r.game_id;
      else
        continue; -- unsupported type
      end if;
      if not coalesce(v_fin, false) then continue; end if;

      rows := public.squad_game_standings(r.squad_id, r.game_id, r.game_type);
      if jsonb_array_length(rows) = 0 then continue; end if;

      top := (select jsonb_agg(e) from (
                select e from jsonb_array_elements(rows) with ordinality as o(e, i) where i <= 3) s);

      insert into public.squad_feed (squad_id, user_id, post_type, content, related_game_id, metadata)
      values (r.squad_id, (rows->0->>'user_id')::uuid, 'game_settled',
              '🏁 ' || coalesce(v_name, 'Game') || ' is settled — ' || (rows->0->>'name') || ' takes 1st 🥇',
              r.game_id, jsonb_build_object('top_players', top));
      n := n + 1;

      -- near_miss: 4th place within ≤2 pts of 3rd
      if jsonb_array_length(rows) >= 4 then
        gap := (rows->2->>'score')::numeric - (rows->3->>'score')::numeric;
        if gap >= 0 and gap <= 2 then
          insert into public.squad_feed (squad_id, user_id, post_type, content, related_game_id)
          values (r.squad_id, (rows->3->>'user_id')::uuid, 'near_miss',
                  '😭 ' || (rows->3->>'name') || ' missed the podium by ' || gap::text || ' pts');
        end if;
      end if;
    exception when others then
      raise notice 'squad_emit_due_moments squad % game %: %', r.squad_id, r.game_id, sqlerrm;
    end;
  end loop;
  return n;
end $$;

grant execute on function public.squad_game_standings(uuid, uuid, text) to service_role;
grant execute on function public.squad_emit_due_moments() to service_role;

-- Schedule every 15 min (pg_cron). Re-creating with the same name updates it.
do $$ begin
  perform cron.schedule('squad-emit-moments', '*/15 * * * *', 'select public.squad_emit_due_moments();');
exception when undefined_function or undefined_table then
  raise notice 'pg_cron not available — call squad_emit_due_moments() from an external scheduler';
end $$;
