-- ============================================================================
-- QUICK FIX: ENABLE ADMIN ACCESS FOR ALL AUTHENTICATED USERS (TESTING ONLY)
-- ============================================================================
-- Copy and paste this entire script into Supabase SQL Editor and run it
-- This will allow all authenticated users to create/manage challenges

-- Drop existing admin-only policies
DROP POLICY IF EXISTS "Allow admin to create challenges" ON public.challenges;
DROP POLICY IF EXISTS "Allow admin to update challenges" ON public.challenges;
DROP POLICY IF EXISTS "Allow admin to delete challenges" ON public.challenges;
DROP POLICY IF EXISTS "Allow admin to manage challenge_configs" ON public.challenge_configs;
DROP POLICY IF EXISTS "Allow admin to manage challenge_leagues" ON public.challenge_leagues;
DROP POLICY IF EXISTS "Allow admin to manage challenge_matches" ON public.challenge_matches;

-- Create permissive policies for all authenticated users
CREATE POLICY "Allow all authenticated users to create challenges"
  ON public.challenges
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow all authenticated users to update challenges"
  ON public.challenges
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all authenticated users to delete challenges"
  ON public.challenges
  FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Allow all authenticated users to manage challenge_configs"
  ON public.challenge_configs
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all authenticated users to manage challenge_leagues"
  ON public.challenge_leagues
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all authenticated users to manage challenge_matches"
  ON public.challenge_matches
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Also fix swipe-related tables if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'swipe_challenge_matchdays') THEN
    DROP POLICY IF EXISTS "Allow admin to manage swipe_challenge_matchdays" ON public.swipe_challenge_matchdays;
    CREATE POLICY "Allow all authenticated users to manage swipe_challenge_matchdays"
      ON public.swipe_challenge_matchdays
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'swipe_matchday_fixtures') THEN
    DROP POLICY IF EXISTS "Allow admin to manage swipe_matchday_fixtures" ON public.swipe_matchday_fixtures;
    CREATE POLICY "Allow all authenticated users to manage swipe_matchday_fixtures"
      ON public.swipe_matchday_fixtures
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Verify policies were created
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('challenges', 'challenge_configs', 'challenge_leagues', 'challenge_matches')
ORDER BY tablename, policyname;
