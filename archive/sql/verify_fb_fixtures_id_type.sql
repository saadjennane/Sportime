-- Verify the actual type of fb_fixtures.id in the database
SELECT
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_name = 'fb_fixtures'
  AND column_name IN ('id', 'api_id')
ORDER BY column_name;

-- Also check a sample row
SELECT id, api_id, date, status
FROM public.fb_fixtures
LIMIT 3;
