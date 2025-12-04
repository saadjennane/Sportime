-- ============================================================================
-- FIND LEAGUE_MEMBER AUTO-CREATE TRIGGER
-- ============================================================================

-- Find ALL triggers on the leagues table
SELECT
  t.tgname AS trigger_name,
  pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'leagues'
  AND t.tgname NOT LIKE 'pg_%'
  AND t.tgname NOT LIKE 'RI_%'
ORDER BY t.tgname;
