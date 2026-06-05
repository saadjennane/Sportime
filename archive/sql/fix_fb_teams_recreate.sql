-- Alternative Fix: Drop and recreate fb_teams table with correct schema
-- WARNING: This will delete all existing data in fb_teams
-- Only use this if the simple column addition doesn't work

-- Check current data count
SELECT COUNT(*) as current_rows FROM public.fb_teams;

-- Drop the table (will cascade delete dependent data)
DROP TABLE IF EXISTS public.fb_teams CASCADE;

-- Recreate with correct schema
CREATE TABLE public.fb_teams (
  id BIGINT PRIMARY KEY, -- API-Football team ID (serves as both id and api_id)
  name TEXT NOT NULL,
  code TEXT, -- 3-letter code (e.g., 'MCI')
  country TEXT,
  founded INTEGER,
  national BOOLEAN,
  logo TEXT,
  venue_name TEXT,
  venue_city TEXT,
  venue_capacity INTEGER,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_fb_teams_id ON public.fb_teams(id);
CREATE INDEX IF NOT EXISTS idx_fb_teams_name ON public.fb_teams(name);

-- Enable RLS
ALTER TABLE public.fb_teams ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to fb_teams" ON public.fb_teams;
DROP POLICY IF EXISTS "Allow service_role full access to fb_teams" ON public.fb_teams;

-- Create policies
CREATE POLICY "Allow public read access to fb_teams"
  ON public.fb_teams FOR SELECT
  USING (true);

CREATE POLICY "Allow service_role full access to fb_teams"
  ON public.fb_teams FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON public.fb_teams TO authenticated, anon;
GRANT ALL ON public.fb_teams TO service_role;

-- Verify schema
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'fb_teams'
ORDER BY ordinal_position;

-- Success message
SELECT 'fb_teams table recreated successfully!' as status;
