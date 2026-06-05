-- Check if leagues table needs syncing
SELECT
  'fb_leagues (staging)' as table_name,
  COUNT(*) as row_count
FROM fb_leagues

UNION ALL

SELECT
  'leagues (production)' as table_name,
  COUNT(*) as row_count
FROM leagues;

-- Show leagues with api_id
SELECT
  'Leagues with api_id' as info,
  id,
  name,
  api_id
FROM leagues
WHERE api_id IS NOT NULL;

-- Show fb_leagues data
SELECT
  'fb_leagues data' as info,
  api_league_id,
  name,
  country,
  season
FROM fb_leagues;
