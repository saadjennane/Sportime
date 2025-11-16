-- ============================================================================
-- CHECK COUNTRIES TABLE STRUCTURE
-- ============================================================================

-- Show structure of countries table
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'countries'
ORDER BY ordinal_position;

-- Show existing countries
SELECT *
FROM public.countries
LIMIT 10;

-- Count total countries
SELECT COUNT(*) as total_countries
FROM public.countries;
