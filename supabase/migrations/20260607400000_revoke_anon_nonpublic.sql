-- ============================================================================
-- Security (pg_graphql_anon_table_exposed): the app authenticates every user
-- (guests via createGuestAccount + signInWithPassword -> role `authenticated`),
-- so anon is only needed for the FIRST catalog fetch on a cold start (no session
-- yet). Keep anon SELECT on the public catalog / reference tables (the games list
-- rendered before the guest session is ready); revoke anon on everything else
-- (user-private, social, internal). We GRANT authenticated first so logged-in
-- reads keep working. User data stays protected by RLS regardless.
-- ============================================================================
DO $$
DECLARE
  r RECORD;
  keep TEXT[] := ARRAY[
    -- challenges / matchday catalog
    'challenges', 'challenge_configs', 'challenge_matchdays', 'challenge_matches',
    'challenge_leagues', 'challenge_required_badges', 'matchday_fixtures', 'matchday_participants',
    'challenge_participants',
    -- football reference data
    'fb_fixtures', 'fb_fixture_stats', 'fb_odds', 'fb_teams', 'fb_leagues', 'fb_players',
    'fb_player_match_stats', 'fb_player_season_stats', 'fb_player_team_association',
    'fb_team_league_participation', 'matches', 'odds', 'fixtures', 'leagues', 'countries',
    -- fantasy catalog / reference
    'fantasy_games', 'fantasy_game_weeks', 'fantasy_configs', 'fantasy_league_players',
    'fantasy_players', 'fantasy_boosters', 'fantasy_leaderboard', 'players', 'teams', 'game_weeks',
    -- live games catalog / limits
    'live_games', 'live_game_tier_limits',
    -- global config / reference
    'badges', 'boosters', 'levels_config', 'game_config', 'app_config'
  ];
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    IF NOT (r.tablename = ANY(keep)) THEN
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated', r.tablename);
      EXECUTE format('REVOKE SELECT ON public.%I FROM anon', r.tablename);
    END IF;
  END LOOP;

  -- Internal/admin views: keep authenticated, drop anon.
  FOR r IN SELECT viewname AS name FROM pg_views WHERE schemaname = 'public'
                  AND viewname IN ('fixture_sync_summary', 'user_profile_stats', 'player_season_stats_combined')
  LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', r.name);
    EXECUTE format('REVOKE SELECT ON public.%I FROM anon', r.name);
  END LOOP;
END $$;
