-- ============================================================================
-- CHECK MANUAL TEAMS (WITHOUT API_ID)
-- ============================================================================
-- This script lists all teams that don't have an api_id (manual entries)
-- Run this SQL in your Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/sql
-- ============================================================================

-- Summary: Count of manual teams
SELECT
  COUNT(*) as total_manual_teams
FROM public.teams
WHERE api_id IS NULL;

-- Detailed list: All manual teams with their details
SELECT
  id,
  name,
  country,
  logo,
  created_at,
  updated_at
FROM public.teams
WHERE api_id IS NULL
ORDER BY name;

-- Group by country to see distribution
SELECT
  COALESCE(country, 'Unknown') as country,
  COUNT(*) as team_count,
  STRING_AGG(name, ', ' ORDER BY name) as team_names
FROM public.teams
WHERE api_id IS NULL
GROUP BY country
ORDER BY team_count DESC, country;

-- Check if any manual teams have league associations
SELECT
  t.id,
  t.name,
  t.country,
  COUNT(tlp.league_id) as league_count,
  STRING_AGG(DISTINCT l.name, ', ') as associated_leagues
FROM public.teams t
LEFT JOIN public.team_league_participation tlp ON t.id = tlp.team_id
LEFT JOIN public.leagues l ON tlp.league_id = l.id
WHERE t.api_id IS NULL
GROUP BY t.id, t.name, t.country
ORDER BY league_count DESC, t.name;

-- Check if any manual teams have players
SELECT
  t.id,
  t.name,
  t.country,
  COUNT(pta.player_id) as player_count
FROM public.teams t
LEFT JOIN public.player_team_association pta ON t.id = pta.team_id
WHERE t.api_id IS NULL
GROUP BY t.id, t.name, t.country
ORDER BY player_count DESC, t.name;

-- Final recommendation
DO $$
DECLARE
  manual_count INTEGER;
  teams_with_leagues INTEGER;
  teams_with_players INTEGER;
BEGIN
  SELECT COUNT(*) INTO manual_count FROM public.teams WHERE api_id IS NULL;

  SELECT COUNT(DISTINCT t.id) INTO teams_with_leagues
  FROM public.teams t
  INNER JOIN public.team_league_participation tlp ON t.id = tlp.team_id
  WHERE t.api_id IS NULL;

  SELECT COUNT(DISTINCT t.id) INTO teams_with_players
  FROM public.teams t
  INNER JOIN public.player_team_association pta ON t.id = pta.team_id
  WHERE t.api_id IS NULL;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'MANUAL TEAMS ANALYSIS';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total manual teams: %', manual_count;
  RAISE NOTICE 'Teams with league associations: %', teams_with_leagues;
  RAISE NOTICE 'Teams with player associations: %', teams_with_players;
  RAISE NOTICE '';

  IF teams_with_leagues > 0 OR teams_with_players > 0 THEN
    RAISE NOTICE '⚠️  RECOMMENDATION: Keep these teams (they have associations)';
  ELSE
    RAISE NOTICE '✓ SAFE TO DELETE: No teams have league or player associations';
  END IF;

  RAISE NOTICE '========================================';
END $$;
