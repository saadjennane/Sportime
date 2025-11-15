/*
  Remove Duplicate Leagues

  This migration removes duplicate league entries that were created due to
  the inconsistency between api_league_id and api_id columns.

  Strategy:
  - Keep only ONE league per unique api_id
  - Prefer the most recently updated league
  - Delete all older duplicates
*/

-- Step 1: Show duplicate leagues before cleanup
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) - COUNT(DISTINCT api_id)
  INTO duplicate_count
  FROM public.leagues
  WHERE api_id IS NOT NULL;

  RAISE NOTICE 'Found % duplicate league(s) to remove', duplicate_count;
END $$;

-- Step 2: Delete duplicate leagues, keeping only the most recent one per api_id
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

-- Step 3: Verify cleanup - show remaining leagues
SELECT
  COUNT(*) AS total_leagues,
  COUNT(DISTINCT api_id) AS unique_api_ids,
  COUNT(*) - COUNT(DISTINCT api_id) AS remaining_duplicates
FROM public.leagues
WHERE api_id IS NOT NULL;

-- Step 4: Show the cleaned leagues list
SELECT
  id,
  name,
  api_id,
  country_or_region,
  created_at
FROM public.leagues
ORDER BY name;

COMMENT ON TABLE public.leagues IS 'Football leagues table - cleaned of duplicates on 2025-11-15';
