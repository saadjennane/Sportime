-- ============================================================================
-- Add api_id columns to production tables for API-Football integration
-- This enables syncing from fb_* staging tables to production tables
-- ============================================================================

-- Add api_id to teams table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'teams'
      AND column_name = 'api_id'
  ) THEN
    ALTER TABLE public.teams ADD COLUMN api_id BIGINT UNIQUE;
    CREATE INDEX IF NOT EXISTS idx_teams_api_id ON public.teams(api_id);
    RAISE NOTICE 'Added api_id column to teams table';
  ELSE
    RAISE NOTICE 'api_id column already exists in teams table';
  END IF;
END $$;

-- Add api_id to players table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'players'
      AND column_name = 'api_id'
  ) THEN
    ALTER TABLE public.players ADD COLUMN api_id BIGINT UNIQUE;
    CREATE INDEX IF NOT EXISTS idx_players_api_id ON public.players(api_id);
    RAISE NOTICE 'Added api_id column to players table';
  ELSE
    RAISE NOTICE 'api_id column already exists in players table';
  END IF;
END $$;

-- Add api_id to leagues table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leagues'
      AND column_name = 'api_id'
  ) THEN
    ALTER TABLE public.leagues ADD COLUMN api_id BIGINT UNIQUE;
    CREATE INDEX IF NOT EXISTS idx_leagues_api_id ON public.leagues(api_id);
    RAISE NOTICE 'Added api_id column to leagues table';
  ELSE
    RAISE NOTICE 'api_id column already exists in leagues table';
  END IF;
END $$;

-- Add api_id to fixtures table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fixtures'
      AND column_name = 'api_id'
  ) THEN
    ALTER TABLE public.fixtures ADD COLUMN api_id BIGINT UNIQUE;
    CREATE INDEX IF NOT EXISTS idx_fixtures_api_id ON public.fixtures(api_id);
    RAISE NOTICE 'Added api_id column to fixtures table';
  ELSE
    RAISE NOTICE 'api_id column already exists in fixtures table';
  END IF;
END $$;

-- Add additional fields to teams table for better compatibility
DO $$
BEGIN
  -- code column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = 'code'
  ) THEN
    ALTER TABLE public.teams ADD COLUMN code TEXT;
    RAISE NOTICE 'Added code column to teams table';
  END IF;

  -- logo column (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = 'logo'
  ) THEN
    ALTER TABLE public.teams ADD COLUMN logo TEXT;
    RAISE NOTICE 'Added logo column to teams table';
  END IF;

  -- country column (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = 'country'
  ) THEN
    ALTER TABLE public.teams ADD COLUMN country TEXT;
    RAISE NOTICE 'Added country column to teams table';
  END IF;
END $$;

-- Add additional fields to players table for better compatibility
DO $$
BEGIN
  -- name column (full name)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'players' AND column_name = 'name'
  ) THEN
    ALTER TABLE public.players ADD COLUMN name TEXT;
    RAISE NOTICE 'Added name column to players table';
  END IF;

  -- photo column (API-Football uses 'photo' not 'photo_url')
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'players' AND column_name = 'photo'
  ) THEN
    ALTER TABLE public.players ADD COLUMN photo TEXT;
    RAISE NOTICE 'Added photo column to players table';
  END IF;
END $$;

-- Verify changes
SELECT 'teams' as table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'teams'
  AND column_name IN ('api_id', 'code', 'logo', 'country')
ORDER BY column_name;

SELECT 'players' as table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'players'
  AND column_name IN ('api_id', 'name', 'photo')
ORDER BY column_name;

SELECT 'leagues' as table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'leagues'
  AND column_name = 'api_id';

SELECT 'fixtures' as table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'fixtures'
  AND column_name = 'api_id';

-- Show success message
SELECT 'api_id columns added to production tables successfully!' as status;
