-- ============================================================================
-- CHECK handle_new_league FUNCTION
-- ============================================================================

-- Get the source code of the handle_new_league function
SELECT pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'handle_new_league';
