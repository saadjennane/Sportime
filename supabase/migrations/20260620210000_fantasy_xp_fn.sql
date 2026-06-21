-- Recompute xP (expected fantasy points/game) on fantasy_league_players from the last
-- 10 matches in player_match_stats, faithful to the engine scoring table.
create or replace function public.fantasy_recompute_xp(p_league_id uuid default null)
returns int language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
  with pts as (
    select pms.player_id,
      ((case when pms.minutes_played>60 then 1 else 0 end)
       + (case when pms.clean_sheet and pms.minutes_played>60 then
            case upper(left(pms.position,1)) when 'G' then 5 when 'D' then 4 when 'M' then 2 else 0 end else 0 end)
       + coalesce(pms.goals,0)*(case upper(left(pms.position,1)) when 'G' then 8 when 'D' then 6 when 'M' then 5 else 4 end)
       + coalesce(pms.assists,0)*(case upper(left(pms.position,1)) when 'G' then 4 when 'D' then 4 when 'M' then 3 else 2 end)
       + coalesce(pms.shots_on_target,0)*0.5
       + coalesce(pms.saves,0)*(case when upper(left(pms.position,1))='G' then 1.0/3 else 0 end)
       + coalesce(pms.penalties_saved,0)*(case when upper(left(pms.position,1))='G' then 5 else 0 end)
       + coalesce(pms.penalties_missed,0)*-2
       + (case when pms.yellow_card then -1 else 0 end)
       + (case when pms.red_card then -3 else 0 end)
       + coalesce(pms.goals_conceded,0)*(case upper(left(pms.position,1)) when 'G' then -1 when 'D' then -0.5 else 0 end)
       + coalesce(pms.interceptions,0)*(case upper(left(pms.position,1)) when 'G' then 0.3 when 'D' then 0.5 when 'M' then 0.2 else 0 end)
       + coalesce(pms.tackles_total,0)*(case upper(left(pms.position,1)) when 'G' then 0.3 when 'D' then 0.5 when 'M' then 0.2 else 0 end)
       + coalesce(pms.duels_won,0)*(case upper(left(pms.position,1)) when 'G' then 0.2 when 'D' then 0.3 when 'M' then 0.3 else 0.2 end)
       + (coalesce(pms.duels_total,0)-coalesce(pms.duels_won,0))*-0.1
       + coalesce(pms.dribbles_success,0)*(case upper(left(pms.position,1)) when 'D' then 0.2 when 'M' then 0.3 when 'F' then 0.3 else 0 end)
       + coalesce(pms.fouls_committed,0)*-0.3
       + coalesce(pms.fouls_drawn,0)*0.2
      ) * (case upper(left(pms.position,1)) when 'G' then 1.5 when 'D' then 1.3 when 'M' then 1.2 else 1.1 end) as bp,
      row_number() over (partition by pms.player_id order by pms.created_at desc) rn
    from public.player_match_stats pms
  ),
  agg as (select player_id, avg(bp) xp from pts where rn<=10 group by player_id having count(*)>=3)
  update public.fantasy_league_players f set xp = greatest(0, round(agg.xp::numeric,2))
  from agg where f.player_id = agg.player_id and (p_league_id is null or f.league_id = p_league_id);
  get diagnostics n = row_count;
  return n;
end $$;
