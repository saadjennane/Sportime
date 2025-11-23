-- ============================================================================
-- CHECK PLAYERS FOR DUPLICATES
-- ============================================================================
-- Run this SQL in your Supabase SQL Editor to check for duplicate players
-- URL: https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/sql
-- ============================================================================

-- Step 1: Check table structure
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'players'
ORDER BY ordinal_position;

-- Step 2: Count total players
SELECT
  COUNT(*) as total_players,
  COUNT(DISTINCT api_id) as unique_by_api_id,
  COUNT(DISTINCT name) as unique_by_name,
  COUNT(DISTINCT CONCAT(first_name, ' ', last_name)) as unique_by_full_name,
  COUNT(*) - COUNT(DISTINCT api_id) as duplicates_by_api_id
FROM public.players;

-- Step 3: Find duplicates by api_id (API-Football synced players)
SELECT
  api_id,
  COUNT(*) as count,
  STRING_AGG(COALESCE(name, first_name || ' ' || last_name), ', ') as names,
  STRING_AGG(id::text, ', ') as ids
FROM public.players
WHERE api_id IS NOT NULL
GROUP BY api_id
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Step 4: Find duplicates by name
SELECT
  COALESCE(name, first_name || ' ' || last_name) as player_name,
  COUNT(*) as count,
  STRING_AGG(COALESCE(api_id::text, 'NULL'), ', ') as api_ids,
  STRING_AGG(id::text, ', ') as ids
FROM public.players
GROUP BY COALESCE(name, first_name || ' ' || last_name)
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Step 5: Show players with api_id vs without api_id (manual entries)
SELECT
  'With API ID' as type,
  COUNT(*) as count
FROM public.players
WHERE api_id IS NOT NULL
UNION ALL
SELECT
  'Without API ID (Manual)' as type,
  COUNT(*) as count
FROM public.players
WHERE api_id IS NULL;

-- Step 6: Check for players that have both api_id and null versions
SELECT
  COALESCE(t1.name, t1.first_name || ' ' || t1.last_name) as player_name,
  t1.id as id_with_api,
  t1.api_id,
  t2.id as id_without_api,
  t1.created_at as api_created,
  t2.created_at as manual_created
FROM public.players t1
JOIN public.players t2
  ON COALESCE(t1.name, t1.first_name || ' ' || t1.last_name) = COALESCE(t2.name, t2.first_name || ' ' || t2.last_name)
WHERE t1.api_id IS NOT NULL
  AND t2.api_id IS NULL
ORDER BY player_name
LIMIT 50;
