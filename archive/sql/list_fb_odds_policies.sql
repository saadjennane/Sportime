-- List all policies on fb_odds to identify conflicts
SELECT
  policyname,
  cmd as operation,
  roles,
  permissive,
  qual as using_clause,
  with_check as with_check_clause
FROM pg_policies
WHERE tablename = 'fb_odds'
ORDER BY policyname;
