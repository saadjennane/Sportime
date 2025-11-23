-- ============================================================================
-- VERIFY INVALID TEAMS BEFORE DELETION
-- ============================================================================
-- This script verifies that manual teams (api_id IS NULL) are safe to delete
-- Run this SQL in your Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/sql
-- ============================================================================

-- Step 1: Count manual teams
DO $$
BEGIN
  RAISE NOTICE '======================================== STEP 1: COUNTING MANUAL TEAMS ========================================';
END $$;

SELECT
  COUNT(*) as total_manual_teams,
  COUNT(CASE WHEN country IS NULL THEN 1 END) as teams_without_country,
  COUNT(CASE WHEN country IS NOT NULL THEN 1 END) as teams_with_country
FROM public.teams
WHERE api_id IS NULL;

-- Step 2: List all manual teams
DO $$
BEGIN
  RAISE NOTICE 'Step 2: Listing all manual teams...';
END $$;

SELECT
  id,
  name,
  COALESCE(country, 'NULL') as country,
  COALESCE(logo, 'NULL') as logo,
  created_at
FROM public.teams
WHERE api_id IS NULL
ORDER BY name
LIMIT 50;

-- Step 3: Check for league associations
DO $$
BEGIN
  RAISE NOTICE 'Step 3: Checking league associations...';
END $$;

SELECT
  COUNT(DISTINCT t.id) as teams_with_leagues,
  COUNT(tlp.id) as total_league_associations
FROM public.teams t
LEFT JOIN public.team_league_participation tlp ON t.id = tlp.team_id
WHERE t.api_id IS NULL
  AND tlp.id IS NOT NULL;

-- Step 4: Check for player associations
DO $$
BEGIN
  RAISE NOTICE 'Step 4: Checking player associations...';
END $$;

SELECT
  COUNT(DISTINCT t.id) as teams_with_players,
  COUNT(pta.id) as total_player_associations
FROM public.teams t
LEFT JOIN public.player_team_association pta ON t.id = pta.team_id
WHERE t.api_id IS NULL
  AND pta.id IS NOT NULL;

-- Step 5: Check for match participation
DO $$
BEGIN
  RAISE NOTICE 'Step 5: Checking match participation...';
END $$;

SELECT
  COUNT(DISTINCT t.id) as teams_in_matches
FROM public.teams t
WHERE t.api_id IS NULL
  AND (
    EXISTS (SELECT 1 FROM public.matches m WHERE m.home_team_id = t.id)
    OR EXISTS (SELECT 1 FROM public.matches m WHERE m.away_team_id = t.id)
  );

-- Step 6: Final safety check
DO $$
DECLARE
  total_manual INTEGER;
  teams_with_leagues INTEGER;
  teams_with_players INTEGER;
  teams_in_matches INTEGER;
  safe_to_delete BOOLEAN;
BEGIN
  RAISE NOTICE '======================================== STEP 6: FINAL SAFETY CHECK ========================================';

  -- Count all manual teams
  SELECT COUNT(*) INTO total_manual
  FROM public.teams
  WHERE api_id IS NULL;

  -- Check league associations
  SELECT COUNT(DISTINCT t.id) INTO teams_with_leagues
  FROM public.teams t
  INNER JOIN public.team_league_participation tlp ON t.id = tlp.team_id
  WHERE t.api_id IS NULL;

  -- Check player associations
  SELECT COUNT(DISTINCT t.id) INTO teams_with_players
  FROM public.teams t
  INNER JOIN public.player_team_association pta ON t.id = pta.team_id
  WHERE t.api_id IS NULL;

  -- Check match participation
  SELECT COUNT(DISTINCT t.id) INTO teams_in_matches
  FROM public.teams t
  WHERE t.api_id IS NULL
    AND (
      EXISTS (SELECT 1 FROM public.matches m WHERE m.home_team_id = t.id)
      OR EXISTS (SELECT 1 FROM public.matches m WHERE m.away_team_id = t.id)
    );

  -- Determine if safe to delete
  safe_to_delete := (teams_with_leagues = 0 AND teams_with_players = 0 AND teams_in_matches = 0);

  RAISE NOTICE '';
  RAISE NOTICE 'VERIFICATION RESULTS:';
  RAISE NOTICE '---------------------';
  RAISE NOTICE 'Total manual teams (api_id IS NULL): %', total_manual;
  RAISE NOTICE 'Teams with league associations: %', teams_with_leagues;
  RAISE NOTICE 'Teams with player associations: %', teams_with_players;
  RAISE NOTICE 'Teams in matches: %', teams_in_matches;
  RAISE NOTICE '';

  IF safe_to_delete THEN
    RAISE NOTICE '✅ SAFE TO DELETE: These % teams have no critical associations', total_manual;
    RAISE NOTICE '   You can run REMOVE_INVALID_TEAMS.sql to delete them';
  ELSE
    RAISE NOTICE '⚠️  WARNING: Some teams have critical associations!';
    RAISE NOTICE '   DO NOT run REMOVE_INVALID_TEAMS.sql until you investigate further';
  END IF;

  RAISE NOTICE '========================================';
END $$;
