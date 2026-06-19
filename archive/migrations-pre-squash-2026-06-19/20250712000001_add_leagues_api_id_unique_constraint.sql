/*
  Add UNIQUE Constraint on leagues.api_id

  This migration adds a UNIQUE constraint to prevent duplicate leagues
  with the same API ID from being created.

  Prerequisites:
  - All duplicate leagues must be cleaned up before running this migration
  - Run fix_leagues_duplications.sql first if duplicates exist

  Related: fix_leagues_duplications.sql (already executed manually)
*/

-- Add UNIQUE constraint on api_id if it doesn't already exist
DO $$
BEGIN
  -- First check if there are any duplicates
  IF EXISTS (
    SELECT api_id
    FROM public.leagues
    WHERE api_id IS NOT NULL
    GROUP BY api_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add UNIQUE constraint: duplicate api_id values exist. Run fix_leagues_duplications.sql first.';
  END IF;

  -- Add the constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leagues_api_id_unique'
      AND conrelid = 'public.leagues'::regclass
  ) THEN
    ALTER TABLE public.leagues
    ADD CONSTRAINT leagues_api_id_unique
    UNIQUE (api_id);

    RAISE NOTICE 'Added UNIQUE constraint on leagues.api_id';
  ELSE
    RAISE NOTICE 'UNIQUE constraint already exists';
  END IF;
END $$;

-- Verify the constraint was added
SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'leagues_api_id_unique'
  AND conrelid = 'public.leagues'::regclass;

COMMENT ON CONSTRAINT leagues_api_id_unique ON public.leagues IS
  'Ensures each API league ID appears only once in the leagues table. Prevents duplicates when syncing from fb_leagues.';
