-- Check what type fb_odds.fixture_id actually is
SELECT
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_name = 'fb_odds'
  AND column_name = 'fixture_id';

-- Check foreign key constraints to see what it references
SELECT
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.fb_odds'::regclass
  AND contype = 'f';
