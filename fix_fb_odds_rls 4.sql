-- Fix RLS policies for fb_odds to allow admin writes
-- This allows authenticated users (admin interface) to write odds data

-- Enable RLS if not already enabled
ALTER TABLE public.fb_odds ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow service_role full access for fb_odds" ON public.fb_odds;
DROP POLICY IF EXISTS "Allow authenticated read access for fb_odds" ON public.fb_odds;
DROP POLICY IF EXISTS "Allow authenticated write access for fb_odds" ON public.fb_odds;

-- Allow ALL authenticated users to read and write
-- (In production, you might want to restrict this to admin role only)
CREATE POLICY "Allow authenticated full access for fb_odds"
  ON public.fb_odds FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow service_role full access
CREATE POLICY "Allow service_role full access for fb_odds"
  ON public.fb_odds FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.fb_odds TO authenticated;
GRANT ALL ON public.fb_odds TO service_role;

-- Verify the setup
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'fb_odds'
ORDER BY policyname;
