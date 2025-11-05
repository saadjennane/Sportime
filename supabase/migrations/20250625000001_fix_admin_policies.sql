-- ============================================================================
-- FIX ADMIN POLICIES FOR ALL TABLES
-- ============================================================================
-- This migration adds missing admin policies for tables that need admin management
-- ============================================================================

-- ============================================================================
-- 1. BADGES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Allow public read access to badges" ON public.badges;
DROP POLICY IF EXISTS "Allow admin to manage badges" ON public.badges;

CREATE POLICY "Allow public read access to badges"
  ON public.badges
  FOR SELECT
  USING (true);

CREATE POLICY "Allow admin to manage badges"
  ON public.badges
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 2. SEASONS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Allow public read-only access to seasons" ON public.seasons;
DROP POLICY IF EXISTS "Allow admin full access to seasons" ON public.seasons;

CREATE POLICY "Allow public read-only access to seasons"
  ON public.seasons
  FOR SELECT
  USING (true);

CREATE POLICY "Allow admin full access to seasons"
  ON public.seasons
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 3. CHALLENGE_MATCHES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Allow public read access to challenge_matches" ON public.challenge_matches;
DROP POLICY IF EXISTS "Allow admin to manage challenge_matches" ON public.challenge_matches;

CREATE POLICY "Allow public read access to challenge_matches"
  ON public.challenge_matches
  FOR SELECT
  USING (true);

CREATE POLICY "Allow admin to manage challenge_matches"
  ON public.challenge_matches
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 4. CHALLENGE_MATCHDAYS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Allow public read access to challenge_matchdays" ON public.challenge_matchdays;
DROP POLICY IF EXISTS "Allow admin to manage challenge_matchdays" ON public.challenge_matchdays;

CREATE POLICY "Allow public read access to challenge_matchdays"
  ON public.challenge_matchdays
  FOR SELECT
  USING (true);

CREATE POLICY "Allow admin to manage challenge_matchdays"
  ON public.challenge_matchdays
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 5. MATCHDAY_FIXTURES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Allow public read access to matchday_fixtures" ON public.matchday_fixtures;
DROP POLICY IF EXISTS "Allow admin to manage matchday_fixtures" ON public.matchday_fixtures;

CREATE POLICY "Allow public read access to matchday_fixtures"
  ON public.matchday_fixtures
  FOR SELECT
  USING (true);

CREATE POLICY "Allow admin to manage matchday_fixtures"
  ON public.matchday_fixtures
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON POLICY "Allow admin to manage badges" ON public.badges
  IS 'Admins have full control over badges';

COMMENT ON POLICY "Allow admin full access to seasons" ON public.seasons
  IS 'Admins have full control over seasons';

COMMENT ON POLICY "Allow admin to manage challenge_matches" ON public.challenge_matches
  IS 'Admins have full control over challenge matches';

COMMENT ON POLICY "Allow admin to manage challenge_matchdays" ON public.challenge_matchdays
  IS 'Admins have full control over matchdays';

COMMENT ON POLICY "Allow admin to manage matchday_fixtures" ON public.matchday_fixtures
  IS 'Admins have full control over matchday fixtures';
