-- Migration: Admin Roles Security
-- Description: Restrict admin operations to users with admin or super_admin roles
-- Author: Claude
-- Date: 2025-11-24
-- Status: DRAFT - To be applied later when ready

-- ============================================
-- 1. ADD ROLE COLUMN TO PROFILES TABLE
-- ============================================

-- Add role column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles
    ADD COLUMN role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin'));

    COMMENT ON COLUMN public.profiles.role IS 'User role: user, admin, or super_admin';
  END IF;
END $$;

-- ============================================
-- 2. HELPER FUNCTION TO CHECK IF USER IS ADMIN
-- ============================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get current user's role from profiles
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid();

  -- Return true if admin or super_admin
  RETURN user_role IN ('admin', 'super_admin');
END;
$$;

COMMENT ON FUNCTION public.is_admin IS 'Check if current user has admin or super_admin role';

-- ============================================
-- 3. SECURE RLS POLICIES FOR FB_ODDS
-- ============================================

-- Drop the open policies
DROP POLICY IF EXISTS "Allow authenticated full access for fb_odds" ON public.fb_odds;

-- Create admin-only write policy
CREATE POLICY "Allow admin write access for fb_odds"
  ON public.fb_odds FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Allow admin update access for fb_odds"
  ON public.fb_odds FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Allow admin delete access for fb_odds"
  ON public.fb_odds FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Keep read access for all authenticated users
CREATE POLICY "Allow authenticated read access for fb_odds"
  ON public.fb_odds FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- 4. SECURE OTHER ADMIN TABLES
-- ============================================

-- Apply same pattern to other staging tables
-- fb_fixtures
DROP POLICY IF EXISTS "Allow authenticated full access for fb_fixtures" ON public.fb_fixtures;

CREATE POLICY "Allow admin write for fb_fixtures"
  ON public.fb_fixtures FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Allow read for fb_fixtures"
  ON public.fb_fixtures FOR SELECT
  TO authenticated
  USING (true);

-- fb_teams
DROP POLICY IF EXISTS "Allow authenticated full access for fb_teams" ON public.fb_teams;

CREATE POLICY "Allow admin write for fb_teams"
  ON public.fb_teams FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Allow read for fb_teams"
  ON public.fb_teams FOR SELECT
  TO authenticated
  USING (true);

-- fb_players
DROP POLICY IF EXISTS "Allow authenticated full access for fb_players" ON public.fb_players;

CREATE POLICY "Allow admin write for fb_players"
  ON public.fb_players FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Allow read for fb_players"
  ON public.fb_players FOR SELECT
  TO authenticated
  USING (true);

-- fb_leagues
DROP POLICY IF EXISTS "Allow authenticated full access for fb_leagues" ON public.fb_leagues;

CREATE POLICY "Allow admin write for fb_leagues"
  ON public.fb_leagues FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Allow read for fb_leagues"
  ON public.fb_leagues FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- 5. FUNCTION TO PROMOTE USER TO ADMIN
-- ============================================

CREATE OR REPLACE FUNCTION public.promote_user_to_admin(
  p_user_id UUID,
  p_role TEXT DEFAULT 'admin'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify the role is valid
  IF p_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Invalid role: %. Must be admin or super_admin', p_role;
  END IF;

  -- Only super_admin can promote users
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Only super_admin can promote users';
  END IF;

  -- Update the user's role
  UPDATE public.profiles
  SET role = p_role
  WHERE id = p_user_id;

  RAISE NOTICE 'User % promoted to %', p_user_id, p_role;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.promote_user_to_admin IS 'Promote a user to admin or super_admin (super_admin only)';

-- ============================================
-- 6. GRANT PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_user_to_admin(UUID, TEXT) TO authenticated;

-- ============================================
-- 7. INITIAL SETUP - PROMOTE FIRST USER
-- ============================================

-- MANUAL STEP: After running this migration, promote yourself to super_admin:
--
-- 1. Get your user ID:
--    SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';
--
-- 2. Manually set yourself as super_admin:
--    UPDATE public.profiles SET role = 'super_admin' WHERE id = 'your-user-id';
--
-- 3. Then you can promote other users via the function:
--    SELECT public.promote_user_to_admin('other-user-id', 'admin');

-- ============================================
-- 8. VERIFICATION QUERIES
-- ============================================

-- Check current user's role
-- SELECT role FROM public.profiles WHERE id = auth.uid();

-- List all admins
-- SELECT p.id, u.email, p.role
-- FROM public.profiles p
-- JOIN auth.users u ON u.id = p.id
-- WHERE p.role IN ('admin', 'super_admin')
-- ORDER BY p.role DESC, u.email;
