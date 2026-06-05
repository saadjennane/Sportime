-- ============================================================================
-- PHASE 3 STEP 4: FIX FOREIGN KEYS AFTER TABLE RENAME
-- ============================================================================
-- After renaming tables (leagues → fb_leagues, etc.), the foreign key
-- constraints still reference the old table names, causing Supabase
-- relationship errors.
--
-- Error: "Could not find a relationship between 'fb_fixtures' and 'fb_leagues'"
--
-- This script:
-- 1. Identifies all FK constraints referencing old table names
-- 2. Drops old constraints
-- 3. Creates new constraints with correct table references

-- ============================================================================
-- DIAGNOSTIC: List all foreign key constraints
-- ============================================================================

SELECT
  '=== ALL FOREIGN KEY CONSTRAINTS ===' as section,
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND (
    tc.table_name LIKE 'fb_%'
    OR ccu.table_name LIKE 'fb_%'
    OR ccu.table_name IN ('leagues', 'teams', 'players', 'fixtures')
  )
ORDER BY tc.table_name, tc.constraint_name;

-- ============================================================================
-- Check if fb_fixtures table exists
-- ============================================================================

SELECT
  '=== FB_FIXTURES TABLE INFO ===' as section,
  tablename,
  schemaname
FROM pg_tables
WHERE tablename = 'fb_fixtures' AND schemaname = 'public';

-- ============================================================================
-- SOLUTION 1: Refresh Supabase Schema Cache
-- ============================================================================
-- Sometimes Supabase just needs to refresh its cache.
-- This can be done via Supabase Dashboard → Database → Schema Refresh
-- Or by using the following queries:

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- Alternative: Check current schema version
SELECT current_schema();

-- ============================================================================
-- SOLUTION 2: Check if fixtures table was renamed
-- ============================================================================

-- Check if fixtures table exists (shouldn't exist after rename)
SELECT
  '=== OLD FIXTURES TABLE (should be empty) ===' as section,
  tablename
FROM pg_tables
WHERE tablename = 'fixtures' AND schemaname = 'public';

-- Check if fb_fixtures exists (should exist)
SELECT
  '=== FB_FIXTURES TABLE (should exist) ===' as section,
  tablename,
  schemaname
FROM pg_tables
WHERE tablename = 'fb_fixtures' AND schemaname = 'public';

-- ============================================================================
-- SOLUTION 3: Verify foreign key relationships
-- ============================================================================

-- Check fb_fixtures columns that should reference fb_leagues
SELECT
  '=== FB_FIXTURES COLUMNS ===' as section,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'fb_fixtures'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check for foreign keys on fb_fixtures
SELECT
  '=== FB_FIXTURES FOREIGN KEYS ===' as section,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS references_table,
  ccu.column_name AS references_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'fb_fixtures'
  AND tc.constraint_type = 'FOREIGN KEY';

-- ============================================================================
-- SOLUTION 4: Drop and recreate foreign keys if needed
-- ============================================================================

-- If fb_fixtures.league_id references old 'leagues' table, we need to fix it:

-- Step 1: Find the constraint name
DO $$
DECLARE
  constraint_name_var TEXT;
BEGIN
  -- Get the FK constraint name that references old 'leagues' table
  SELECT tc.constraint_name INTO constraint_name_var
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
  WHERE tc.table_name = 'fb_fixtures'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'leagues'
  LIMIT 1;

  IF constraint_name_var IS NOT NULL THEN
    RAISE NOTICE 'Found old FK constraint: %', constraint_name_var;
    EXECUTE format('ALTER TABLE fb_fixtures DROP CONSTRAINT %I', constraint_name_var);
    RAISE NOTICE 'Dropped constraint: %', constraint_name_var;

    -- Recreate with correct reference to fb_leagues
    ALTER TABLE fb_fixtures
      ADD CONSTRAINT fb_fixtures_league_id_fkey
      FOREIGN KEY (league_id)
      REFERENCES fb_leagues(id)
      ON DELETE CASCADE;

    RAISE NOTICE 'Created new FK constraint: fb_fixtures_league_id_fkey';
  ELSE
    RAISE NOTICE 'No old FK constraint found - checking if fb_fixtures exists';
  END IF;
END $$;

-- Step 2: Fix home_team_id and away_team_id if they reference old 'teams' table
DO $$
DECLARE
  constraint_name_var TEXT;
BEGIN
  -- Fix home_team_id
  SELECT tc.constraint_name INTO constraint_name_var
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
  JOIN information_schema.key_column_usage AS kcu
    ON kcu.constraint_name = tc.constraint_name
  WHERE tc.table_name = 'fb_fixtures'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'teams'
    AND kcu.column_name = 'home_team_id'
  LIMIT 1;

  IF constraint_name_var IS NOT NULL THEN
    RAISE NOTICE 'Dropping old home_team_id FK: %', constraint_name_var;
    EXECUTE format('ALTER TABLE fb_fixtures DROP CONSTRAINT %I', constraint_name_var);

    ALTER TABLE fb_fixtures
      ADD CONSTRAINT fb_fixtures_home_team_id_fkey
      FOREIGN KEY (home_team_id)
      REFERENCES fb_teams(id)
      ON DELETE CASCADE;

    RAISE NOTICE 'Created new FK: fb_fixtures_home_team_id_fkey';
  END IF;

  -- Fix away_team_id
  SELECT tc.constraint_name INTO constraint_name_var
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
  JOIN information_schema.key_column_usage AS kcu
    ON kcu.constraint_name = tc.constraint_name
  WHERE tc.table_name = 'fb_fixtures'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'teams'
    AND kcu.column_name = 'away_team_id'
  LIMIT 1;

  IF constraint_name_var IS NOT NULL THEN
    RAISE NOTICE 'Dropping old away_team_id FK: %', constraint_name_var;
    EXECUTE format('ALTER TABLE fb_fixtures DROP CONSTRAINT %I', constraint_name_var);

    ALTER TABLE fb_fixtures
      ADD CONSTRAINT fb_fixtures_away_team_id_fkey
      FOREIGN KEY (away_team_id)
      REFERENCES fb_teams(id)
      ON DELETE CASCADE;

    RAISE NOTICE 'Created new FK: fb_fixtures_away_team_id_fkey';
  END IF;
END $$;

-- ============================================================================
-- VERIFY: Final foreign key state
-- ============================================================================

SELECT
  '=== FINAL FB_FIXTURES FOREIGN KEYS ===' as section,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS references_table,
  ccu.column_name AS references_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'fb_fixtures'
  AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY kcu.column_name;

-- ============================================================================
-- EXPECTED RESULT
-- ============================================================================
-- After running this script:
-- - fb_fixtures.league_id should reference fb_leagues(id)
-- - fb_fixtures.home_team_id should reference fb_teams(id)
-- - fb_fixtures.away_team_id should reference fb_teams(id)
-- - Supabase should recognize the relationships
-- - Error "Could not find relationship..." should be resolved
