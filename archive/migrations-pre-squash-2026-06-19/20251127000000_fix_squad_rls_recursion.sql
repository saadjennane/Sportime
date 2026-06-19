-- =====================================================
-- Migration: Fix Squad RLS Infinite Recursion
-- Description: Fix "infinite recursion detected in policy for relation squad_members"
-- Problem: squad_members SELECT policy references itself, and squads SELECT
--          policy references squad_members, creating a circular dependency
-- Solution: Simplify policies to avoid circular references
-- =====================================================

-- =====================================================
-- STEP 1: Drop all existing policies on squads and squad_members
-- =====================================================

-- Drop squads policies
DROP POLICY IF EXISTS "Allow users to view squads they are members of" ON public.squads;
DROP POLICY IF EXISTS "Allow authenticated users to create squads" ON public.squads;
DROP POLICY IF EXISTS "Allow admins to update their squads" ON public.squads;
DROP POLICY IF EXISTS "Allow admins to delete their squads" ON public.squads;

-- Drop squad_members policies
DROP POLICY IF EXISTS "Allow users to view squad members of their squads" ON public.squad_members;
DROP POLICY IF EXISTS "Allow authenticated users to join squads" ON public.squad_members;
DROP POLICY IF EXISTS "Allow admins to remove members" ON public.squad_members;
DROP POLICY IF EXISTS "Allow users to leave squads" ON public.squad_members;

-- =====================================================
-- STEP 2: Create new non-recursive policies for squad_members
-- Key: Use direct auth.uid() comparison without subqueries on same table
-- =====================================================

-- SELECT: User can see their own membership records
CREATE POLICY "squad_members_select_own"
  ON public.squad_members FOR SELECT
  USING (user_id = auth.uid());

-- SELECT: User can see all members of squads they belong to
-- This uses a security definer function to avoid recursion
CREATE OR REPLACE FUNCTION public.get_user_squad_ids(p_user_id UUID)
RETURNS SETOF UUID AS $$
  SELECT squad_id FROM public.squad_members WHERE user_id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE POLICY "squad_members_select_same_squad"
  ON public.squad_members FOR SELECT
  USING (
    squad_id IN (SELECT public.get_user_squad_ids(auth.uid()))
  );

-- INSERT: User can add themselves to a squad
CREATE POLICY "squad_members_insert_self"
  ON public.squad_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- DELETE: User can remove themselves (leave squad)
CREATE POLICY "squad_members_delete_self"
  ON public.squad_members FOR DELETE
  USING (user_id = auth.uid());

-- DELETE: Admin can remove any member from their squad
CREATE OR REPLACE FUNCTION public.is_squad_admin(p_squad_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.squad_members
    WHERE squad_id = p_squad_id
      AND user_id = p_user_id
      AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE POLICY "squad_members_delete_admin"
  ON public.squad_members FOR DELETE
  USING (public.is_squad_admin(squad_id, auth.uid()));

-- =====================================================
-- STEP 3: Create new non-recursive policies for squads
-- =====================================================

-- SELECT: User can view squads they are members of
CREATE POLICY "squads_select_member"
  ON public.squads FOR SELECT
  USING (
    id IN (SELECT public.get_user_squad_ids(auth.uid()))
  );

-- INSERT: Any authenticated user can create a squad
CREATE POLICY "squads_insert"
  ON public.squads FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- UPDATE: Only squad admins can update
CREATE POLICY "squads_update_admin"
  ON public.squads FOR UPDATE
  USING (public.is_squad_admin(id, auth.uid()));

-- DELETE: Only squad admins can delete
CREATE POLICY "squads_delete_admin"
  ON public.squads FOR DELETE
  USING (public.is_squad_admin(id, auth.uid()));

-- =====================================================
-- Verification query (run manually to check):
-- SELECT * FROM public.squads LIMIT 5;
-- SELECT * FROM public.squad_members LIMIT 5;
-- =====================================================
