-- Check fb_odds table structure and constraints
-- This will help diagnose the 400 Bad Request error

-- 1. Check table structure
SELECT '=== 1. FB_ODDS Table Structure ===' as step;
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'fb_odds'
ORDER BY ordinal_position;

-- 2. Check constraints
SELECT '=== 2. Constraints on FB_ODDS ===' as step;
SELECT
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.fb_odds'::regclass
ORDER BY conname;

-- 3. Check indexes
SELECT '=== 3. Indexes on FB_ODDS ===' as step;
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'fb_odds'
ORDER BY indexname;

-- 4. Check unique constraints specifically
SELECT '=== 4. Unique Constraints ===' as step;
SELECT
  i.relname as index_name,
  a.attname as column_name
FROM pg_class t
JOIN pg_index ix ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
WHERE t.relname = 'fb_odds'
  AND ix.indisunique = true
ORDER BY i.relname, a.attname;

-- 5. Check foreign keys
SELECT '=== 5. Foreign Keys ===' as step;
SELECT
  conname as fk_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE contype = 'f'
  AND conrelid = 'public.fb_odds'::regclass;

-- 6. Sample data from fb_odds (if any)
SELECT '=== 6. Sample Data ===' as step;
SELECT * FROM public.fb_odds LIMIT 3;

-- 7. Check if fixture_id and bookmaker_name columns exist
SELECT '=== 7. Verify Conflict Columns Exist ===' as step;
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'fb_odds'
  AND column_name IN ('fixture_id', 'bookmaker_name');
