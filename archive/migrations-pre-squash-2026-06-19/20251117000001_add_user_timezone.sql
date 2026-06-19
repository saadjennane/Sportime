-- ============================================================================
-- ADD USER TIMEZONE COLUMN
-- ============================================================================
-- This migration adds timezone support for users
-- Timezone is auto-detected from browser if not explicitly set
-- Date: 2025-11-17

-- Add timezone column to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS timezone TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.users.timezone IS 'User timezone (auto-detected from browser if NULL). Example: Europe/Paris, America/New_York, Africa/Casablanca';

-- Create index for timezone queries (optional, for analytics)
CREATE INDEX IF NOT EXISTS idx_users_timezone ON public.users(timezone);

-- ============================================================================
-- VERIFICATION QUERY (run separately to verify)
-- ============================================================================
-- SELECT
--   id,
--   email,
--   timezone,
--   created_at
-- FROM users
-- ORDER BY created_at DESC
-- LIMIT 10;
