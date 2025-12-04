-- Fix permissions for fb_odds table
-- This allows the admin interface to write odds data

-- Enable RLS if not already enabled
ALTER TABLE public.fb_odds ENABLE ROW LEVEL SECURITY;

-- Allow service_role to do everything (for admin operations)
DROP POLICY IF EXISTS "Allow service_role full access for fb_odds" ON public.fb_odds;
CREATE POLICY "Allow service_role full access for fb_odds"
  ON public.fb_odds FOR ALL
  USING (auth.role() = 'service_role');

-- Allow authenticated users to read (for display purposes)
DROP POLICY IF EXISTS "Allow authenticated read access for fb_odds" ON public.fb_odds;
CREATE POLICY "Allow authenticated read access for fb_odds"
  ON public.fb_odds FOR SELECT
  USING (true);

-- Grant permissions
GRANT SELECT ON public.fb_odds TO authenticated, anon;
GRANT ALL ON public.fb_odds TO service_role;

-- Verify the policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'fb_odds';
