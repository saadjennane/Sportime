-- ============================================================================
-- FIX: Leagues Duplications and Add Unique Constraint
-- ============================================================================
-- This script fixes duplicate leagues and prevents future duplications

-- Step 1: Check current duplications
SELECT 'Step 1: Checking duplications...' as status;

SELECT
  api_id,
  COUNT(*) as duplicate_count,
  array_agg(name) as names,
  array_agg(id::text) as league_ids
FROM leagues
WHERE api_id IS NOT NULL
GROUP BY api_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Step 2: Backup duplicates before deletion (optional verification)
SELECT 'Step 2: Creating backup of duplicates...' as status;

CREATE TEMP TABLE IF NOT EXISTS leagues_duplicates_backup AS
SELECT l.*
FROM leagues l
WHERE EXISTS (
  SELECT 1
  FROM leagues l2
  WHERE l2.api_id = l.api_id
    AND l2.api_id IS NOT NULL
    AND l2.id != l.id
);

SELECT COUNT(*) as backed_up_records FROM leagues_duplicates_backup;

-- Step 3: Delete duplicates, keeping the OLDEST record (earliest created_at)
SELECT 'Step 3: Deleting duplicate leagues (keeping oldest)...' as status;

DELETE FROM leagues a
USING leagues b
WHERE a.api_id = b.api_id
  AND a.api_id IS NOT NULL
  AND a.id > b.id  -- Keep the one with smaller UUID (older)
  AND a.created_at >= b.created_at;  -- Keep the one created first

SELECT 'Deleted duplicates' as status,
       (SELECT COUNT(*) FROM leagues_duplicates_backup) - (SELECT COUNT(DISTINCT api_id) FROM leagues WHERE api_id IS NOT NULL) as deleted_count;

-- Step 4: Verify no more duplicates
SELECT 'Step 4: Verifying no duplicates remain...' as status;

SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✅ No duplicates found'
    ELSE '❌ Still have duplicates!'
  END as verification_result,
  COUNT(*) as remaining_duplicates
FROM (
  SELECT api_id
  FROM leagues
  WHERE api_id IS NOT NULL
  GROUP BY api_id
  HAVING COUNT(*) > 1
) duplicates;

-- Step 5: Add UNIQUE constraint on api_id
SELECT 'Step 5: Adding UNIQUE constraint on leagues.api_id...' as status;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leagues_api_id_unique'
  ) THEN
    ALTER TABLE leagues
    ADD CONSTRAINT leagues_api_id_unique
    UNIQUE (api_id);

    RAISE NOTICE 'Added UNIQUE constraint on leagues.api_id';
  ELSE
    RAISE NOTICE 'UNIQUE constraint already exists';
  END IF;
END $$;

-- Step 6: Update the sync trigger to use UPSERT
SELECT 'Step 6: Updating sync trigger to prevent future duplications...' as status;

CREATE OR REPLACE FUNCTION public.sync_fb_leagues_to_leagues()
RETURNS TRIGGER AS $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Get admin user for created_by field
  SELECT id INTO admin_user_id FROM public.users WHERE email = 'saadjennane@gmail.com';

  IF admin_user_id IS NULL THEN
    RAISE WARNING 'Admin user not found. Using NULL for created_by.';
  END IF;

  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- UPSERT: Insert new or update existing league
    INSERT INTO public.leagues (
      id,
      name,
      description,
      logo,
      type,
      api_id,
      created_by,
      invite_code
    )
    VALUES (
      gen_random_uuid(),
      NEW.name,
      CASE
        WHEN NEW.country IS NOT NULL THEN NEW.name || ' (' || NEW.country || ')'
        ELSE NEW.name
      END,
      NEW.logo,
      COALESCE(NEW.type, 'football_competition'),
      NEW.api_league_id::INTEGER,
      admin_user_id,
      UPPER(REPLACE(REGEXP_REPLACE(NEW.name, '[^a-zA-Z0-9 ]', '', 'g'), ' ', '_'))
    )
    ON CONFLICT (api_id) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      logo = EXCLUDED.logo,
      type = EXCLUDED.type,
      updated_at = NOW();

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- Delete league when fb_leagues row is deleted
    DELETE FROM public.leagues
    WHERE api_id = OLD.api_league_id::INTEGER;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Verification - Show current leagues
SELECT 'Step 7: Current leagues (after cleanup)...' as status;

SELECT
  id,
  name,
  api_id,
  season,
  created_at
FROM leagues
WHERE api_id IS NOT NULL
ORDER BY name, created_at DESC;

-- Step 8: Summary
SELECT
  '✅ Leagues cleanup complete!' as message,
  (SELECT COUNT(*) FROM leagues WHERE api_id IS NOT NULL) as total_leagues,
  (SELECT COUNT(DISTINCT api_id) FROM leagues WHERE api_id IS NOT NULL) as unique_api_ids,
  'Both numbers should match (no duplicates)' as note;
