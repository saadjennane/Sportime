-- ============================================================================
-- FIX CREATED_BY CONSTRAINT - Make it nullable for API imports
-- ============================================================================
-- Run this SQL in your Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/sql
-- ============================================================================

-- Step 1: Show current constraint
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Checking current created_by constraint...';
  RAISE NOTICE '========================================';
END $$;

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'leagues'
  AND column_name = 'created_by';

-- Step 2: Make created_by nullable
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Making created_by nullable...';

  ALTER TABLE public.leagues
  ALTER COLUMN created_by DROP NOT NULL;

  RAISE NOTICE '✅ created_by is now nullable';
END $$;

-- Step 3: Add comment
COMMENT ON COLUMN public.leagues.created_by IS 'User who created this league. Nullable to allow API imports without authentication.';

-- Step 4: Verify the change
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Verifying change...';
  RAISE NOTICE '========================================';
END $$;

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'leagues'
  AND column_name = 'created_by';

-- Final message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ SUCCESS: created_by column is now nullable';
  RAISE NOTICE 'You can now import leagues without being authenticated.';
  RAISE NOTICE '';
END $$;
