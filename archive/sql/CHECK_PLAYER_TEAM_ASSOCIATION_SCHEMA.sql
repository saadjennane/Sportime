-- ============================================================================
-- CHECK PLAYER_TEAM_ASSOCIATION TABLE SCHEMA
-- ============================================================================

-- Show all columns in player_team_association table
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'player_team_association'
ORDER BY ordinal_position;
