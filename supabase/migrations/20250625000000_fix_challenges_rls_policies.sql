-- ============================================================================
-- FIX CHALLENGES RLS POLICIES
-- ============================================================================
-- This migration adds missing RLS policies for challenges table
-- to allow admins to create, update, and delete challenges.
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to challenges" ON public.challenges;
DROP POLICY IF EXISTS "Allow admin to manage challenges" ON public.challenges;
DROP POLICY IF EXISTS "Allow admin to create challenges" ON public.challenges;
DROP POLICY IF EXISTS "Allow admin to update challenges" ON public.challenges;
DROP POLICY IF EXISTS "Allow admin to delete challenges" ON public.challenges;

-- 1. Public read access (everyone can view challenges)
CREATE POLICY "Allow public read access to challenges"
  ON public.challenges
  FOR SELECT
  USING (true);

-- 2. Admin can insert challenges
CREATE POLICY "Allow admin to create challenges"
  ON public.challenges
  FOR INSERT
  WITH CHECK (public.is_admin());

-- 3. Admin can update challenges
CREATE POLICY "Allow admin to update challenges"
  ON public.challenges
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4. Admin can delete challenges
CREATE POLICY "Allow admin to delete challenges"
  ON public.challenges
  FOR DELETE
  USING (public.is_admin());

-- ============================================================================
-- VERIFICATION
-- ============================================================================

COMMENT ON POLICY "Allow public read access to challenges" ON public.challenges
  IS 'Everyone can view all challenges';

COMMENT ON POLICY "Allow admin to create challenges" ON public.challenges
  IS 'Only admins can create new challenges';

COMMENT ON POLICY "Allow admin to update challenges" ON public.challenges
  IS 'Only admins can update existing challenges';

COMMENT ON POLICY "Allow admin to delete challenges" ON public.challenges
  IS 'Only admins can delete challenges';
