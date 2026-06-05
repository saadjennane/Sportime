-- ============================================================================
-- FIX LEAGUES SCHEMA - Add missing columns
-- ============================================================================
-- Run this SQL in your Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/sql
-- ============================================================================

-- Step 1: Show current columns
DO $$
BEGIN
  RAISE NOTICE '======================================== CURRENT SCHEMA ========================================';
END $$;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'leagues'
ORDER BY ordinal_position;

-- Step 2: Add missing columns
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Adding missing columns...';
END $$;

-- Add description column
ALTER TABLE public.leagues
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add logo column (different from logo_url)
ALTER TABLE public.leagues
ADD COLUMN IF NOT EXISTS logo TEXT;

-- Add type column
ALTER TABLE public.leagues
ADD COLUMN IF NOT EXISTS type TEXT;

-- Add created_by column (nullable for API imports)
ALTER TABLE public.leagues
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Add invite_code column
ALTER TABLE public.leagues
ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;

-- Add api_league_id column
ALTER TABLE public.leagues
ADD COLUMN IF NOT EXISTS api_league_id BIGINT;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_leagues_api_league_id ON public.leagues(api_league_id);
CREATE INDEX IF NOT EXISTS idx_leagues_invite_code ON public.leagues(invite_code);

-- Add comments
COMMENT ON COLUMN public.leagues.description IS 'Description of the league';
COMMENT ON COLUMN public.leagues.logo IS 'Logo URL from API-Football';
COMMENT ON COLUMN public.leagues.type IS 'League type (e.g., football_competition)';
COMMENT ON COLUMN public.leagues.created_by IS 'User who created/imported this league (nullable)';
COMMENT ON COLUMN public.leagues.invite_code IS 'Unique invite code for the league';
COMMENT ON COLUMN public.leagues.api_league_id IS 'API-Football league ID';

-- Step 3: Verify new schema
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '======================================== NEW SCHEMA ========================================';
END $$;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'leagues'
ORDER BY ordinal_position;

-- Final message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ SUCCESS: All missing columns have been added to leagues table';
  RAISE NOTICE 'You can now import leagues from API-Football!';
  RAISE NOTICE '';
END $$;
