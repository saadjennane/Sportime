-- ============================================================================
-- REFRESH SUPABASE SCHEMA CACHE
-- ============================================================================
-- This will force PostgREST to reload the schema cache immediately
-- Run this in your Supabase SQL Editor after making schema changes
-- URL: https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/sql
-- ============================================================================

-- Step 1: Verify the columns exist in the database
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Verifying leagues table schema...';
  RAISE NOTICE '========================================';
END $$;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'leagues'
ORDER BY ordinal_position;

-- Step 2: Force schema reload
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Forcing schema cache reload...';
END $$;

-- Send notification to PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- Step 3: Also try reloading config
NOTIFY pgrst, 'reload config';

-- Step 4: Final verification
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Schema cache reload signals sent';
  RAISE NOTICE 'Please wait 10-30 seconds and refresh your admin dashboard';
  RAISE NOTICE '';
  RAISE NOTICE 'If the issue persists, restart the Supabase project:';
  RAISE NOTICE 'Project Settings > General > Restart Project';
  RAISE NOTICE '========================================';
END $$;
