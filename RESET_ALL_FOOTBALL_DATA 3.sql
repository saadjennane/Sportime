-- ============================================================================
-- RESET ALL FOOTBALL DATA - CLEAN SLATE
-- ============================================================================
-- ⚠️  WARNING: This script will DELETE ALL football data!
-- Run this SQL in your Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/sql
-- ============================================================================
-- This will allow for a clean reimport with proper associations
-- ============================================================================

-- Step 1: Show current state
DO $$
DECLARE
  total_leagues INTEGER;
  total_teams INTEGER;
  total_players INTEGER;
  total_team_league INTEGER;
  total_player_team INTEGER;
BEGIN
  RAISE NOTICE '======================================== CURRENT STATE ========================================';

  SELECT COUNT(*) INTO total_leagues FROM public.leagues;
  SELECT COUNT(*) INTO total_teams FROM public.teams;
  SELECT COUNT(*) INTO total_players FROM public.players;
  SELECT COUNT(*) INTO total_team_league FROM public.team_league_participation;
  SELECT COUNT(*) INTO total_player_team FROM public.player_team_association;

  RAISE NOTICE 'Leagues: %', total_leagues;
  RAISE NOTICE 'Teams: %', total_teams;
  RAISE NOTICE 'Players: %', total_players;
  RAISE NOTICE 'Team-League associations: %', total_team_league;
  RAISE NOTICE 'Player-Team associations: %', total_player_team;
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  ALL THIS DATA WILL BE DELETED!';
  RAISE NOTICE '========================================';
END $$;

-- Step 2: Delete associations first (to respect foreign keys)
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Step 2: Deleting player-team associations...';

  DELETE FROM public.player_team_association;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '→ Deleted % player-team associations', deleted_count;
END $$;

DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  RAISE NOTICE 'Step 2: Deleting team-league associations...';

  DELETE FROM public.team_league_participation;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '→ Deleted % team-league associations', deleted_count;
END $$;

-- Step 3: Delete players
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Step 3: Deleting all players...';

  DELETE FROM public.players;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '→ Deleted % players', deleted_count;
END $$;

-- Step 4: Delete teams
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Step 4: Deleting all teams...';

  DELETE FROM public.teams;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '→ Deleted % teams', deleted_count;
END $$;

-- Step 5: Delete leagues
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Step 5: Deleting all leagues...';

  DELETE FROM public.leagues;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '→ Deleted % leagues', deleted_count;
END $$;

-- Step 6: Verify deletion
DO $$
DECLARE
  total_leagues INTEGER;
  total_teams INTEGER;
  total_players INTEGER;
  total_team_league INTEGER;
  total_player_team INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '======================================== VERIFICATION ========================================';

  SELECT COUNT(*) INTO total_leagues FROM public.leagues;
  SELECT COUNT(*) INTO total_teams FROM public.teams;
  SELECT COUNT(*) INTO total_players FROM public.players;
  SELECT COUNT(*) INTO total_team_league FROM public.team_league_participation;
  SELECT COUNT(*) INTO total_player_team FROM public.player_team_association;

  RAISE NOTICE 'Leagues remaining: %', total_leagues;
  RAISE NOTICE 'Teams remaining: %', total_teams;
  RAISE NOTICE 'Players remaining: %', total_players;
  RAISE NOTICE 'Team-League associations remaining: %', total_team_league;
  RAISE NOTICE 'Player-Team associations remaining: %', total_player_team;
  RAISE NOTICE '';

  IF total_leagues = 0 AND total_teams = 0 AND total_players = 0 AND total_team_league = 0 AND total_player_team = 0 THEN
    RAISE NOTICE '✅ SUCCESS: All football data has been deleted!';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Use the Admin Dashboard to sync leagues';
    RAISE NOTICE '2. For each league, sync teams';
    RAISE NOTICE '3. For each team, sync players (optional)';
  ELSE
    RAISE WARNING '⚠️  WARNING: Some data still remains!';
  END IF;

  RAISE NOTICE '========================================';
END $$;

-- Final summary
SELECT
  'Leagues' as table_name,
  COUNT(*) as remaining_records
FROM public.leagues
UNION ALL
SELECT
  'Teams' as table_name,
  COUNT(*) as remaining_records
FROM public.teams
UNION ALL
SELECT
  'Players' as table_name,
  COUNT(*) as remaining_records
FROM public.players
UNION ALL
SELECT
  'Team-League Associations' as table_name,
  COUNT(*) as remaining_records
FROM public.team_league_participation
UNION ALL
SELECT
  'Player-Team Associations' as table_name,
  COUNT(*) as remaining_records
FROM public.player_team_association;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ RESET COMPLETE - Database is ready for clean import!';
  RAISE NOTICE '';
END $$;
