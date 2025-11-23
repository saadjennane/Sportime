-- ============================================================================
-- Comprehensive Schema Fix for fb_teams and fb_players
-- Adds all missing columns that Edge Function is trying to use
-- ============================================================================

-- Fix fb_teams: Add 'code' column if missing
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

-- Fix fb_players: Add 'number' column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fb_players'
      AND column_name = 'number'
  ) THEN
    ALTER TABLE public.fb_players ADD COLUMN number INTEGER;
    RAISE NOTICE 'Added number column to fb_players';
  ELSE
    RAISE NOTICE 'Number column already exists in fb_players';
  END IF;
END $$;

-- Add any other potentially missing columns for fb_players
DO $$
BEGIN
  -- firstname
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fb_players' AND column_name = 'firstname'
  ) THEN
    ALTER TABLE public.fb_players ADD COLUMN firstname TEXT;
    RAISE NOTICE 'Added firstname column to fb_players';
  END IF;

  -- lastname
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fb_players' AND column_name = 'lastname'
  ) THEN
    ALTER TABLE public.fb_players ADD COLUMN lastname TEXT;
    RAISE NOTICE 'Added lastname column to fb_players';
  END IF;

  -- age
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fb_players' AND column_name = 'age'
  ) THEN
    ALTER TABLE public.fb_players ADD COLUMN age INTEGER;
    RAISE NOTICE 'Added age column to fb_players';
  END IF;

  -- birth_date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fb_players' AND column_name = 'birth_date'
  ) THEN
    ALTER TABLE public.fb_players ADD COLUMN birth_date DATE;
    RAISE NOTICE 'Added birth_date column to fb_players';
  END IF;

  -- birth_place
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fb_players' AND column_name = 'birth_place'
  ) THEN
    ALTER TABLE public.fb_players ADD COLUMN birth_place TEXT;
    RAISE NOTICE 'Added birth_place column to fb_players';
  END IF;

  -- birth_country
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fb_players' AND column_name = 'birth_country'
  ) THEN
    ALTER TABLE public.fb_players ADD COLUMN birth_country TEXT;
    RAISE NOTICE 'Added birth_country column to fb_players';
  END IF;

  -- nationality
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fb_players' AND column_name = 'nationality'
  ) THEN
    ALTER TABLE public.fb_players ADD COLUMN nationality TEXT;
    RAISE NOTICE 'Added nationality column to fb_players';
  END IF;

  -- height
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fb_players' AND column_name = 'height'
  ) THEN
    ALTER TABLE public.fb_players ADD COLUMN height TEXT;
    RAISE NOTICE 'Added height column to fb_players';
  END IF;

  -- weight
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fb_players' AND column_name = 'weight'
  ) THEN
    ALTER TABLE public.fb_players ADD COLUMN weight TEXT;
    RAISE NOTICE 'Added weight column to fb_players';
  END IF;

  -- photo
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fb_players' AND column_name = 'photo'
  ) THEN
    ALTER TABLE public.fb_players ADD COLUMN photo TEXT;
    RAISE NOTICE 'Added photo column to fb_players';
  END IF;

  -- position
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fb_players' AND column_name = 'position'
  ) THEN
    ALTER TABLE public.fb_players ADD COLUMN position TEXT;
    RAISE NOTICE 'Added position column to fb_players';
  END IF;

  -- payload
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fb_players' AND column_name = 'payload'
  ) THEN
    ALTER TABLE public.fb_players ADD COLUMN payload JSONB;
    RAISE NOTICE 'Added payload column to fb_players';
  END IF;
END $$;

-- Verify fb_teams schema
SELECT
  'fb_teams' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'fb_teams'
ORDER BY ordinal_position;

-- Verify fb_players schema
SELECT
  'fb_players' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'fb_players'
ORDER BY ordinal_position;

-- Show success message
SELECT 'All schema fixes applied successfully!' as status;
