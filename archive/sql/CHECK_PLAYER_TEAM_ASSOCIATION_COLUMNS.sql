-- ============================================================================
-- CHECK PLAYER_TEAM_ASSOCIATION TABLE STRUCTURE
-- ============================================================================

-- Check all columns in the table
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'player_team_association'
ORDER BY ordinal_position;

-- Check constraints
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'player_team_association'
ORDER BY tc.constraint_type, kcu.ordinal_position;
