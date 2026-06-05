-- ============================================================================
-- PHASE 3 STEP 3: RENAME PRODUCTION TABLES TO fb_*
-- ============================================================================
-- This renames production tables to use fb_ prefix for football
-- Prepares architecture for multi-sport (fb_*, bb_*, tn_*, etc.)

-- ============================================================================
-- PREVIEW: Show current production tables
-- ============================================================================

SELECT
  '=== PRODUCTION TABLES TO RENAME ===' as section,
  tablename as current_name,
  'fb_' || tablename as new_name
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'leagues', 'teams', 'players',
    'team_league_participation', 'player_team_association',
    'fixtures', 'odds',
    'player_season_stats', 'player_match_stats', 'player_transfer_history'
  )
ORDER BY tablename;

-- Show row counts
SELECT
  '=== PRODUCTION TABLE ROW COUNTS ===' as section,
  'leagues' as table_name,
  COUNT(*) as row_count
FROM leagues
UNION ALL
SELECT 'COUNTS', 'teams', COUNT(*) FROM teams
UNION ALL
SELECT 'COUNTS', 'players', COUNT(*) FROM players
UNION ALL
SELECT 'COUNTS', 'team_league_participation', COUNT(*) FROM team_league_participation
UNION ALL
SELECT 'COUNTS', 'player_team_association', COUNT(*) FROM player_team_association;

-- ============================================================================
-- STEP 1: Rename Main Entity Tables
-- ============================================================================

-- Rename leagues → fb_leagues
ALTER TABLE leagues RENAME TO fb_leagues;

-- Rename teams → fb_teams
ALTER TABLE teams RENAME TO fb_teams;

-- Rename players → fb_players
ALTER TABLE players RENAME TO fb_players;

-- ============================================================================
-- STEP 2: Rename Association/Junction Tables
-- ============================================================================

-- Rename team_league_participation → fb_team_league_participation
ALTER TABLE team_league_participation RENAME TO fb_team_league_participation;

-- Rename player_team_association → fb_player_team_association
ALTER TABLE player_team_association RENAME TO fb_player_team_association;

-- ============================================================================
-- STEP 3: Rename Fixtures and Odds Tables (if they exist)
-- ============================================================================

-- Check if fixtures table exists and rename
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'fixtures' AND schemaname = 'public') THEN
    EXECUTE 'ALTER TABLE fixtures RENAME TO fb_fixtures';
    RAISE NOTICE 'Table fixtures renamed to fb_fixtures';
  ELSE
    RAISE NOTICE 'Table fixtures does not exist, skipping';
  END IF;
END $$;

-- Check if odds table exists and rename
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'odds' AND schemaname = 'public') THEN
    EXECUTE 'ALTER TABLE odds RENAME TO fb_odds';
    RAISE NOTICE 'Table odds renamed to fb_odds';
  ELSE
    RAISE NOTICE 'Table odds does not exist, skipping';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Rename Statistics Tables
-- ============================================================================

-- Check if player_season_stats exists and rename
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'player_season_stats' AND schemaname = 'public') THEN
    EXECUTE 'ALTER TABLE player_season_stats RENAME TO fb_player_season_stats';
    RAISE NOTICE 'Table player_season_stats renamed to fb_player_season_stats';
  ELSE
    RAISE NOTICE 'Table player_season_stats does not exist, skipping';
  END IF;
END $$;

-- Check if player_match_stats exists and rename
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'player_match_stats' AND schemaname = 'public') THEN
    EXECUTE 'ALTER TABLE player_match_stats RENAME TO fb_player_match_stats';
    RAISE NOTICE 'Table player_match_stats renamed to fb_player_match_stats';
  ELSE
    RAISE NOTICE 'Table player_match_stats does not exist, skipping';
  END IF;
END $$;

-- Check if player_transfer_history exists and rename
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'player_transfer_history' AND schemaname = 'public') THEN
    EXECUTE 'ALTER TABLE player_transfer_history RENAME TO fb_player_transfer_history';
    RAISE NOTICE 'Table player_transfer_history renamed to fb_player_transfer_history';
  ELSE
    RAISE NOTICE 'Table player_transfer_history does not exist, skipping';
  END IF;
END $$;

-- ============================================================================
-- VERIFY: Check renamed tables
-- ============================================================================

-- List all fb_* tables (should show renamed tables)
SELECT
  '=== RENAMED FB_* TABLES ===' as section,
  tablename as table_name,
  schemaname as schema
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'fb_%'
ORDER BY tablename;

-- Show row counts after rename
SELECT
  '=== FB_* TABLE ROW COUNTS AFTER RENAME ===' as section,
  'fb_leagues' as table_name,
  COUNT(*) as row_count
FROM fb_leagues
UNION ALL
SELECT 'COUNTS', 'fb_teams', COUNT(*) FROM fb_teams
UNION ALL
SELECT 'COUNTS', 'fb_players', COUNT(*) FROM fb_players
UNION ALL
SELECT 'COUNTS', 'fb_team_league_participation', COUNT(*) FROM fb_team_league_participation
UNION ALL
SELECT 'COUNTS', 'fb_player_team_association', COUNT(*) FROM fb_player_team_association;

-- Check for any remaining old table names
SELECT
  '=== OLD TABLE NAMES STILL EXISTING ===' as section,
  tablename as table_name
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'leagues', 'teams', 'players',
    'team_league_participation', 'player_team_association'
  )
ORDER BY tablename;

-- ============================================================================
-- EXPECTED RESULT
-- ============================================================================
-- After running this script:
-- - leagues → fb_leagues ✓
-- - teams → fb_teams ✓
-- - players → fb_players ✓
-- - team_league_participation → fb_team_league_participation ✓
-- - player_team_association → fb_player_team_association ✓
-- - Row counts remain the same (1 league, 1 team, 31 players)
-- - Foreign keys still work but need renaming (next step)
