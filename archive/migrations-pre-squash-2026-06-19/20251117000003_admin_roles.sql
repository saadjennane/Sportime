-- ============================================================================
-- ADMIN ROLES SYSTEM
-- ============================================================================
-- Adds role-based access control for admin features
-- Roles: 'user' (default), 'admin', 'super_admin'
-- Date: 2025-11-17

-- Add role column to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Add check constraint for valid roles
ALTER TABLE public.users
ADD CONSTRAINT check_valid_role CHECK (role IN ('user', 'admin', 'super_admin'));

-- Add index for role queries
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- Add comment for documentation
COMMENT ON COLUMN public.users.role IS 'User role: user (default), admin (read-only admin panel), super_admin (full config access)';

-- ============================================================================
-- UPDATE RLS POLICIES FOR GAME_CONFIG
-- ============================================================================

-- Drop existing permissive policies if any
DROP POLICY IF EXISTS "Allow super_admin to manage game configs" ON public.game_config;

-- Policy: Only super_admin can INSERT configs
CREATE POLICY "Only super_admin can insert game configs"
ON public.game_config
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'super_admin'
  )
);

-- Policy: Only super_admin can UPDATE configs
CREATE POLICY "Only super_admin can update game configs"
ON public.game_config
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'super_admin'
  )
);

-- Policy: Only super_admin can DELETE configs
CREATE POLICY "Only super_admin can delete game configs"
ON public.game_config
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'super_admin'
  )
);

-- ============================================================================
-- HELPER FUNCTIONS FOR ROLE CHECKING
-- ============================================================================

-- Function to check if current user is admin or super_admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is super_admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role FROM public.users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT SUPER_ADMIN TO FIRST USER (for initial setup)
-- ============================================================================
-- WARNING: This will make the FIRST user in the database a super_admin
-- Uncomment and run manually if needed, or assign manually via Supabase dashboard

-- UPDATE public.users
-- SET role = 'super_admin'
-- WHERE id = (SELECT id FROM public.users ORDER BY created_at ASC LIMIT 1);

-- ============================================================================
-- VERIFICATION QUERY (run separately to verify)
-- ============================================================================
-- SELECT
--   id,
--   email,
--   username,
--   role,
--   created_at
-- FROM users
-- ORDER BY created_at ASC
-- LIMIT 10;

-- Test role functions:
-- SELECT is_admin();
-- SELECT is_super_admin();
-- SELECT get_user_role();
