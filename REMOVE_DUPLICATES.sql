-- ============================================================================
-- REMOVE DUPLICATE LEAGUES
-- ============================================================================
-- Run this SQL in your Supabase SQL Editor to remove duplicate leagues
-- URL: https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/sql
-- ============================================================================

-- Step 0: Check table structure first
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'leagues'
ORDER BY ordinal_position;

-- Step 1: Check for duplicates
SELECT
  api_id,
  COUNT(*) as count,
  STRING_AGG(name, ', ') as names
FROM public.leagues
WHERE api_id IS NOT NULL
GROUP BY api_id
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Step 2A: Remove duplicates by api_id (keeps most recent version)
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

-- Step 2B: Remove manual leagues that have same name as API leagues
-- (Prefer API-synced leagues over manual ones)
DELETE FROM public.leagues
WHERE api_id IS NULL
  AND name IN (
    SELECT DISTINCT name
    FROM public.leagues
    WHERE api_id IS NOT NULL
  );

-- Step 3: Verify cleanup
SELECT
  COUNT(*) AS total_leagues,
  COUNT(DISTINCT api_id) AS unique_api_ids
FROM public.leagues
WHERE api_id IS NOT NULL;

-- Step 4: Show remaining leagues
SELECT
  id,
  name,
  api_id
FROM public.leagues
ORDER BY name;
