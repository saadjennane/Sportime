-- Debug the 400 Bad Request error
-- Check all constraints and try a manual insert to see what fails

-- 1. Check if there's a foreign key constraint
SELECT '=== Foreign Key Constraints on fb_odds ===' as step;
SELECT
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.fb_odds'::regclass
  AND contype = 'f';

-- 2. Check the unique constraint definition
SELECT '=== Unique Constraints on fb_odds ===' as step;
SELECT
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.fb_odds'::regclass
  AND contype = 'u';

-- 3. Get a sample fixture_id from fb_fixtures
SELECT '=== Sample Fixture ID from fb_fixtures ===' as step;
SELECT id, api_id, date, status
FROM public.fb_fixtures
WHERE date::date = CURRENT_DATE
LIMIT 1;

-- 4. Try to manually insert odds for that fixture
-- (Replace the UUID below with the actual UUID from step 3)
SELECT '=== Attempting Manual Insert ===' as step;

-- Get the first fixture UUID
DO $$
DECLARE
  test_fixture_id UUID;
BEGIN
  SELECT id INTO test_fixture_id
  FROM public.fb_fixtures
  WHERE date::date = CURRENT_DATE
  LIMIT 1;

  IF test_fixture_id IS NOT NULL THEN
    RAISE NOTICE 'Testing with fixture_id: %', test_fixture_id;

    -- Try to insert
    BEGIN
      INSERT INTO public.fb_odds (
        fixture_id,
        bookmaker_name,
        home_win,
        draw,
        away_win
      ) VALUES (
        test_fixture_id,
        'Test Bookmaker',
        2.5,
        3.0,
        2.8
      );

      RAISE NOTICE 'INSERT succeeded!';

      -- Clean up
      DELETE FROM public.fb_odds WHERE bookmaker_name = 'Test Bookmaker';
      RAISE NOTICE 'Test data cleaned up';

    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'INSERT failed with error: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'No fixtures found for today';
  END IF;
END $$;

-- 5. Check if there are any check constraints
SELECT '=== Check Constraints on fb_odds ===' as step;
SELECT
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.fb_odds'::regclass
  AND contype = 'c';

-- 6. Check table structure
SELECT '=== fb_odds Table Structure ===' as step;
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'fb_odds'
ORDER BY ordinal_position;
