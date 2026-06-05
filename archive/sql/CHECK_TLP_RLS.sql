-- ============================================================================
-- CHECK TEAM_LEAGUE_PARTICIPATION RLS AND CONSTRAINTS
-- ============================================================================

-- Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'team_league_participation';

-- Show all policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'team_league_participation';

-- Check table structure and constraints
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'team_league_participation'
ORDER BY ordinal_position;

-- Check unique constraints
SELECT
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'team_league_participation'::regclass;
