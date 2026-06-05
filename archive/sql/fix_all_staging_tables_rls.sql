-- Fix RLS policies for ALL staging tables used in odds sync
-- This ensures authenticated users can write to all necessary tables

-- ============================================
-- FB_ODDS (already has policies, but let's ensure they're correct)
-- ============================================

-- Re-grant permissions just to be sure
GRANT ALL ON public.fb_odds TO authenticated;
GRANT ALL ON public.fb_odds TO service_role;

-- ============================================
-- FB_FIXTURES (needed for odds sync - must be able to read fixtures)
-- ============================================

ALTER TABLE public.fb_fixtures ENABLE ROW LEVEL SECURITY;

-- Drop any existing restrictive policies
DROP POLICY IF EXISTS "Allow authenticated full access for fb_fixtures" ON public.fb_fixtures;
DROP POLICY IF EXISTS "Allow service_role full access for fb_fixtures" ON public.fb_fixtures;

-- Create open policies
CREATE POLICY "Allow authenticated full access for fb_fixtures"
  ON public.fb_fixtures FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service_role full access for fb_fixtures"
  ON public.fb_fixtures FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.fb_fixtures TO authenticated;
GRANT ALL ON public.fb_fixtures TO service_role;

-- ============================================
-- FB_TEAMS (needed for odds sync - must be able to read teams)
-- ============================================

ALTER TABLE public.fb_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated full access for fb_teams" ON public.fb_teams;
DROP POLICY IF EXISTS "Allow service_role full access for fb_teams" ON public.fb_teams;

CREATE POLICY "Allow authenticated full access for fb_teams"
  ON public.fb_teams FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service_role full access for fb_teams"
  ON public.fb_teams FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.fb_teams TO authenticated;
GRANT ALL ON public.fb_teams TO service_role;

-- ============================================
-- FB_LEAGUES (needed for sync - must be able to read leagues)
-- ============================================

ALTER TABLE public.fb_leagues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated full access for fb_leagues" ON public.fb_leagues;
DROP POLICY IF EXISTS "Allow service_role full access for fb_leagues" ON public.fb_leagues;

CREATE POLICY "Allow authenticated full access for fb_leagues"
  ON public.fb_leagues FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service_role full access for fb_leagues"
  ON public.fb_leagues FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.fb_leagues TO authenticated;
GRANT ALL ON public.fb_leagues TO service_role;

-- ============================================
-- FB_PLAYERS (may be needed for some sync operations)
-- ============================================

ALTER TABLE public.fb_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated full access for fb_players" ON public.fb_players;
DROP POLICY IF EXISTS "Allow service_role full access for fb_players" ON public.fb_players;

CREATE POLICY "Allow authenticated full access for fb_players"
  ON public.fb_players FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service_role full access for fb_players"
  ON public.fb_players FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.fb_players TO authenticated;
GRANT ALL ON public.fb_players TO service_role;

-- ============================================
-- VERIFICATION
-- ============================================

-- Show all policies for staging tables
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  roles
FROM pg_policies
WHERE tablename IN ('fb_odds', 'fb_fixtures', 'fb_teams', 'fb_leagues', 'fb_players')
ORDER BY tablename, policyname;

-- Show permissions
SELECT
  table_name,
  grantee,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) as privileges
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN ('fb_odds', 'fb_fixtures', 'fb_teams', 'fb_leagues', 'fb_players')
  AND grantee IN ('authenticated', 'service_role')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;
