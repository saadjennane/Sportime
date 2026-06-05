-- Check current RLS policies and permissions for fb_odds table
-- This will help diagnose why 401 errors might still occur

-- 1. Check if RLS is enabled
SELECT '=== 1. RLS Status ===' as step;
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'fb_odds';

-- 2. Check all policies on fb_odds
SELECT '=== 2. Current RLS Policies ===' as step;
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as operation,
  qual as using_expression,
  with_check as check_expression
FROM pg_policies
WHERE tablename = 'fb_odds'
ORDER BY policyname;

-- 3. Check table permissions
SELECT '=== 3. Table Permissions ===' as step;
SELECT
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'fb_odds'
ORDER BY grantee, privilege_type;

-- 4. Check if there are any problematic policies that might interfere
SELECT '=== 4. Policy Details ===' as step;
SELECT
  polname as policy_name,
  polcmd as command,
  polroles::regrole[] as roles,
  polqual as qual,
  polwithcheck as with_check
FROM pg_policy
WHERE polrelid = 'public.fb_odds'::regclass;

-- 5. Test if authenticated role can insert
SELECT '=== 5. Testing Insert Permission ===' as step;
SELECT has_table_privilege('authenticated', 'public.fb_odds', 'INSERT') as can_insert;
SELECT has_table_privilege('authenticated', 'public.fb_odds', 'UPDATE') as can_update;
SELECT has_table_privilege('authenticated', 'public.fb_odds', 'DELETE') as can_delete;
SELECT has_table_privilege('authenticated', 'public.fb_odds', 'SELECT') as can_select;

-- 6. Check for any conflicting policies
SELECT '=== 6. Count of Policies ===' as step;
SELECT COUNT(*) as total_policies FROM pg_policies WHERE tablename = 'fb_odds';

-- 7. Check similar staging tables for comparison
SELECT '=== 7. Compare with other staging tables ===' as step;
SELECT
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN ('fb_odds', 'fb_fixtures', 'fb_teams', 'fb_players', 'fb_leagues')
GROUP BY tablename
ORDER BY tablename;
