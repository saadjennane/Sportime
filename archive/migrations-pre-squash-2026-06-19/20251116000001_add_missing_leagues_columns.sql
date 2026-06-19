-- Add missing columns to leagues table for API-Football sync
-- These columns are referenced in sync code but were never added to the schema

-- Step 1: Add description column
ALTER TABLE public.leagues
ADD COLUMN IF NOT EXISTS description TEXT;

-- Step 2: Add logo column (different from logo_url)
ALTER TABLE public.leagues
ADD COLUMN IF NOT EXISTS logo TEXT;

-- Step 3: Add type column
ALTER TABLE public.leagues
ADD COLUMN IF NOT EXISTS type TEXT;

-- Step 4: Add created_by column (nullable for API imports)
ALTER TABLE public.leagues
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Step 5: Add invite_code column
ALTER TABLE public.leagues
ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;

-- Step 6: Add api_league_id column (may already exist as api_id)
ALTER TABLE public.leagues
ADD COLUMN IF NOT EXISTS api_league_id BIGINT;

-- Add index on api_league_id for performance
CREATE INDEX IF NOT EXISTS idx_leagues_api_league_id ON public.leagues(api_league_id);

-- Add comments
COMMENT ON COLUMN public.leagues.description IS 'Description of the league';
COMMENT ON COLUMN public.leagues.logo IS 'Logo URL from API-Football (different from logo_url)';
COMMENT ON COLUMN public.leagues.type IS 'League type (e.g., football_competition)';
COMMENT ON COLUMN public.leagues.created_by IS 'User who created/imported this league (nullable)';
COMMENT ON COLUMN public.leagues.invite_code IS 'Unique invite code for the league';
COMMENT ON COLUMN public.leagues.api_league_id IS 'API-Football league ID';
