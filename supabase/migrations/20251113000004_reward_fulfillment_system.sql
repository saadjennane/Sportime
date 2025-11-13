/*
  Reward Fulfillment System

  This migration creates infrastructure for tracking and managing rewards
  that require manual fulfillment (gift cards, masterpass, custom rewards).

  Features:
  1. Track fulfillment status for each reward
  2. Store fulfillment details (codes, links, etc.)
  3. Admin interface for managing pending fulfillments
  4. Notification system for users when rewards are fulfilled
*/

-- ============================================================================
-- ENUM: fulfillment_status
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.fulfillment_status AS ENUM (
    'pending',      -- Reward distributed but not yet fulfilled
    'processing',   -- Admin is working on fulfillment
    'fulfilled',    -- Reward has been fulfilled
    'failed',       -- Fulfillment failed (will retry)
    'cancelled'     -- Fulfillment cancelled (e.g., user violation)
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- TABLE: reward_fulfillments
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reward_fulfillments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL, -- 'giftcard', 'masterpass', 'custom', etc.
  reward_value JSONB NOT NULL, -- Full reward details

  -- Fulfillment tracking
  status public.fulfillment_status DEFAULT 'pending',
  fulfillment_method TEXT, -- 'email', 'in_app', 'external_api', etc.
  fulfillment_details JSONB, -- Codes, links, tracking info, etc.

  -- Source tracking
  source_type TEXT, -- 'challenge', 'seasonal', 'promotion', 'manual'
  source_id UUID, -- ID of the source (challenge_id, promotion_id, etc.)

  -- Admin notes
  admin_notes TEXT,
  processed_by UUID REFERENCES public.users(id),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  fulfilled_at TIMESTAMP WITH TIME ZONE,

  -- Constraints
  CONSTRAINT valid_reward_type CHECK (reward_type IN (
    'giftcard', 'masterpass', 'custom', 'premium_3d', 'premium_7d'
  ))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reward_fulfillments_user_id ON public.reward_fulfillments(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_fulfillments_status ON public.reward_fulfillments(status);
CREATE INDEX IF NOT EXISTS idx_reward_fulfillments_created_at ON public.reward_fulfillments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reward_fulfillments_source ON public.reward_fulfillments(source_type, source_id);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION public.update_reward_fulfillments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.status = 'fulfilled' AND OLD.status != 'fulfilled' THEN
    NEW.fulfilled_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_reward_fulfillments_updated_at ON public.reward_fulfillments;
CREATE TRIGGER trigger_update_reward_fulfillments_updated_at
  BEFORE UPDATE ON public.reward_fulfillments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_reward_fulfillments_updated_at();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.reward_fulfillments ENABLE ROW LEVEL SECURITY;

-- Users can view their own fulfillments
CREATE POLICY "Users can view own reward fulfillments"
  ON public.reward_fulfillments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all fulfillments
CREATE POLICY "Admins can view all reward fulfillments"
  ON public.reward_fulfillments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.is_admin = TRUE
    )
  );

-- Admins can update fulfillments
CREATE POLICY "Admins can update reward fulfillments"
  ON public.reward_fulfillments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.is_admin = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.is_admin = TRUE
    )
  );

-- System can insert fulfillments
CREATE POLICY "System can insert reward fulfillments"
  ON public.reward_fulfillments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- FUNCTION: create_reward_fulfillment
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_reward_fulfillment(
  p_user_id UUID,
  p_reward_type TEXT,
  p_reward_value JSONB,
  p_source_type TEXT DEFAULT 'challenge',
  p_source_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_fulfillment_id UUID;
BEGIN
  INSERT INTO public.reward_fulfillments (
    user_id,
    reward_type,
    reward_value,
    source_type,
    source_id,
    status
  ) VALUES (
    p_user_id,
    p_reward_type,
    p_reward_value,
    p_source_type,
    p_source_id,
    'pending'
  )
  RETURNING id INTO v_fulfillment_id;

  RAISE NOTICE 'Created fulfillment % for user % (type: %)', v_fulfillment_id, p_user_id, p_reward_type;

  RETURN v_fulfillment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: fulfill_reward
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fulfill_reward(
  p_fulfillment_id UUID,
  p_fulfillment_method TEXT,
  p_fulfillment_details JSONB,
  p_admin_notes TEXT DEFAULT NULL,
  p_processed_by UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_fulfillment RECORD;
  v_user_email TEXT;
  v_user_username TEXT;
BEGIN
  -- Get fulfillment record
  SELECT * INTO v_fulfillment
  FROM public.reward_fulfillments
  WHERE id = p_fulfillment_id;

  IF v_fulfillment IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Fulfillment not found'
    );
  END IF;

  -- Update fulfillment
  UPDATE public.reward_fulfillments
  SET
    status = 'fulfilled',
    fulfillment_method = p_fulfillment_method,
    fulfillment_details = p_fulfillment_details,
    admin_notes = COALESCE(p_admin_notes, admin_notes),
    processed_by = COALESCE(p_processed_by, processed_by),
    fulfilled_at = NOW()
  WHERE id = p_fulfillment_id;

  -- Get user info for notification
  SELECT email, username INTO v_user_email, v_user_username
  FROM public.users
  WHERE id = v_fulfillment.user_id;

  -- Create notification for user
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    action_label,
    action_link,
    metadata
  ) VALUES (
    v_fulfillment.user_id,
    'reward',
    '🎁 Reward Ready!',
    format('Your %s reward has been fulfilled! Check your profile for details.', v_fulfillment.reward_type),
    'View Rewards',
    '/profile?tab=rewards',
    jsonb_build_object(
      'fulfillment_id', p_fulfillment_id,
      'reward_type', v_fulfillment.reward_type,
      'fulfilled_at', NOW()
    )
  );

  RAISE NOTICE 'Fulfilled reward % for user %', p_fulfillment_id, v_fulfillment.user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Reward fulfilled successfully',
    'fulfillment_id', p_fulfillment_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('Error fulfilling reward: %', SQLERRM)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: get_pending_fulfillments
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_pending_fulfillments(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  username TEXT,
  email TEXT,
  reward_type TEXT,
  reward_value JSONB,
  status public.fulfillment_status,
  source_type TEXT,
  source_id UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  days_pending INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rf.id,
    rf.user_id,
    u.username,
    u.email,
    rf.reward_type,
    rf.reward_value,
    rf.status,
    rf.source_type,
    rf.source_id,
    rf.created_at,
    EXTRACT(DAY FROM NOW() - rf.created_at)::INTEGER as days_pending
  FROM public.reward_fulfillments rf
  INNER JOIN public.users u ON u.id = rf.user_id
  WHERE rf.status IN ('pending', 'processing')
  ORDER BY rf.created_at ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.reward_fulfillments IS
  'Tracks manual fulfillment for rewards requiring human intervention';
COMMENT ON FUNCTION public.create_reward_fulfillment(UUID, TEXT, JSONB, TEXT, UUID) IS
  'Creates a new fulfillment record for a reward';
COMMENT ON FUNCTION public.fulfill_reward(UUID, TEXT, JSONB, TEXT, UUID) IS
  'Marks a reward as fulfilled and notifies the user';
COMMENT ON FUNCTION public.get_pending_fulfillments(INTEGER, INTEGER) IS
  'Retrieves pending fulfillments for admin review';
