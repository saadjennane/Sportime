-- ============================================================================
-- CHECK TEAMS TABLE SCHEMA
-- ============================================================================

-- Show structure of teams table
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'teams'
ORDER BY ordinal_position;
