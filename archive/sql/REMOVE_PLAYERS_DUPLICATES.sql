-- ============================================================================
-- REMOVE DUPLICATE PLAYERS
-- ============================================================================
-- Run this SQL in your Supabase SQL Editor to remove duplicate players
-- URL: https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/sql
-- ============================================================================

-- Step 0: Check table structure first
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'players'
ORDER BY ordinal_position;

-- Step 1: Check for duplicates
SELECT
  api_id,
  COUNT(*) as count,
  STRING_AGG(COALESCE(name, first_name || ' ' || last_name), ', ') as names
FROM public.players
WHERE api_id IS NOT NULL
GROUP BY api_id
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Step 2A: Remove duplicates by api_id (keeps most recent version)
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

-- Step 2B: Remove manual players that have same name as API players
-- (Prefer API-synced players over manual ones)
DELETE FROM public.players
WHERE api_id IS NULL
  AND COALESCE(name, first_name || ' ' || last_name) IN (
    SELECT DISTINCT COALESCE(name, first_name || ' ' || last_name)
    FROM public.players
    WHERE api_id IS NOT NULL
  );

-- Step 3: Verify cleanup
SELECT
  COUNT(*) AS total_players,
  COUNT(DISTINCT api_id) AS unique_api_ids
FROM public.players
WHERE api_id IS NOT NULL;

-- Step 4: Show remaining players (sample)
SELECT
  id,
  COALESCE(name, first_name || ' ' || last_name) as player_name,
  api_id,
  nationality,
  position
FROM public.players
ORDER BY player_name
LIMIT 100;
