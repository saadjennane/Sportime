-- ============================================================================
-- CHECK PLAYERS TABLE SCHEMA
-- ============================================================================

-- Show all columns in players table
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'players'
ORDER BY ordinal_position;
