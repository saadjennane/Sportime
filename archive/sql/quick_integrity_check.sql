-- ============================================================================
-- QUICK INTEGRITY CHECK - Fast verification script
-- ============================================================================

-- 1. af_leagues deleted?
SELECT
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'af_leagues')
    THEN '✅ af_leagues deleted'
    ELSE '❌ af_leagues still exists'
  END as check_1;

-- 2. No league duplicates?
SELECT
  CASE
    WHEN (SELECT COUNT(*) - COUNT(DISTINCT api_id) FROM leagues WHERE api_id IS NOT NULL) = 0
    THEN '✅ No league duplicates'
    ELSE '❌ ' || (SELECT COUNT(*) - COUNT(DISTINCT api_id) FROM leagues WHERE api_id IS NOT NULL) || ' league duplicates found'
  END as check_2;

-- 3. UNIQUE constraint exists?
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leagues_api_id_unique')
    THEN '✅ UNIQUE constraint on leagues.api_id'
    ELSE '❌ Missing UNIQUE constraint'
  END as check_3;

-- 4. Sync trigger exists?
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_fb_leagues_sync_to_leagues')
    THEN '✅ Sync trigger active'
    ELSE '❌ Missing sync trigger'
  END as check_4;

-- 5. fb_leagues and leagues in sync?
SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM fb_leagues) = (SELECT COUNT(*) FROM leagues WHERE api_id IS NOT NULL)
    THEN '✅ Tables in sync (' || (SELECT COUNT(*) FROM fb_leagues) || ' leagues)'
    ELSE '⚠️ Out of sync: fb_leagues=' || (SELECT COUNT(*) FROM fb_leagues) ||
         ', leagues=' || (SELECT COUNT(*) FROM leagues WHERE api_id IS NOT NULL)
  END as check_5;

-- 6. Teams count
SELECT '📊 Teams: ' || COUNT(*) || ' in fb_teams, ' ||
       (SELECT COUNT(*) FROM teams WHERE api_id IS NOT NULL) || ' in teams' as check_6
FROM fb_teams;

-- 7. Fixtures count
SELECT '📊 Fixtures: ' || COUNT(*) || ' total (' ||
       COUNT(*) FILTER (WHERE date >= NOW()::date) || ' upcoming)' as check_7
FROM fb_fixtures;

-- 8. Players count
SELECT '📊 Players: ' || COUNT(*) || ' in fb_players, ' ||
       (SELECT COUNT(*) FROM players WHERE api_id IS NOT NULL) || ' in players' as check_8
FROM fb_players;

-- OVERALL STATUS
SELECT
  '🎯 OVERALL: ' ||
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'af_leagues')
     AND (SELECT COUNT(*) - COUNT(DISTINCT api_id) FROM leagues WHERE api_id IS NOT NULL) = 0
     AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leagues_api_id_unique')
     AND EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_fb_leagues_sync_to_leagues')
    THEN 'ALL CHECKS PASSED ✅'
    ELSE 'ISSUES DETECTED - Run full audit ⚠️'
  END as overall_status;
