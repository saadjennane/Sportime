/*
  Enable Real-time Updates for User Balance and XP

  This migration enables Supabase realtime for the users table so that
  balance and XP changes are immediately reflected in the UI without
  requiring manual refresh.
*/

-- ============================================================================
-- Enable Realtime for Users Table
-- ============================================================================

-- Enable realtime for the users table
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;

COMMENT ON PUBLICATION supabase_realtime IS
  'Supabase realtime publication for real-time updates. Includes users table for balance/XP updates.';

-- ============================================================================
-- Note: Realtime Updates Configuration
-- ============================================================================

-- The AuthContext will subscribe to changes on the users table filtered by user ID.
-- When rewards are distributed and balances/XP are updated, the changes will
-- automatically propagate to the UI in real-time.
--
-- Supported fields for real-time updates:
-- - coins_balance
-- - total_xp
-- - level
-- - is_premium
-- - premium_expires_at
-- - And any other user profile fields
