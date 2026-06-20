-- Tournament Quest match results weren't reliably synced from fb_fixtures into
-- tq_matches → finished games kept null scores → picks stuck "pending". This adds a
-- result sync and runs it before every resolve.
create or replace function public.tq_sync_results()
returns int language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
  update public.tq_matches m
  set score_a = f.goals_home,
      score_b = f.goals_away,
      status = 'finished',
      winner_team_id = case
        when f.goals_home > f.goals_away then m.team_a_id
        when f.goals_away > f.goals_home then m.team_b_id
        else null end
  from public.fb_fixtures f
  where m.quest_slot_key = 'fx-' || f.api_id
    and f.status in ('FT','AET','PEN')
    and f.goals_home is not null and f.goals_away is not null
    and (m.score_a is distinct from f.goals_home
         or m.score_b is distinct from f.goals_away
         or m.status is distinct from 'finished');
  get diagnostics n = row_count;
  return n;
end $$;

-- Resolve now syncs results first.
create or replace function public.tq_resolve_running()
returns int language plpgsql security definer set search_path to 'public' as $$
declare c record; n int := 0;
begin
  perform public.tq_sync_results();
  for c in select id from public.tq_competitions where status in ('open','running') loop
    perform public.tq_resolve(c.id); n := n + 1;
  end loop;
  return n;
end $$;
