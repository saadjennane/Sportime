-- ============================================================================
-- FIX RLS FOR challenge_matchdays TABLE
-- ============================================================================
-- This table was missing from the previous admin testing migration

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow admin to manage challenge_matchdays" ON public.challenge_matchdays;
DROP POLICY IF EXISTS "Allow all authenticated users to manage challenge_matchdays" ON public.challenge_matchdays;

-- Create permissive policy for all authenticated users
CREATE POLICY "Allow all authenticated users to manage challenge_matchdays"
  ON public.challenge_matchdays
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Also add SELECT policy for anon users (for public game listing)
DROP POLICY IF EXISTS "Allow anon to read challenge_matchdays" ON public.challenge_matchdays;
CREATE POLICY "Allow anon to read challenge_matchdays"
  ON public.challenge_matchdays
  FOR SELECT
  TO anon
  USING (true);
