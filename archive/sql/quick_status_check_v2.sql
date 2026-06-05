-- ============================================================================
-- Quick Status Check V2 - Now includes leagues!
-- ============================================================================

SELECT
  '📊 STAGING TABLES (fb_*)' as category,
  (SELECT COUNT(*) FROM fb_leagues) as leagues,
  (SELECT COUNT(*) FROM fb_teams) as teams,
  (SELECT COUNT(*) FROM fb_players) as players

UNION ALL

SELECT
  '🔄 PHASE 2.5 - Production Sync (api_id populated)' as category,
  (SELECT COUNT(*) FROM leagues WHERE api_id IS NOT NULL) as leagues,
  (SELECT COUNT(*) FROM teams WHERE api_id IS NOT NULL) as teams,
  (SELECT COUNT(*) FROM players WHERE api_id IS NOT NULL) as players

UNION ALL

SELECT
  '⚽ PHASE 3 - Fantasy Stats' as category,
  NULL as leagues,
  (SELECT COUNT(*) FROM player_season_stats) as teams,
  (SELECT COUNT(*) FROM player_match_stats) as players

UNION ALL

SELECT
  '🔄 PHASE 4 - Transfer History' as category,
  NULL as leagues,
  (SELECT COUNT(*) FROM player_transfers) as teams,
  NULL as players;

-- Show overall status
SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM fb_leagues) >= 3 THEN '✅ Phase 1-2: Staging Complete'
    ELSE '❌ Phase 1-2: Staging Incomplete'
  END as phase_1_2,

  CASE
    WHEN (SELECT COUNT(*) FROM leagues WHERE api_id IS NOT NULL) >= 3 AND
         (SELECT COUNT(*) FROM teams WHERE api_id IS NOT NULL) >= 50 AND
         (SELECT COUNT(*) FROM players WHERE api_id IS NOT NULL) >= 1500
    THEN '✅ Phase 2.5: Production Sync Complete (including leagues!)'
    ELSE '❌ Phase 2.5: Production Sync Incomplete'
  END as phase_2_5,

  CASE
    WHEN (SELECT COUNT(*) FROM player_season_stats) >= 1500
    THEN '✅ Phase 3: Season Stats Complete'
    ELSE '❌ Phase 3: Season Stats Incomplete'
  END as phase_3,

  CASE
    WHEN (SELECT COUNT(*) FROM player_transfers) >= 500
    THEN '✅ Phase 4: Transfers Complete'
    ELSE '⚠️ Phase 4: Transfers Incomplete (may be normal if players have few transfers)'
  END as phase_4;
