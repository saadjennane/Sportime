/*
  Fantasy Migration Verification Script

  Run this in Supabase SQL Editor to verify:
  1. All tables exist
  2. All functions exist
  3. RLS policies are active
  4. Seed data is present
*/

-- ============================================================================
-- 1. Check if all Fantasy tables exist
-- ============================================================================

SELECT
  'Tables Check' as check_type,
  tablename,
  CASE
    WHEN tablename IN ('fantasy_players', 'fantasy_games', 'fantasy_game_weeks',
                       'user_fantasy_teams', 'fantasy_boosters', 'fantasy_leaderboard')
    THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'fantasy%'
ORDER BY tablename;

-- ============================================================================
-- 2. Check if all Fantasy functions exist
-- ============================================================================

SELECT
  'Functions Check' as check_type,
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  '✅ EXISTS' as status
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'check_team_composition',
    'calculate_fantasy_leaderboard',
    'get_available_fantasy_players',
    'update_player_fatigue',
    'get_user_fantasy_team_with_players'
  )
ORDER BY proname;

-- ============================================================================
-- 3. Check if RLS is enabled on all tables
-- ============================================================================

SELECT
  'RLS Check' as check_type,
  tablename,
  CASE
    WHEN rowsecurity THEN '✅ ENABLED'
    ELSE '❌ DISABLED'
  END as rls_status
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename AND c.relnamespace = 'public'::regnamespace
WHERE t.schemaname = 'public'
  AND t.tablename LIKE 'fantasy%'
ORDER BY tablename;

-- ============================================================================
-- 4. Check if seed data exists
-- ============================================================================

-- Check boosters
SELECT
  '4A. Boosters' as check_type,
  COUNT(*) as count,
  CASE
    WHEN COUNT(*) >= 3 THEN '✅ OK (3 boosters)'
    ELSE '❌ MISSING DATA'
  END as status
FROM fantasy_boosters;

-- List boosters
SELECT
  '4B. Booster Details' as check_type,
  id,
  name,
  type,
  '✅' as status
FROM fantasy_boosters
ORDER BY id;

-- Check games
SELECT
  '4C. Fantasy Games' as check_type,
  COUNT(*) as count,
  CASE
    WHEN COUNT(*) >= 1 THEN '✅ OK (test game exists)'
    ELSE '❌ MISSING DATA'
  END as status
FROM fantasy_games;

-- Check game weeks
SELECT
  '4D. Game Weeks' as check_type,
  COUNT(*) as count,
  CASE
    WHEN COUNT(*) >= 6 THEN '✅ OK (6 game weeks)'
    ELSE '❌ MISSING DATA'
  END as status
FROM fantasy_game_weeks;

-- Check players
SELECT
  '4E. Fantasy Players' as check_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'Star') as stars,
  COUNT(*) FILTER (WHERE status = 'Key') as keys,
  COUNT(*) FILTER (WHERE status = 'Wild') as wilds,
  CASE
    WHEN COUNT(*) >= 13 THEN '✅ OK (13 players)'
    ELSE '❌ MISSING DATA'
  END as status
FROM fantasy_players;

-- ============================================================================
-- 5. Check if missing stats fields were added to player_match_stats
-- ============================================================================

SELECT
  '5. Player Match Stats Fields' as check_type,
  column_name,
  data_type,
  '✅ EXISTS' as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'player_match_stats'
  AND column_name IN ('clean_sheet', 'penalties_saved', 'penalties_missed', 'interceptions', 'passes_key')
ORDER BY column_name;

-- ============================================================================
-- 6. Test functions
-- ============================================================================

-- Test check_team_composition with a valid team (using actual player IDs from database)
DO $$
DECLARE
  v_player_ids UUID[];
  v_is_valid BOOLEAN;
  v_gk_id UUID;
  v_def_ids UUID[];
  v_mid_ids UUID[];
  v_att_ids UUID[];
BEGIN
  -- Get player IDs for each position
  SELECT id INTO v_gk_id FROM fantasy_players WHERE "position" = 'Goalkeeper' LIMIT 1;
  SELECT ARRAY_AGG(id) INTO v_def_ids FROM (SELECT id FROM fantasy_players WHERE "position" = 'Defender' LIMIT 3) d;
  SELECT ARRAY_AGG(id) INTO v_mid_ids FROM (SELECT id FROM fantasy_players WHERE "position" = 'Midfielder' LIMIT 2) m;
  SELECT ARRAY_AGG(id) INTO v_att_ids FROM (SELECT id FROM fantasy_players WHERE "position" = 'Attacker' LIMIT 1) a;

  -- Combine into single array
  v_player_ids := ARRAY[v_gk_id] || v_def_ids || v_mid_ids || v_att_ids;

  -- Test the function
  v_is_valid := check_team_composition(v_player_ids);

  RAISE NOTICE '6A. Test check_team_composition: % - %',
    CASE WHEN v_is_valid THEN '✅ Function works' ELSE '❌ Function failed' END,
    v_is_valid;
END $$;

-- Test get_available_fantasy_players
SELECT
  '6B. Test get_available_fantasy_players' as check_type,
  COUNT(*) as player_count,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ Returns players'
    ELSE '❌ No players returned'
  END as status
FROM get_available_fantasy_players();

-- ============================================================================
-- 7. Summary
-- ============================================================================

SELECT
  '🎮 FANTASY MIGRATION STATUS' as summary,
  CASE
    WHEN (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'fantasy%') = 6
     AND (SELECT COUNT(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname LIKE '%fantasy%') >= 5
     AND (SELECT COUNT(*) FROM fantasy_boosters) >= 3
     AND (SELECT COUNT(*) FROM fantasy_players) >= 13
    THEN '✅ ALL CHECKS PASSED - Ready to use!'
    ELSE '⚠️ SOME CHECKS FAILED - Review output above'
  END as status;
