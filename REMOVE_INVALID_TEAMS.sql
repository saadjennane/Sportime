-- ============================================================================
-- REMOVE INVALID TEAMS (WITHOUT API_ID)
-- ============================================================================
-- This script removes all manual teams that have no api_id
-- ⚠️  ONLY RUN THIS AFTER VERIFYING WITH VERIFY_INVALID_TEAMS.SQL
-- Run this SQL in your Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/sql
-- ============================================================================

-- Step 1: Show what will be deleted
DO $$
BEGIN
  RAISE NOTICE '======================================== STEP 1: PREVIEW DELETION ========================================';
  RAISE NOTICE 'Teams that will be deleted:';
END $$;

SELECT
  id,
  name,
  COALESCE(country, 'NULL') as country,
  created_at
FROM public.teams
WHERE api_id IS NULL
ORDER BY name;

-- Step 2: Count before deletion
DO $$
DECLARE
  total_before INTEGER;
  manual_before INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Step 2: Counting teams before deletion...';

  SELECT COUNT(*) INTO total_before FROM public.teams;
  SELECT COUNT(*) INTO manual_before FROM public.teams WHERE api_id IS NULL;

  RAISE NOTICE 'Total teams before: %', total_before;
  RAISE NOTICE 'Manual teams (to be deleted): %', manual_before;
  RAISE NOTICE 'Expected teams after deletion: %', total_before - manual_before;
END $$;

-- Step 3: Safety check - abort if teams have critical associations
DO $$
DECLARE
  teams_with_data INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Step 3: Safety check...';

  -- Check if any manual teams have leagues, players, matches, or bets
  SELECT COUNT(DISTINCT t.id) INTO teams_with_data
  FROM public.teams t
  WHERE t.api_id IS NULL
    AND (
      EXISTS (SELECT 1 FROM public.team_league_participation tlp WHERE tlp.team_id = t.id)
      OR EXISTS (SELECT 1 FROM public.player_team_association pta WHERE pta.team_id = t.id)
      OR EXISTS (SELECT 1 FROM public.matches m WHERE m.home_team_id = t.id OR m.away_team_id = t.id)
    );

  IF teams_with_data > 0 THEN
    RAISE EXCEPTION '❌ ABORT: % teams have critical associations. Do not delete!', teams_with_data;
  ELSE
    RAISE NOTICE '✅ Safety check passed: No critical associations found';
  END IF;
END $$;

-- Step 4: Delete manual teams
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Step 4: Deleting manual teams (api_id IS NULL)...';

  DELETE FROM public.teams
  WHERE api_id IS NULL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '→ Deleted % invalid teams', deleted_count;
END $$;

-- Step 5: Verify deletion
DO $$
DECLARE
  total_after INTEGER;
  manual_after INTEGER;
  api_teams INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Step 5: Verifying deletion...';

  SELECT COUNT(*) INTO total_after FROM public.teams;
  SELECT COUNT(*) INTO manual_after FROM public.teams WHERE api_id IS NULL;
  SELECT COUNT(*) INTO api_teams FROM public.teams WHERE api_id IS NOT NULL;

  RAISE NOTICE 'Total teams after: %', total_after;
  RAISE NOTICE 'Manual teams remaining: %', manual_after;
  RAISE NOTICE 'API teams: %', api_teams;

  IF manual_after = 0 THEN
    RAISE NOTICE '✅ SUCCESS: All invalid teams have been removed!';
  ELSE
    RAISE WARNING '⚠️  WARNING: % manual teams still remain', manual_after;
  END IF;
END $$;

-- Step 6: Show final summary
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '======================================== FINAL SUMMARY ========================================';
END $$;

SELECT
  COUNT(*) as total_teams,
  COUNT(DISTINCT api_id) as unique_api_teams,
  COUNT(CASE WHEN api_id IS NULL THEN 1 END) as manual_teams,
  COUNT(CASE WHEN api_id IS NOT NULL THEN 1 END) as api_teams
FROM public.teams;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ CLEANUP COMPLETE!';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Refresh your Admin dashboard (Ctrl+Shift+R)';
  RAISE NOTICE '2. Verify team count matches expected (should be ~111 teams)';
  RAISE NOTICE '3. All teams should now have valid api_id';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
