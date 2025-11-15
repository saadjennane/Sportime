-- ============================================================================
-- CHECK TEAMS FOR DUPLICATES
-- ============================================================================
-- Run this SQL in your Supabase SQL Editor to check for duplicate teams
-- URL: https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/sql
-- ============================================================================

-- Step 1: Check table structure
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'teams'
ORDER BY ordinal_position;

-- Step 2: Count total teams
SELECT
  COUNT(*) as total_teams,
  COUNT(DISTINCT api_id) as unique_by_api_id,
  COUNT(DISTINCT name) as unique_by_name,
  COUNT(*) - COUNT(DISTINCT api_id) as duplicates_by_api_id,
  COUNT(*) - COUNT(DISTINCT name) as duplicates_by_name
FROM public.teams;

-- Step 3: Find duplicates by api_id (API-Football synced teams)
SELECT
  api_id,
  COUNT(*) as count,
  STRING_AGG(name, ', ') as names,
  STRING_AGG(id::text, ', ') as ids
FROM public.teams
WHERE api_id IS NOT NULL
GROUP BY api_id
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Step 4: Find duplicates by name (same name, different api_id or null)
SELECT
  name,
  COUNT(*) as count,
  STRING_AGG(COALESCE(api_id::text, 'NULL'), ', ') as api_ids,
  STRING_AGG(id::text, ', ') as ids
FROM public.teams
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Step 5: Show teams with api_id vs without api_id (manual entries)
SELECT
  'With API ID' as type,
  COUNT(*) as count
FROM public.teams
WHERE api_id IS NOT NULL
UNION ALL
SELECT
  'Without API ID (Manual)' as type,
  COUNT(*) as count
FROM public.teams
WHERE api_id IS NULL;

-- Step 6: Check for teams that have both api_id and null versions
SELECT
  t1.name,
  t1.id as id_with_api,
  t1.api_id,
  t2.id as id_without_api,
  t1.created_at as api_created,
  t2.created_at as manual_created
FROM public.teams t1
JOIN public.teams t2 ON t1.name = t2.name
WHERE t1.api_id IS NOT NULL
  AND t2.api_id IS NULL
ORDER BY t1.name;
