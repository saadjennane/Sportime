-- ============================================================================
-- CHECK LEAGUE_MEMBERS TRIGGERS AND CONSTRAINTS
-- ============================================================================

-- Check if there are any triggers on the leagues table
SELECT
  t.tgname AS trigger_name,
  c.relname AS table_name,
  p.proname AS function_name,
  CASE t.tgtype::integer & 1
    WHEN 1 THEN 'ROW'
    ELSE 'STATEMENT'
  END AS trigger_level,
  CASE t.tgtype::integer & 66
    WHEN 2 THEN 'BEFORE'
    WHEN 64 THEN 'INSTEAD OF'
    ELSE 'AFTER'
  END AS trigger_timing,
  CASE
    WHEN t.tgtype::integer & 4 = 4 THEN 'INSERT'
    WHEN t.tgtype::integer & 8 = 8 THEN 'DELETE'
    WHEN t.tgtype::integer & 16 = 16 THEN 'UPDATE'
  END AS trigger_event
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'leagues'
  AND t.tgname NOT LIKE 'pg_%'
  AND t.tgname NOT LIKE 'RI_%'
ORDER BY t.tgname;

-- Check league_members table structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'league_members'
ORDER BY ordinal_position;

-- Check for triggers on league_members too
SELECT
  t.tgname AS trigger_name,
  c.relname AS table_name,
  p.proname AS function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'league_members'
  AND t.tgname NOT LIKE 'pg_%'
  AND t.tgname NOT LIKE 'RI_%'
ORDER BY t.tgname;
