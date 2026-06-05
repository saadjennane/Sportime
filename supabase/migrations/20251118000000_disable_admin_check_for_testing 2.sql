-- ============================================================================
-- DISABLE ADMIN CHECKS FOR TESTING
-- ============================================================================
-- This migration removes admin-only restrictions for testing purposes
-- WARNING: This allows ALL authenticated users to manage challenges
-- DO NOT USE IN PRODUCTION!

-- Drop existing admin-only policies
DROP POLICY IF EXISTS "Allow admin to create challenges" ON public.challenges;
DROP POLICY IF EXISTS "Allow admin to update challenges" ON public.challenges;
DROP POLICY IF EXISTS "Allow admin to delete challenges" ON public.challenges;

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

-- Same for challenge_configs
DROP POLICY IF EXISTS "Allow admin to manage challenge_configs" ON public.challenge_configs;

CREATE POLICY "Allow all authenticated users to manage challenge_configs"
  ON public.challenge_configs
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Same for challenge_leagues
DROP POLICY IF EXISTS "Allow admin to manage challenge_leagues" ON public.challenge_leagues;

CREATE POLICY "Allow all authenticated users to manage challenge_leagues"
  ON public.challenge_leagues
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Same for challenge_matches
DROP POLICY IF EXISTS "Allow admin to manage challenge_matches" ON public.challenge_matches;

CREATE POLICY "Allow all authenticated users to manage challenge_matches"
  ON public.challenge_matches
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Same for swipe_challenge_matchdays
DROP POLICY IF EXISTS "Allow admin to manage swipe_challenge_matchdays" ON public.swipe_challenge_matchdays;

CREATE POLICY "Allow all authenticated users to manage swipe_challenge_matchdays"
  ON public.swipe_challenge_matchdays
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Same for swipe_matchday_fixtures
DROP POLICY IF EXISTS "Allow admin to manage swipe_matchday_fixtures" ON public.swipe_matchday_fixtures;

CREATE POLICY "Allow all authenticated users to manage swipe_matchday_fixtures"
  ON public.swipe_matchday_fixtures
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run this to verify the policies were created:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('challenges', 'challenge_configs', 'challenge_leagues', 'challenge_matches')
-- ORDER BY tablename, policyname;
