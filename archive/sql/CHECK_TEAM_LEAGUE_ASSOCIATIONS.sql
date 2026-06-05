-- ============================================================================
-- CHECK TEAM-LEAGUE ASSOCIATIONS
-- ============================================================================
-- This script checks the state of team-league associations
-- Run this SQL in your Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/sql
-- ============================================================================

-- Step 1: Count leagues
DO $$
BEGIN
  RAISE NOTICE '======================================== LEAGUES OVERVIEW ========================================';
END $$;

SELECT
  id,
  name,
  country_id,
  api_id
FROM public.leagues
ORDER BY name;

-- Step 2: Count teams
DO $$
BEGIN
  RAISE NOTICE 'Step 2: Teams overview...';
END $$;

SELECT
  COUNT(*) as total_teams,
  COUNT(DISTINCT country) as countries
FROM public.teams;

-- Step 3: Check team_league_participation associations
DO $$
BEGIN
  RAISE NOTICE 'Step 3: Checking team-league associations...';
END $$;

SELECT
  COUNT(*) as total_associations,
  COUNT(DISTINCT league_id) as leagues_with_teams,
  COUNT(DISTINCT team_id) as teams_with_leagues
FROM public.team_league_participation;

-- Step 4: Show leagues with their team counts
DO $$
BEGIN
  RAISE NOTICE 'Step 4: Teams per league...';
END $$;

SELECT
  l.name as league_name,
  l.country_id,
  l.api_id as league_api_id,
  COUNT(tlp.team_id) as team_count
FROM public.leagues l
LEFT JOIN public.team_league_participation tlp ON l.id = tlp.league_id
GROUP BY l.id, l.name, l.country_id, l.api_id
ORDER BY team_count DESC, l.name;

-- Step 5: Check if any teams have no league association
DO $$
BEGIN
  RAISE NOTICE 'Step 5: Teams without league associations...';
END $$;

SELECT
  COUNT(*) as teams_without_leagues
FROM public.teams t
WHERE NOT EXISTS (
  SELECT 1 FROM public.team_league_participation tlp
  WHERE tlp.team_id = t.id
);

-- Step 6: Show sample of teams without league associations
SELECT
  t.id,
  t.name,
  t.country,
  t.api_id
FROM public.teams t
WHERE NOT EXISTS (
  SELECT 1 FROM public.team_league_participation tlp
  WHERE tlp.team_id = t.id
)
ORDER BY t.name
LIMIT 20;

-- Step 7: Check for Serie A specifically
DO $$
BEGIN
  RAISE NOTICE 'Step 7: Serie A teams check...';
END $$;

SELECT
  l.name as league_name,
  COUNT(tlp.team_id) as team_count,
  STRING_AGG(t.name, ', ' ORDER BY t.name) as teams
FROM public.leagues l
LEFT JOIN public.team_league_participation tlp ON l.id = tlp.league_id
LEFT JOIN public.teams t ON tlp.team_id = t.id
WHERE l.name ILIKE '%Serie%' OR l.name ILIKE '%Italy%'
GROUP BY l.id, l.name;

-- Step 8: Search for AC Milan
DO $$
BEGIN
  RAISE NOTICE 'Step 8: Searching for AC Milan...';
END $$;

SELECT
  id,
  name,
  country,
  api_id,
  created_at
FROM public.teams
WHERE name ILIKE '%Milan%'
ORDER BY name;

-- Step 9: Final summary
DO $$
DECLARE
  total_leagues INTEGER;
  total_teams INTEGER;
  total_associations INTEGER;
  leagues_with_teams INTEGER;
  teams_without_leagues INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '======================================== SUMMARY ========================================';

  SELECT COUNT(*) INTO total_leagues FROM public.leagues;
  SELECT COUNT(*) INTO total_teams FROM public.teams;
  SELECT COUNT(*) INTO total_associations FROM public.team_league_participation;
  SELECT COUNT(DISTINCT league_id) INTO leagues_with_teams FROM public.team_league_participation;

  SELECT COUNT(*) INTO teams_without_leagues
  FROM public.teams t
  WHERE NOT EXISTS (
    SELECT 1 FROM public.team_league_participation tlp
    WHERE tlp.team_id = t.id
  );

  RAISE NOTICE 'Total leagues: %', total_leagues;
  RAISE NOTICE 'Total teams: %', total_teams;
  RAISE NOTICE 'Total team-league associations: %', total_associations;
  RAISE NOTICE 'Leagues with at least 1 team: %', leagues_with_teams;
  RAISE NOTICE 'Teams without league association: %', teams_without_leagues;
  RAISE NOTICE '';

  IF total_associations = 0 THEN
    RAISE NOTICE '❌ PROBLEM: No team-league associations found!';
    RAISE NOTICE '   Teams and leagues exist but are not linked together.';
    RAISE NOTICE '   You need to populate team_league_participation table.';
  ELSIF teams_without_leagues > 0 THEN
    RAISE NOTICE '⚠️  WARNING: % teams have no league association', teams_without_leagues;
  ELSE
    RAISE NOTICE '✅ All teams are associated with at least one league';
  END IF;

  RAISE NOTICE '========================================';
END $$;
