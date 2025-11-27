-- Check if there's a unique constraint on fixture_id + bookmaker_name

-- Check all unique constraints
SELECT
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.fb_odds'::regclass
  AND contype = 'u'
ORDER BY conname;

-- Also check unique indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'fb_odds'
  AND indexdef LIKE '%UNIQUE%'
ORDER BY indexname;

-- Check all columns in fb_odds
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'fb_odds'
ORDER BY ordinal_position;
