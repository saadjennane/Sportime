-- Fix fb_teams schema - ensure 'code' column exists
-- This script is safe to run multiple times (idempotent)

-- Option 1: Add code column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fb_teams'
      AND column_name = 'code'
  ) THEN
    ALTER TABLE public.fb_teams ADD COLUMN code TEXT;
    RAISE NOTICE 'Added code column to fb_teams';
  ELSE
    RAISE NOTICE 'Code column already exists in fb_teams';
  END IF;
END $$;

-- Verify the column was added
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'fb_teams'
  AND column_name = 'code';

-- Show success message
SELECT 'fb_teams schema fix complete!' as status;
