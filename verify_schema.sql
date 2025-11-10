-- Verify fb_teams table schema
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'fb_teams'
ORDER BY ordinal_position;

-- Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'fb_teams'
) as table_exists;

-- Get table creation statement (if possible)
SELECT
  'fb_teams' as table_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'fb_teams';
