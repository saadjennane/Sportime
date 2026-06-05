-- ============================================================================
-- CLEAN FB_LEAGUES STAGING TABLE
-- ============================================================================
-- This will remove all leagues from staging except Liga (api_league_id = 140)

-- First, show what we're about to delete
SELECT
  id,
  api_league_id,
  name,
  country
FROM fb_leagues
WHERE api_league_id != 140
ORDER BY name;

-- Delete all leagues except Liga
-- Uncomment the line below when ready to execute:
-- DELETE FROM fb_leagues WHERE api_league_id != 140;

-- Verify only Liga remains
SELECT
  id,
  api_league_id,
  name,
  country,
  logo
FROM fb_leagues
ORDER BY name;
