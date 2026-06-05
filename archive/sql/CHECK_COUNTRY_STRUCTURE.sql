-- ============================================================================
-- CHECK COUNTRY STRUCTURE
-- ============================================================================
-- This will show the structure of the countries table and the foreign key
-- ============================================================================

-- Check if there's a countries table
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%countr%';

-- Show the foreign key constraint details
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'leagues'
  AND tc.constraint_name = 'leagues_country_id_fkey';

-- Show sample data from leagues to see what country_id contains
SELECT id, name, country_id
FROM public.leagues
LIMIT 5;
