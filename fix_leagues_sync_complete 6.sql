/*
  Complete Fix: Populate fb_leagues and Clean Duplicates

  This script does everything in one go:
  1. Shows current state (BEFORE)
  2. Populates fb_leagues from leagues
  3. Cleans duplicates in leagues
  4. Shows final state (AFTER)

  Safe to run multiple times - idempotent.
*/

-- ============================================================================
-- PART 1: SHOW CURRENT STATE (BEFORE)
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '         BEFORE FIX';
  RAISE NOTICE '========================================';
END $$;

-- Show fb_leagues count
SELECT
  'fb_leagues count (BEFORE):' AS metric,
  COUNT(*) AS value
FROM public.fb_leagues;

-- Show leagues count and duplicates
SELECT
  'leagues total (BEFORE):' AS metric,
  COUNT(*) AS value
FROM public.leagues
UNION ALL
SELECT
  'leagues unique api_ids (BEFORE):' AS metric,
  COUNT(DISTINCT api_id) AS value
FROM public.leagues
WHERE api_id IS NOT NULL
UNION ALL
SELECT
  'leagues duplicates (BEFORE):' AS metric,
  COUNT(*) - COUNT(DISTINCT api_id) AS value
FROM public.leagues
WHERE api_id IS NOT NULL;

-- Show duplicate details if any
SELECT
  'DUPLICATE DETAILS (BEFORE):' AS section,
  api_id,
  COUNT(*) AS count,
  STRING_AGG(name, ', ') AS league_names
FROM public.leagues
WHERE api_id IS NOT NULL
GROUP BY api_id
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 10;

-- ============================================================================
-- PART 2: FIX - POPULATE FB_LEAGUES FROM LEAGUES
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '    APPLYING FIX';
  RAISE NOTICE '========================================';
END $$;

-- Disable trigger temporarily to avoid circular updates
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'on_fb_leagues_sync_to_leagues'
      AND event_object_table = 'fb_leagues'
  ) THEN
    EXECUTE 'ALTER TABLE public.fb_leagues DISABLE TRIGGER on_fb_leagues_sync_to_leagues';
  END IF;
END $$;

-- Populate fb_leagues from leagues (only unique api_ids, skip if already exists)
INSERT INTO public.fb_leagues (
  api_league_id,
  name,
  logo,
  country,
  type
)
SELECT DISTINCT ON (l.api_id)
  l.api_id::BIGINT,
  l.name,
  l.logo,
  NULL AS country,
  COALESCE(l.type, 'football_competition')
FROM public.leagues l
WHERE l.api_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.fb_leagues fb
    WHERE fb.api_league_id = l.api_id::BIGINT
  )
ORDER BY l.api_id, l.created_at;

-- Show how many were inserted
SELECT
  'Leagues inserted into fb_leagues:' AS metric,
  COUNT(*) AS value
FROM public.fb_leagues;

-- Re-enable trigger
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'on_fb_leagues_sync_to_leagues'
      AND event_object_table = 'fb_leagues'
  ) THEN
    EXECUTE 'ALTER TABLE public.fb_leagues ENABLE TRIGGER on_fb_leagues_sync_to_leagues';
  END IF;
END $$;

-- ============================================================================
-- PART 3: CLEAN DUPLICATES IN LEAGUES TABLE
-- ============================================================================

-- Delete duplicate leagues, keeping only the oldest one per api_id
DELETE FROM public.leagues
WHERE id IN (
  SELECT l.id
  FROM public.leagues l
  WHERE l.api_id IS NOT NULL
    AND l.id NOT IN (
      -- Keep only the oldest league for each api_id
      SELECT DISTINCT ON (api_id) id
      FROM public.leagues
      WHERE api_id IS NOT NULL
      ORDER BY api_id, created_at ASC
    )
);

-- ============================================================================
-- PART 4: SHOW FINAL STATE (AFTER)
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '         AFTER FIX';
  RAISE NOTICE '========================================';
END $$;

-- Show fb_leagues count
SELECT
  'fb_leagues count (AFTER):' AS metric,
  COUNT(*) AS value
FROM public.fb_leagues;

-- Show leagues count and duplicates
SELECT
  'leagues total (AFTER):' AS metric,
  COUNT(*) AS value
FROM public.leagues
UNION ALL
SELECT
  'leagues unique api_ids (AFTER):' AS metric,
  COUNT(DISTINCT api_id) AS value
FROM public.leagues
WHERE api_id IS NOT NULL
UNION ALL
SELECT
  'leagues duplicates (AFTER):' AS metric,
  COUNT(*) - COUNT(DISTINCT api_id) AS value
FROM public.leagues
WHERE api_id IS NOT NULL;

-- Verify no duplicates remain
SELECT
  'REMAINING DUPLICATES (should be 0):' AS check,
  COUNT(*) AS count
FROM (
  SELECT api_id
  FROM public.leagues
  WHERE api_id IS NOT NULL
  GROUP BY api_id
  HAVING COUNT(*) > 1
) dup;

-- Show sample leagues from both tables
SELECT
  '=== FB_LEAGUES SAMPLE (first 10) ===' AS section;

SELECT
  api_league_id,
  name,
  logo IS NOT NULL AS has_logo
FROM public.fb_leagues
ORDER BY name
LIMIT 10;

SELECT
  '=== LEAGUES SAMPLE (first 10) ===' AS section;

SELECT
  api_id,
  name,
  logo IS NOT NULL AS has_logo
FROM public.leagues
WHERE api_id IS NOT NULL
ORDER BY name
LIMIT 10;

-- Final success message
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '    FIX COMPLETED SUCCESSFULLY!';
  RAISE NOTICE 'Now refresh your app to see leagues in modal';
  RAISE NOTICE '========================================';
END $$;
