/*
  Simple Fantasy Migration Verification
  Shows all results in one query
*/

-- Check 1: Tables count
SELECT
  '1. Tables' as check_name,
  COUNT(*) as count,
  '6 expected' as expected,
  CASE WHEN COUNT(*) = 6 THEN '✅' ELSE '❌' END as status
FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'fantasy%';

-- Check 2: Functions count
SELECT
  '2. Functions' as check_name,
  COUNT(*) as count,
  '5 expected' as expected,
  CASE WHEN COUNT(*) >= 5 THEN '✅' ELSE '❌' END as status
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('check_team_composition', 'calculate_fantasy_leaderboard',
                  'get_available_fantasy_players', 'update_player_fatigue',
                  'get_user_fantasy_team_with_players');

-- Check 3: Boosters
SELECT
  '3. Boosters' as check_name,
  COUNT(*) as count,
  '3 expected' as expected,
  CASE WHEN COUNT(*) >= 3 THEN '✅' ELSE '❌' END as status
FROM fantasy_boosters;

-- Check 4: Game weeks
SELECT
  '4. Game Weeks' as check_name,
  COUNT(*) as count,
  '6 expected' as expected,
  CASE WHEN COUNT(*) >= 6 THEN '✅' ELSE '❌' END as status
FROM fantasy_game_weeks;

-- Check 5: Players
SELECT
  '5. Players' as check_name,
  COUNT(*) as count,
  '13 expected' as expected,
  CASE WHEN COUNT(*) >= 13 THEN '✅' ELSE '❌' END as status
FROM fantasy_players;

-- Check 6: Fantasy games
SELECT
  '6. Fantasy Games' as check_name,
  COUNT(*) as count,
  '1 expected' as expected,
  CASE WHEN COUNT(*) >= 1 THEN '✅' ELSE '❌' END as status
FROM fantasy_games;

-- Check 7: Player stats fields
SELECT
  '7. Stats Fields' as check_name,
  COUNT(*) as count,
  '5 expected' as expected,
  CASE WHEN COUNT(*) = 5 THEN '✅' ELSE '❌' END as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'player_match_stats'
  AND column_name IN ('clean_sheet', 'penalties_saved', 'penalties_missed', 'interceptions', 'passes_key');

-- List all tables
SELECT 'Tables List:' as info, tablename
FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'fantasy%'
ORDER BY tablename;

-- List all functions
SELECT 'Functions List:' as info, proname as function_name
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND (proname LIKE '%fantasy%' OR proname LIKE '%team_composition%')
ORDER BY proname;
