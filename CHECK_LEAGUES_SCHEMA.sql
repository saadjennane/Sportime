-- ============================================================================
-- CHECK ACTUAL LEAGUES TABLE SCHEMA
-- ============================================================================
-- This will show the REAL structure of the leagues table
-- Run this in your Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/sql
-- ============================================================================

-- Show all columns in the leagues table
SELECT
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'leagues'
ORDER BY ordinal_position;

-- Also show constraints
SELECT
  con.conname AS constraint_name,
  con.contype AS constraint_type,
  CASE
    WHEN con.contype = 'f' THEN 'Foreign Key'
    WHEN con.contype = 'p' THEN 'Primary Key'
    WHEN con.contype = 'u' THEN 'Unique'
    WHEN con.contype = 'c' THEN 'Check'
    ELSE con.contype::text
  END AS constraint_description
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'leagues'
  AND rel.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
