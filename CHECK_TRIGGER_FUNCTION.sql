-- ============================================================================
-- CHECK TRIGGER FUNCTION SOURCE CODE
-- ============================================================================

-- Find the trigger function source
SELECT
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname LIKE '%league%member%'
ORDER BY p.proname;

-- Also check for any functions that might auto-create members
SELECT
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (
    pg_get_functiondef(p.oid) ILIKE '%league_members%'
    OR pg_get_functiondef(p.oid) ILIKE '%created_by%'
  )
ORDER BY p.proname;
