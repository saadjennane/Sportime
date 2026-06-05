-- ============================================================================
-- MASTER DUPLICATE CLEANUP SCRIPT - Supabase Compatible
-- ============================================================================
-- This script removes all duplicates from Leagues, Teams, and Players
-- Run this SQL in your Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/sql
-- ============================================================================
-- STRATEGY:
-- 1. Keep API-synced entries (with api_id)
-- 2. Remove manual entries (api_id IS NULL) that duplicate API entries
-- 3. For API duplicates (same api_id), keep the most recent (created_at DESC)
-- ============================================================================

-- ============================================================================
-- PART 1: LEAGUES CLEANUP
-- ============================================================================

-- Step 1.1: Check current state
DO $$
BEGIN
  RAISE NOTICE '======================================== PART 1: CLEANING LEAGUES ========================================';
  RAISE NOTICE 'Step 1.1: Current leagues state...';
END $$;

SELECT
  COUNT(*) as total_leagues,
  COUNT(DISTINCT api_id) as unique_by_api_id,
  COUNT(DISTINCT name) as unique_by_name,
  COUNT(*) - COUNT(DISTINCT api_id) as potential_duplicates
FROM public.leagues;

-- Step 1.2: Show duplicates to be removed
DO $$
BEGIN
  RAISE NOTICE 'Step 1.2: Leagues duplicates to be removed...';
END $$;

SELECT
  name,
  COUNT(*) as count,
  STRING_AGG(COALESCE(api_id::text, 'NULL'), ', ') as api_ids
FROM public.leagues
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Step 1.3: Remove API duplicates (same api_id)
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  RAISE NOTICE 'Step 1.3: Removing API league duplicates...';

  DELETE FROM public.leagues
  WHERE id IN (
    SELECT id
    FROM (
      SELECT
        id,
        api_id,
        ROW_NUMBER() OVER (
          PARTITION BY api_id
          ORDER BY created_at DESC
        ) AS row_num
      FROM public.leagues
      WHERE api_id IS NOT NULL
    ) ranked
    WHERE row_num > 1
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '→ Deleted % duplicate API leagues', deleted_count;
END $$;

-- Step 1.4: Remove manual entries that duplicate API entries
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  RAISE NOTICE 'Step 1.4: Removing manual league entries that duplicate API entries...';

  DELETE FROM public.leagues
  WHERE api_id IS NULL
    AND name IN (
      SELECT DISTINCT name
      FROM public.leagues
      WHERE api_id IS NOT NULL
    );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '→ Deleted % manual league duplicates', deleted_count;
END $$;

-- Step 1.5: Verify leagues cleanup
DO $$
BEGIN
  RAISE NOTICE 'Step 1.5: Leagues cleanup verification...';
END $$;

SELECT
  COUNT(*) AS total_leagues,
  COUNT(DISTINCT api_id) AS unique_api_ids,
  COUNT(*) - COUNT(DISTINCT api_id) AS remaining_issues
FROM public.leagues;

DO $$
BEGIN
  RAISE NOTICE '✓ PART 1 COMPLETE: Leagues cleaned!';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 2: TEAMS CLEANUP
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '======================================== PART 2: CLEANING TEAMS ========================================';
  RAISE NOTICE 'Step 2.1: Current teams state...';
END $$;

SELECT
  COUNT(*) as total_teams,
  COUNT(DISTINCT api_id) as unique_by_api_id,
  COUNT(DISTINCT name) as unique_by_name,
  COUNT(*) - COUNT(DISTINCT api_id) as potential_duplicates
FROM public.teams;

-- Step 2.2: Show duplicates to be removed
DO $$
BEGIN
  RAISE NOTICE 'Step 2.2: Teams duplicates to be removed (sample)...';
END $$;

SELECT
  name,
  COUNT(*) as count,
  STRING_AGG(COALESCE(api_id::text, 'NULL'), ', ') as api_ids
FROM public.teams
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY count DESC
LIMIT 20;

-- Step 2.3: Remove API duplicates (same api_id)
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  RAISE NOTICE 'Step 2.3: Removing API team duplicates...';

  DELETE FROM public.teams
  WHERE id IN (
    SELECT id
    FROM (
      SELECT
        id,
        api_id,
        ROW_NUMBER() OVER (
          PARTITION BY api_id
          ORDER BY created_at DESC
        ) AS row_num
      FROM public.teams
      WHERE api_id IS NOT NULL
    ) ranked
    WHERE row_num > 1
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '→ Deleted % duplicate API teams', deleted_count;
END $$;

-- Step 2.4: Remove manual entries that duplicate API entries
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  RAISE NOTICE 'Step 2.4: Removing manual team entries that duplicate API entries...';

  DELETE FROM public.teams
  WHERE api_id IS NULL
    AND name IN (
      SELECT DISTINCT name
      FROM public.teams
      WHERE api_id IS NOT NULL
    );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '→ Deleted % manual team duplicates', deleted_count;
END $$;

-- Step 2.5: Verify teams cleanup
DO $$
BEGIN
  RAISE NOTICE 'Step 2.5: Teams cleanup verification...';
END $$;

SELECT
  COUNT(*) AS total_teams,
  COUNT(DISTINCT api_id) AS unique_api_ids,
  COUNT(*) - COUNT(DISTINCT api_id) AS remaining_issues
FROM public.teams;

DO $$
BEGIN
  RAISE NOTICE '✓ PART 2 COMPLETE: Teams cleaned!';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 3: PLAYERS CLEANUP
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '======================================== PART 3: CLEANING PLAYERS ========================================';
  RAISE NOTICE 'Step 3.1: Current players state...';
END $$;

SELECT
  COUNT(*) as total_players,
  COUNT(DISTINCT api_id) as unique_by_api_id,
  COUNT(*) - COUNT(DISTINCT api_id) as potential_duplicates
FROM public.players;

-- Step 3.2: Show duplicates to be removed
DO $$
BEGIN
  RAISE NOTICE 'Step 3.2: Players duplicates to be removed (sample)...';
END $$;

SELECT
  COALESCE(name, first_name || ' ' || last_name) as player_name,
  COUNT(*) as count,
  STRING_AGG(COALESCE(api_id::text, 'NULL'), ', ') as api_ids
FROM public.players
GROUP BY COALESCE(name, first_name || ' ' || last_name)
HAVING COUNT(*) > 1
ORDER BY count DESC
LIMIT 20;

-- Step 3.3: Remove API duplicates (same api_id)
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  RAISE NOTICE 'Step 3.3: Removing API player duplicates...';

  DELETE FROM public.players
  WHERE id IN (
    SELECT id
    FROM (
      SELECT
        id,
        api_id,
        ROW_NUMBER() OVER (
          PARTITION BY api_id
          ORDER BY created_at DESC
        ) AS row_num
      FROM public.players
      WHERE api_id IS NOT NULL
    ) ranked
    WHERE row_num > 1
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '→ Deleted % duplicate API players', deleted_count;
END $$;

-- Step 3.4: Remove manual entries that duplicate API entries
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  RAISE NOTICE 'Step 3.4: Removing manual player entries that duplicate API entries...';

  DELETE FROM public.players
  WHERE api_id IS NULL
    AND COALESCE(name, first_name || ' ' || last_name) IN (
      SELECT DISTINCT COALESCE(name, first_name || ' ' || last_name)
      FROM public.players
      WHERE api_id IS NOT NULL
    );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '→ Deleted % manual player duplicates', deleted_count;
END $$;

-- Step 3.5: Verify players cleanup
DO $$
BEGIN
  RAISE NOTICE 'Step 3.5: Players cleanup verification...';
END $$;

SELECT
  COUNT(*) AS total_players,
  COUNT(DISTINCT api_id) AS unique_api_ids,
  COUNT(*) - COUNT(DISTINCT api_id) AS remaining_issues
FROM public.players;

DO $$
BEGIN
  RAISE NOTICE '✓ PART 3 COMPLETE: Players cleaned!';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- FINAL SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '======================================== FINAL CLEANUP SUMMARY ========================================';
END $$;

SELECT 'Leagues' as table_name, COUNT(*) as total_records, COUNT(DISTINCT api_id) as unique_api_records
FROM public.leagues
UNION ALL
SELECT 'Teams' as table_name, COUNT(*) as total_records, COUNT(DISTINCT api_id) as unique_api_records
FROM public.teams
UNION ALL
SELECT 'Players' as table_name, COUNT(*) as total_records, COUNT(DISTINCT api_id) as unique_api_records
FROM public.players
ORDER BY table_name;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ CLEANUP COMPLETE!';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Refresh your Admin dashboard (Ctrl+Shift+R)';
  RAISE NOTICE '2. Verify the counts are correct';
  RAISE NOTICE '3. Test creating/editing entries';
  RAISE NOTICE '';
END $$;
