-- ============================================================================
-- VERIFY LEAGUES SYNCHRONIZATION
-- ============================================================================
-- Check that staging and production tables contain the same leagues

-- Show leagues in STAGING (fb_leagues)
SELECT
  'STAGING' as source,
  api_league_id,
  name,
  country
FROM fb_leagues
ORDER BY name;

-- Show leagues in PRODUCTION (leagues)
SELECT
  'PRODUCTION' as source,
  api_league_id,
  name,
  country
FROM leagues
ORDER BY name;

-- Show count comparison
SELECT
  (SELECT COUNT(*) FROM fb_leagues) as staging_count,
  (SELECT COUNT(*) FROM leagues) as production_count;
