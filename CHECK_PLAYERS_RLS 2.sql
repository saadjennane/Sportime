-- ============================================================================
-- CHECK PLAYERS RLS POLICIES
-- ============================================================================

-- Check if RLS is enabled on players table
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'players';

-- Show all policies on players table
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
  AND tablename = 'players';
