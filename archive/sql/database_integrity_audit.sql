-- ============================================================================
-- DATABASE INTEGRITY AUDIT - Complete Verification
-- ============================================================================
-- Comprehensive audit of Sportime database integrity after cleanup

\echo '=========================================='
\echo 'DATABASE INTEGRITY AUDIT'
\echo '=========================================='
\echo ''

-- ============================================================================
-- SECTION 1: TABLES EXISTENCE CHECK
-- ============================================================================
\echo '1. TABLES EXISTENCE CHECK'
\echo '---'

SELECT
  table_name,
  CASE
    WHEN table_name IN ('af_leagues') THEN '❌ Should be deleted'
    WHEN table_name IN ('fb_leagues', 'leagues', 'fb_teams', 'teams', 'fb_fixtures', 'fb_players', 'players') THEN '✅ Core table'
    ELSE '✅ Exists'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'af_leagues', 'fb_leagues', 'leagues',
    'fb_teams', 'teams',
    'fb_fixtures', 'fixtures',
    'fb_players', 'players',
    'users', 'challenges', 'bets'
  )
ORDER BY table_name;

\echo ''

-- ============================================================================
-- SECTION 2: LEAGUES TABLES INTEGRITY
-- ============================================================================
\echo '2. LEAGUES TABLES INTEGRITY'
\echo '---'

-- 2.1: Check af_leagues doesn't exist
SELECT
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'af_leagues')
    THEN '✅ af_leagues successfully deleted'
    ELSE '❌ af_leagues still exists!'
  END as af_leagues_check;

-- 2.2: fb_leagues record count
SELECT
  'fb_leagues' as table_name,
  COUNT(*) as total_records,
  COUNT(DISTINCT api_league_id) as unique_api_ids,
  CASE
    WHEN COUNT(*) = COUNT(DISTINCT api_league_id) THEN '✅ No duplicates'
    ELSE '❌ Has duplicates'
  END as duplicate_check
FROM fb_leagues;

-- 2.3: leagues record count and duplicates
SELECT
  'leagues' as table_name,
  COUNT(*) as total_records,
  COUNT(DISTINCT api_id) as unique_api_ids,
  COUNT(*) - COUNT(DISTINCT api_id) as duplicate_count,
  CASE
    WHEN COUNT(*) = COUNT(DISTINCT api_id) THEN '✅ No duplicates'
    ELSE '❌ Has ' || (COUNT(*) - COUNT(DISTINCT api_id)) || ' duplicates'
  END as duplicate_check
FROM leagues
WHERE api_id IS NOT NULL;

-- 2.4: Check UNIQUE constraint exists
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'leagues_api_id_unique'
        AND conrelid = 'leagues'::regclass
    )
    THEN '✅ UNIQUE constraint on leagues.api_id exists'
    ELSE '❌ UNIQUE constraint missing!'
  END as constraint_check;

-- 2.5: Check sync trigger exists
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.triggers
      WHERE trigger_name = 'on_fb_leagues_sync_to_leagues'
        AND event_object_table = 'fb_leagues'
    )
    THEN '✅ Sync trigger exists'
    ELSE '❌ Sync trigger missing!'
  END as trigger_check;

-- 2.6: Verify fb_leagues and leagues are in sync
WITH sync_check AS (
  SELECT
    COUNT(DISTINCT fl.api_league_id) as fb_count,
    COUNT(DISTINCT l.api_id) as leagues_count
  FROM fb_leagues fl
  LEFT JOIN leagues l ON l.api_id = fl.api_league_id::INTEGER
)
SELECT
  fb_count,
  leagues_count,
  CASE
    WHEN fb_count = leagues_count THEN '✅ Tables are in sync'
    WHEN fb_count > leagues_count THEN '⚠️ fb_leagues has ' || (fb_count - leagues_count) || ' leagues not in leagues table'
    ELSE '⚠️ leagues has orphaned records'
  END as sync_status
FROM sync_check;

\echo ''

-- ============================================================================
-- SECTION 3: TEAMS TABLES INTEGRITY
-- ============================================================================
\echo '3. TEAMS TABLES INTEGRITY'
\echo '---'

-- 3.1: fb_teams record count
SELECT
  'fb_teams' as table_name,
  COUNT(*) as total_records,
  COUNT(DISTINCT id) as unique_ids,
  CASE
    WHEN COUNT(*) = COUNT(DISTINCT id) THEN '✅ No duplicates'
    ELSE '❌ Has duplicates'
  END as duplicate_check
FROM fb_teams;

-- 3.2: teams record count
SELECT
  'teams' as table_name,
  COUNT(*) as total_records,
  COUNT(DISTINCT api_id) as unique_api_ids,
  CASE
    WHEN COUNT(*) = COUNT(DISTINCT api_id) THEN '✅ No duplicates'
    ELSE '❌ Has duplicates'
  END as duplicate_check
FROM teams
WHERE api_id IS NOT NULL;

-- 3.3: Check teams have valid leagues
SELECT
  COUNT(*) as teams_with_invalid_league,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ All teams have valid leagues'
    ELSE '⚠️ ' || COUNT(*) || ' teams with invalid league references'
  END as integrity_check
FROM teams t
WHERE t.league_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM leagues l WHERE l.id = t.league_id);

\echo ''

-- ============================================================================
-- SECTION 4: FIXTURES INTEGRITY
-- ============================================================================
\echo '4. FIXTURES INTEGRITY'
\echo '---'

-- 4.1: fb_fixtures count
SELECT
  'fb_fixtures' as table_name,
  COUNT(*) as total_records,
  COUNT(DISTINCT id) as unique_fixture_ids,
  COUNT(DISTINCT league_id) as unique_leagues,
  CASE
    WHEN COUNT(*) = COUNT(DISTINCT id) THEN '✅ No duplicate fixtures'
    ELSE '❌ Has duplicate fixtures'
  END as duplicate_check
FROM fb_fixtures;

-- 4.2: Check fixtures have valid leagues
SELECT
  COUNT(*) as fixtures_with_invalid_league,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ All fixtures have valid fb_leagues'
    ELSE '⚠️ ' || COUNT(*) || ' fixtures with invalid league references'
  END as integrity_check
FROM fb_fixtures f
WHERE f.league_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM fb_leagues l WHERE l.id = f.league_id);

-- 4.3: Check fixtures have valid teams
SELECT
  COUNT(*) as fixtures_with_invalid_teams,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ All fixtures have valid teams'
    ELSE '⚠️ ' || COUNT(*) || ' fixtures with invalid team references'
  END as integrity_check
FROM fb_fixtures f
WHERE (
  (f.home_team_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM fb_teams WHERE id = f.home_team_id))
  OR
  (f.away_team_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM fb_teams WHERE id = f.away_team_id))
);

\echo ''

-- ============================================================================
-- SECTION 5: PLAYERS INTEGRITY
-- ============================================================================
\echo '5. PLAYERS INTEGRITY'
\echo '---'

-- 5.1: fb_players count
SELECT
  'fb_players' as table_name,
  COUNT(*) as total_records,
  COUNT(DISTINCT id) as unique_player_ids,
  CASE
    WHEN COUNT(*) = COUNT(DISTINCT id) THEN '✅ No duplicates'
    ELSE '❌ Has duplicates'
  END as duplicate_check
FROM fb_players;

-- 5.2: players count
SELECT
  'players' as table_name,
  COUNT(*) as total_records,
  COUNT(DISTINCT api_id) as unique_api_ids,
  CASE
    WHEN COUNT(*) = COUNT(DISTINCT api_id) THEN '✅ No duplicates'
    ELSE '❌ Has duplicates'
  END as duplicate_check
FROM players
WHERE api_id IS NOT NULL;

\echo ''

-- ============================================================================
-- SECTION 6: FOREIGN KEY CONSTRAINTS
-- ============================================================================
\echo '6. FOREIGN KEY CONSTRAINTS CHECK'
\echo '---'

SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  tc.constraint_name,
  '✅' as status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('fb_fixtures', 'leagues', 'teams', 'challenges', 'bets')
ORDER BY tc.table_name, tc.constraint_name;

\echo ''

-- ============================================================================
-- SECTION 7: ORPHANED RECORDS CHECK
-- ============================================================================
\echo '7. ORPHANED RECORDS CHECK'
\echo '---'

-- 7.1: Leagues in production but not in staging
SELECT
  COUNT(*) as orphaned_leagues,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ No orphaned leagues'
    ELSE '⚠️ ' || COUNT(*) || ' leagues in production without fb_leagues source'
  END as check_result
FROM leagues l
WHERE l.api_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM fb_leagues fl
    WHERE fl.api_league_id::INTEGER = l.api_id
  );

-- 7.2: Teams without valid league reference
SELECT
  COUNT(*) as teams_without_league,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ All teams have leagues'
    ELSE '⚠️ ' || COUNT(*) || ' teams without valid league'
  END as check_result
FROM teams t
WHERE t.api_id IS NOT NULL
  AND t.league_id IS NULL;

-- 7.3: Fixtures without matches in current date range
SELECT
  COUNT(*) as old_fixtures,
  CASE
    WHEN COUNT(*) > 1000 THEN '⚠️ ' || COUNT(*) || ' old fixtures (consider cleanup)'
    ELSE '✅ Fixture count reasonable'
  END as check_result
FROM fb_fixtures
WHERE date < NOW() - INTERVAL '30 days';

\echo ''

-- ============================================================================
-- SECTION 8: DATA CONSISTENCY CHECK
-- ============================================================================
\echo '8. DATA CONSISTENCY CHECK'
\echo '---'

-- 8.1: Check for NULL values in critical fields
SELECT 'fb_leagues null check' as check_name,
  COUNT(*) FILTER (WHERE api_league_id IS NULL) as null_api_league_id,
  COUNT(*) FILTER (WHERE name IS NULL) as null_name,
  CASE
    WHEN COUNT(*) FILTER (WHERE api_league_id IS NULL OR name IS NULL) = 0
    THEN '✅ No critical NULLs'
    ELSE '❌ Has NULL values in critical fields'
  END as result
FROM fb_leagues;

SELECT 'leagues null check' as check_name,
  COUNT(*) FILTER (WHERE name IS NULL) as null_name,
  COUNT(*) FILTER (WHERE created_by IS NULL) as null_created_by,
  CASE
    WHEN COUNT(*) FILTER (WHERE name IS NULL) = 0
    THEN '✅ No critical NULLs'
    ELSE '❌ Has NULL values in name'
  END as result
FROM leagues;

-- 8.2: Check for duplicate invite codes
SELECT
  COUNT(*) as duplicate_invite_codes,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ No duplicate invite codes'
    ELSE '⚠️ ' || COUNT(*) || ' duplicate invite codes'
  END as check_result
FROM (
  SELECT invite_code, COUNT(*) as cnt
  FROM leagues
  WHERE invite_code IS NOT NULL
  GROUP BY invite_code
  HAVING COUNT(*) > 1
) dups;

\echo ''

-- ============================================================================
-- SECTION 9: RECORD COUNTS SUMMARY
-- ============================================================================
\echo '9. RECORD COUNTS SUMMARY'
\echo '---'

SELECT 'fb_leagues' as table_name, COUNT(*) as records FROM fb_leagues
UNION ALL
SELECT 'leagues', COUNT(*) FROM leagues
UNION ALL
SELECT 'fb_teams', COUNT(*) FROM fb_teams
UNION ALL
SELECT 'teams', COUNT(*) FROM teams
UNION ALL
SELECT 'fb_fixtures', COUNT(*) FROM fb_fixtures
UNION ALL
SELECT 'fb_players', COUNT(*) FROM fb_players
UNION ALL
SELECT 'players', COUNT(*) FROM players
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'challenges', COUNT(*) FROM challenges
UNION ALL
SELECT 'bets', COUNT(*) FROM bets
ORDER BY table_name;

\echo ''

-- ============================================================================
-- SECTION 10: FINAL SUMMARY
-- ============================================================================
\echo '10. AUDIT SUMMARY'
\echo '---'

WITH audit_summary AS (
  SELECT
    -- Tables existence
    CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'af_leagues')
      THEN 1 ELSE 0 END as af_leagues_deleted,

    -- No duplicates
    CASE WHEN (SELECT COUNT(*) FROM leagues WHERE api_id IS NOT NULL) =
              (SELECT COUNT(DISTINCT api_id) FROM leagues WHERE api_id IS NOT NULL)
      THEN 1 ELSE 0 END as no_league_duplicates,

    -- Constraint exists
    CASE WHEN EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leagues_api_id_unique')
      THEN 1 ELSE 0 END as unique_constraint_exists,

    -- Trigger exists
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.triggers
                      WHERE trigger_name = 'on_fb_leagues_sync_to_leagues')
      THEN 1 ELSE 0 END as sync_trigger_exists,

    -- Tables in sync
    CASE WHEN (SELECT COUNT(DISTINCT api_league_id) FROM fb_leagues) =
              (SELECT COUNT(DISTINCT api_id) FROM leagues WHERE api_id IS NOT NULL)
      THEN 1 ELSE 0 END as tables_in_sync
)
SELECT
  af_leagues_deleted + no_league_duplicates + unique_constraint_exists +
  sync_trigger_exists + tables_in_sync as checks_passed,
  5 as total_checks,
  CASE
    WHEN (af_leagues_deleted + no_league_duplicates + unique_constraint_exists +
          sync_trigger_exists + tables_in_sync) = 5
    THEN '✅ ALL CHECKS PASSED - Database integrity is excellent!'
    WHEN (af_leagues_deleted + no_league_duplicates + unique_constraint_exists +
          sync_trigger_exists + tables_in_sync) >= 4
    THEN '⚠️ MOSTLY GOOD - Minor issues detected'
    ELSE '❌ ISSUES DETECTED - Review audit details above'
  END as overall_status
FROM audit_summary;

\echo ''
\echo '=========================================='
\echo 'AUDIT COMPLETE'
\echo '=========================================='
