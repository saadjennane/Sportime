-- Profile → Stats v2: simplified, unified shape per universe.
-- Each sport returns the SAME fields so the UI is one component:
--   { predictions_total, predictions_correct, games_played, average_pick, best_rank }
-- Football predictions now read public.match_bets (the real 1X2 betting table) — the
-- previous version read swipe_predictions/challenge_participants which are empty, so
-- users with real football bets saw nothing. Best rank is the user's best finish across
-- ranked games; average_pick is the average coin stake.
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
      'predictions_total', (select count(*) filter (where status in ('won','lost')) from public.match_bets where user_id = p_user_id),
      'predictions_correct', (select count(*) filter (where status = 'won') from public.match_bets where user_id = p_user_id),
      'games_played', coalesce((select count(distinct fixture_id) from public.match_bets where user_id = p_user_id), 0)
                    + coalesce((select count(*) from public.challenge_participants where user_id = p_user_id), 0)
                    + coalesce((select count(*) from public.matchday_participants where user_id = p_user_id), 0)
                    + coalesce((select count(*) from public.tq_entries where user_id = p_user_id), 0)
                    + coalesce((select count(*) from public.live_game_entries where user_id = p_user_id), 0),
      'average_pick', coalesce((select round(avg(amount)) from public.match_bets where user_id = p_user_id), 0),
      'best_rank', nullif(least(
          coalesce((select min(rank) from public.challenge_participants where user_id = p_user_id and rank > 0), 2147483647),
          coalesce((select min(rank) from public.tq_leaderboard where user_id = p_user_id and rank > 0), 2147483647),
          coalesce((select min(rank) from public.live_game_entries where user_id = p_user_id and rank > 0), 2147483647),
          coalesce((select min(rank) from public.fantasy_leaderboard where user_id = p_user_id and rank > 0), 2147483647)
        ), 2147483647)
    ),
    'f1', jsonb_build_object(
      'predictions_total', (select count(*) filter (where status in ('won','lost')) from public.f1_bets where user_id = p_user_id),
      'predictions_correct', (select count(*) filter (where status = 'won') from public.f1_bets where user_id = p_user_id),
      'games_played', coalesce((select count(distinct race_id) from public.f1_bets where user_id = p_user_id), 0)
                    + coalesce((select count(*) from public.f1_duel_picks where user_id = p_user_id), 0)
                    + coalesce((select count(distinct game_id) from public.f1_pred_picks where user_id = p_user_id), 0)
                    + coalesce((select count(*) from public.f1_fantasy_rosters where user_id = p_user_id), 0)
                    + coalesce((select count(*) from public.f1_pred_season_picks where user_id = p_user_id), 0),
      'average_pick', coalesce((select round(avg(stake)) from public.f1_bets where user_id = p_user_id), 0),
      -- F1 has no ranked-game leaderboard yet → best_rank stays null until one exists.
      'best_rank', null
    )
  );
$function$;

grant execute on function public.get_profile_stats(uuid) to authenticated;
