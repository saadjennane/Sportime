-- Profile → Stats, reworked to reflect BOTH universes (Football & Formula 1)
-- separately, computed from the user's real activity. Returns jsonb:
--   { username, badges:{count,names}, football:{...}, f1:{...} }
-- The old get_user_profile_stats read a football-only view whose source tables are
-- empty, so every user showed zeros. This function reads the live tables per sport.
create or replace function public.get_profile_stats(p_user_id uuid)
returns jsonb language sql security definer set search_path to 'public' as $function$
  select jsonb_build_object(
    'username', (select username from public.users where id = p_user_id),
    'badges', jsonb_build_object(
      'count', (select count(*) from public.user_badges where user_id = p_user_id),
      'names', coalesce((select array_agg(b.name order by ub.earned_at desc)
                         from public.user_badges ub join public.badges b on b.id = ub.badge_id
                         where ub.user_id = p_user_id), '{}')
    ),
    'football', jsonb_build_object(
      'predictions_total', (select count(*) from public.swipe_predictions where user_id = p_user_id),
      'predictions_correct', coalesce((select sum(case when is_correct then 1 else 0 end) from public.swipe_predictions where user_id = p_user_id), 0),
      'games_played', coalesce((select count(*) from public.challenge_participants where user_id = p_user_id), 0),
      'average_bet', coalesce((select round(avg(cb.amount)) from public.challenge_bets cb
                               join public.challenge_daily_entries cde on cde.id = cb.daily_entry_id
                               join public.challenge_entries ce on ce.id = cde.challenge_entry_id
                               where ce.user_id = p_user_id), 0),
      'gold', coalesce((select count(*) from public.challenge_participants where user_id = p_user_id and rank = 1), 0),
      'silver', coalesce((select count(*) from public.challenge_participants where user_id = p_user_id and rank = 2), 0),
      'bronze', coalesce((select count(*) from public.challenge_participants where user_id = p_user_id and rank = 3), 0),
      'most_played_league', (select l.name from public.swipe_predictions sp
                             join public.fb_fixtures f on f.id = sp.fixture_id
                             join public.fb_leagues l on l.id = f.league_id
                             where sp.user_id = p_user_id group by l.name order by count(*) desc limit 1)
    ),
    'f1', jsonb_build_object(
      'bets_total', (select count(*) filter (where status in ('won','lost')) from public.f1_bets where user_id = p_user_id),
      'bets_won', (select count(*) filter (where status = 'won') from public.f1_bets where user_id = p_user_id),
      'bets_placed', (select count(*) from public.f1_bets where user_id = p_user_id),
      'games_played', coalesce((select count(distinct race_id) from public.f1_bets where user_id = p_user_id), 0)
                    + coalesce((select count(*) from public.f1_duel_picks where user_id = p_user_id), 0)
                    + coalesce((select count(distinct game_id) from public.f1_pred_picks where user_id = p_user_id), 0)
                    + coalesce((select count(*) from public.f1_fantasy_rosters where user_id = p_user_id), 0)
                    + coalesce((select count(*) from public.f1_pred_season_picks where user_id = p_user_id), 0),
      'average_bet', coalesce((select round(avg(stake)) from public.f1_bets where user_id = p_user_id), 0),
      'duels', coalesce((select count(*) from public.f1_duel_picks where user_id = p_user_id), 0),
      'predictor', coalesce((select count(distinct game_id) from public.f1_pred_picks where user_id = p_user_id), 0),
      'fantasy', coalesce((select count(*) from public.f1_fantasy_rosters where user_id = p_user_id), 0),
      'hof', coalesce((select count(*) from public.f1_hof_entries where user_id = p_user_id), 0),
      'last10_accuracy', coalesce((select case when count(*) filter (where status in ('won','lost')) > 0
                                              then round(100.0 * count(*) filter (where status = 'won') / nullif(count(*) filter (where status in ('won','lost')), 0), 0)
                                              else 0 end
                                   from public.f1_bets where user_id = p_user_id and placed_at >= now() - interval '10 days'), 0),
      'favorite_game_type', (select label from (
          select 'F1 Betting' label, (select count(*) from public.f1_bets where user_id = p_user_id) c
          union all select 'Teammate Duels', (select count(*) from public.f1_duel_picks where user_id = p_user_id)
          union all select 'GP Predictor', (select count(distinct game_id) from public.f1_pred_picks where user_id = p_user_id)
          union all select 'Fantasy F1', (select count(*) from public.f1_fantasy_rosters where user_id = p_user_id)
          union all select 'Hall of Fame', (select count(*) from public.f1_hof_entries where user_id = p_user_id)
        ) t where c > 0 order by c desc limit 1)
    )
  );
$function$;

grant execute on function public.get_profile_stats(uuid) to authenticated;
