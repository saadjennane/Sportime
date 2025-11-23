-- =====================================================
-- SPIN SYSTEM MIGRATION
-- =====================================================
-- Complete spin wheel system with state management,
-- history tracking, and business logic (pity timer,
-- adaptive drop rates, weighted probability selection)
-- =====================================================

-- Create spin_tier ENUM type
CREATE TYPE public.spin_tier AS ENUM ('free', 'amateur', 'master', 'apex', 'premium');

-- =====================================================
-- TABLES
-- =====================================================

-- User spin states table
-- Stores pity counter, adaptive multipliers, and available spins per user
CREATE TABLE IF NOT EXISTS public.user_spin_states (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  pity_counter INTEGER NOT NULL DEFAULT 0 CHECK (pity_counter >= 0),
  adaptive_multipliers JSONB NOT NULL DEFAULT '{}'::jsonb,
  available_spins JSONB NOT NULL DEFAULT '{"free":0,"amateur":0,"master":0,"apex":0,"premium":0}'::jsonb,
  last_free_spin_at TIMESTAMPTZ,
  free_spin_streak INTEGER NOT NULL DEFAULT 0 CHECK (free_spin_streak >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spin history table
-- Records every spin performed with full metadata
CREATE TABLE IF NOT EXISTS public.spin_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tier public.spin_tier NOT NULL,
  reward_id TEXT NOT NULL,
  reward_label TEXT NOT NULL,
  reward_category TEXT NOT NULL,
  reward_value TEXT,
  was_pity BOOLEAN NOT NULL DEFAULT false,
  final_chances JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_spin_states_user ON public.user_spin_states(user_id);
CREATE INDEX IF NOT EXISTS idx_spin_history_user_time ON public.spin_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spin_history_tier ON public.spin_history(tier);
CREATE INDEX IF NOT EXISTS idx_spin_history_created ON public.spin_history(created_at DESC);

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE public.user_spin_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spin_history ENABLE ROW LEVEL SECURITY;

-- user_spin_states policies
CREATE POLICY "Users can view own spin state"
  ON public.user_spin_states FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own spin state"
  ON public.user_spin_states FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own spin state"
  ON public.user_spin_states FOR UPDATE
  USING (auth.uid() = user_id);

-- spin_history policies
CREATE POLICY "Users can view own spin history"
  ON public.spin_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own spin history"
  ON public.spin_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- RPC FUNCTIONS
-- =====================================================

-- Get or create user spin state
CREATE OR REPLACE FUNCTION public.get_user_spin_state(p_user_id UUID)
RETURNS TABLE(
  user_id UUID,
  pity_counter INTEGER,
  adaptive_multipliers JSONB,
  available_spins JSONB,
  last_free_spin_at TIMESTAMPTZ,
  free_spin_streak INTEGER,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert default state if doesn't exist
  INSERT INTO public.user_spin_states (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Return current state
  RETURN QUERY
  SELECT
    uss.user_id,
    uss.pity_counter,
    uss.adaptive_multipliers,
    uss.available_spins,
    uss.last_free_spin_at,
    uss.free_spin_streak,
    uss.updated_at
  FROM public.user_spin_states uss
  WHERE uss.user_id = p_user_id;
END;
$$;

-- Get spin history with limit
CREATE OR REPLACE FUNCTION public.get_spin_history(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  tier public.spin_tier,
  reward_id TEXT,
  reward_label TEXT,
  reward_category TEXT,
  reward_value TEXT,
  was_pity BOOLEAN,
  final_chances JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sh.id,
    sh.tier,
    sh.reward_id,
    sh.reward_label,
    sh.reward_category,
    sh.reward_value,
    sh.was_pity,
    sh.final_chances,
    sh.created_at
  FROM public.spin_history sh
  WHERE sh.user_id = p_user_id
  ORDER BY sh.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Update pity counter
CREATE OR REPLACE FUNCTION public.update_pity_counter(
  p_user_id UUID,
  p_reset BOOLEAN DEFAULT false
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_counter INTEGER;
BEGIN
  -- Ensure state exists
  INSERT INTO public.user_spin_states (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Update counter
  UPDATE public.user_spin_states
  SET
    pity_counter = CASE WHEN p_reset THEN 0 ELSE pity_counter + 1 END,
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING pity_counter INTO v_new_counter;

  RETURN v_new_counter;
END;
$$;

-- Update adaptive multipliers
CREATE OR REPLACE FUNCTION public.update_adaptive_multipliers(
  p_user_id UUID,
  p_category TEXT,
  p_expires_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_multipliers JSONB;
BEGIN
  -- Ensure state exists
  INSERT INTO public.user_spin_states (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Update multipliers
  UPDATE public.user_spin_states
  SET
    adaptive_multipliers = adaptive_multipliers || jsonb_build_object(
      p_category, jsonb_build_object(
        'multiplier', CASE
          WHEN p_category = 'premium' THEN 0.5
          WHEN p_category = 'gift_card' THEN 0.3
          WHEN p_category = 'masterpass' THEN 0.5
          ELSE 0.5
        END,
        'expiresAt', to_char(p_expires_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      )
    ),
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING adaptive_multipliers INTO v_multipliers;

  RETURN v_multipliers;
END;
$$;

-- Clean expired adaptive multipliers
CREATE OR REPLACE FUNCTION public.clean_expired_multipliers(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_multipliers JSONB;
  v_clean_multipliers JSONB := '{}'::jsonb;
  v_key TEXT;
  v_value JSONB;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Get current multipliers
  SELECT adaptive_multipliers INTO v_current_multipliers
  FROM public.user_spin_states
  WHERE user_id = p_user_id;

  -- Return empty if no multipliers
  IF v_current_multipliers IS NULL OR v_current_multipliers = '{}'::jsonb THEN
    RETURN '{}'::jsonb;
  END IF;

  -- Filter out expired entries
  FOR v_key, v_value IN SELECT * FROM jsonb_each(v_current_multipliers)
  LOOP
    v_expires_at := (v_value->>'expiresAt')::TIMESTAMPTZ;
    IF v_expires_at > NOW() THEN
      v_clean_multipliers := v_clean_multipliers || jsonb_build_object(v_key, v_value);
    END IF;
  END LOOP;

  -- Update and return
  UPDATE public.user_spin_states
  SET
    adaptive_multipliers = v_clean_multipliers,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN v_clean_multipliers;
END;
$$;

-- Add or remove available spins
CREATE OR REPLACE FUNCTION public.update_available_spins(
  p_user_id UUID,
  p_tier public.spin_tier,
  p_delta INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_available_spins JSONB;
  v_current_count INTEGER;
  v_new_count INTEGER;
BEGIN
  -- Ensure state exists
  INSERT INTO public.user_spin_states (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Get current available spins
  SELECT available_spins INTO v_available_spins
  FROM public.user_spin_states
  WHERE user_id = p_user_id;

  -- Get current count for this tier
  v_current_count := COALESCE((v_available_spins->>p_tier::text)::INTEGER, 0);
  v_new_count := GREATEST(0, v_current_count + p_delta);

  -- Update
  UPDATE public.user_spin_states
  SET
    available_spins = available_spins || jsonb_build_object(p_tier::text, v_new_count),
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING available_spins INTO v_available_spins;

  RETURN v_available_spins;
END;
$$;

-- Record spin in history
CREATE OR REPLACE FUNCTION public.record_spin(
  p_user_id UUID,
  p_tier public.spin_tier,
  p_reward_id TEXT,
  p_reward_label TEXT,
  p_reward_category TEXT,
  p_reward_value TEXT DEFAULT NULL,
  p_was_pity BOOLEAN DEFAULT false,
  p_final_chances JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_spin_id UUID;
BEGIN
  INSERT INTO public.spin_history (
    user_id,
    tier,
    reward_id,
    reward_label,
    reward_category,
    reward_value,
    was_pity,
    final_chances
  )
  VALUES (
    p_user_id,
    p_tier,
    p_reward_id,
    p_reward_label,
    p_reward_category,
    p_reward_value,
    p_was_pity,
    p_final_chances
  )
  RETURNING id INTO v_spin_id;

  RETURN v_spin_id;
END;
$$;

-- Claim daily free spin
CREATE OR REPLACE FUNCTION public.claim_daily_free_spin(p_user_id UUID)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  spins_granted INTEGER,
  next_available_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last_claim TIMESTAMPTZ;
  v_can_claim BOOLEAN;
  v_new_streak INTEGER;
BEGIN
  -- Ensure state exists
  INSERT INTO public.user_spin_states (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Get last claim time
  SELECT last_free_spin_at INTO v_last_claim
  FROM public.user_spin_states
  WHERE user_id = p_user_id;

  -- Check if can claim (24 hours cooldown)
  v_can_claim := v_last_claim IS NULL OR (NOW() - v_last_claim) >= INTERVAL '24 hours';

  IF NOT v_can_claim THEN
    RETURN QUERY SELECT
      false,
      'Daily free spin already claimed. Try again later.',
      0::INTEGER,
      v_last_claim + INTERVAL '24 hours';
    RETURN;
  END IF;

  -- Update streak
  IF v_last_claim IS NULL OR (NOW() - v_last_claim) > INTERVAL '48 hours' THEN
    v_new_streak := 1;
  ELSE
    SELECT free_spin_streak + 1 INTO v_new_streak
    FROM public.user_spin_states
    WHERE user_id = p_user_id;
  END IF;

  -- Grant free spin and update state
  UPDATE public.user_spin_states
  SET
    available_spins = available_spins || jsonb_build_object('free',
      COALESCE((available_spins->>'free')::INTEGER, 0) + 1
    ),
    last_free_spin_at = NOW(),
    free_spin_streak = v_new_streak,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT
    true,
    'Free spin granted! Current streak: ' || v_new_streak::TEXT,
    1::INTEGER,
    NOW() + INTERVAL '24 hours';
END;
$$;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to initialize spin state for new users
CREATE OR REPLACE FUNCTION public.initialize_spin_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_spin_states (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger to auto-initialize spin state for new users
DROP TRIGGER IF EXISTS trigger_initialize_spin_state ON public.users;
CREATE TRIGGER trigger_initialize_spin_state
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_spin_state();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.user_spin_states IS 'Stores per-user spin wheel state including pity counter, adaptive multipliers, and available spins';
COMMENT ON TABLE public.spin_history IS 'Records every spin performed by users with full metadata';
COMMENT ON FUNCTION public.get_user_spin_state IS 'Gets or creates user spin state';
COMMENT ON FUNCTION public.get_spin_history IS 'Retrieves spin history for a user with limit';
COMMENT ON FUNCTION public.update_pity_counter IS 'Increments or resets pity counter';
COMMENT ON FUNCTION public.update_adaptive_multipliers IS 'Adds adaptive multiplier for a reward category';
COMMENT ON FUNCTION public.clean_expired_multipliers IS 'Removes expired adaptive multipliers';
COMMENT ON FUNCTION public.update_available_spins IS 'Adds or removes available spins for a tier';
COMMENT ON FUNCTION public.record_spin IS 'Records a spin in history';
COMMENT ON FUNCTION public.claim_daily_free_spin IS 'Claims daily free spin with 24h cooldown';
