-- ============================================================================
-- CHECK TEAMS RLS POLICIES
-- ============================================================================

-- Check if RLS is enabled on teams table
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'teams';

-- Show all policies on teams table
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
  AND tablename = 'teams';
