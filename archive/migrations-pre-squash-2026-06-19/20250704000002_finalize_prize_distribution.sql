/*
  Finalize Prize Distribution - Add Spin Granting & Placeholders

  This migration completes the prize distribution system by:
  1. Adding grant_spin() function to give spins as rewards
  2. Implementing placeholders for Gift Cards and MasterPass (5000 coins)
  3. Connecting spin rewards to user_spin_states table

  Related to:
  - Migration 2 (20250628000002_challenge_prize_distribution.sql)
  - Spin system (20250630000000_spin_system.sql)
*/

-- ============================================================================
-- FUNCTION: grant_spin
-- ============================================================================
-- Grants spins to a user for a specific tier (free, amateur, master, apex, premium)
-- Initializes user_spin_states if it doesn't exist
-- Increments available_spins JSONB field for the specified tier

CREATE OR REPLACE FUNCTION public.grant_spin(
  p_user_id UUID,
  p_tier TEXT,
  p_quantity INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_spins JSONB;
  v_tier_spins INTEGER;
BEGIN
  -- Validate tier
  IF p_tier NOT IN ('free', 'amateur', 'master', 'apex', 'premium') THEN
    RAISE EXCEPTION 'Invalid spin tier: %. Must be one of: free, amateur, master, apex, premium', p_tier;
  END IF;

  -- Initialize user_spin_states if it doesn't exist
  INSERT INTO public.user_spin_states (user_id, available_spins)
  VALUES (
    p_user_id,
    jsonb_build_object(
      'free', 0,
      'amateur', 0,
      'master', 0,
      'apex', 0,
      'premium', 0
    )
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Get current available_spins
  SELECT available_spins INTO v_current_spins
  FROM public.user_spin_states
  WHERE user_id = p_user_id;

  -- Get current count for this tier
  v_tier_spins := COALESCE((v_current_spins->>p_tier)::INTEGER, 0);

  -- Increment by quantity
  v_tier_spins := v_tier_spins + p_quantity;

  -- Update available_spins with new count
  UPDATE public.user_spin_states
  SET available_spins = jsonb_set(
    available_spins,
    ARRAY[p_tier],
    to_jsonb(v_tier_spins)
  )
  WHERE user_id = p_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.grant_spin(UUID, TEXT, INTEGER) IS
  'Grants spins to a user for a specific tier. Initializes user_spin_states if needed. Supports tiers: free, amateur, master, apex, premium.';

-- ============================================================================
-- UPDATE: distribute_reward_to_user
-- ============================================================================
-- Replace the existing function with updated version that handles:
-- - Spins (via grant_spin)
-- - Gift Cards (5000 coins placeholder)
-- - MasterPass (5000 coins placeholder)

CREATE OR REPLACE FUNCTION public.distribute_reward_to_user(
  p_user_id UUID,
  p_reward JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_reward_type TEXT;
  v_value INTEGER;
  v_tier TEXT;
  v_result JSONB;
  v_current_balance INTEGER;
  v_current_xp INTEGER;
BEGIN
  v_reward_type := p_reward->>'type';
  v_value := COALESCE((p_reward->>'value')::INTEGER, 0);
  v_tier := p_reward->>'tier';

  CASE v_reward_type

    -- ====== COINS ======
    WHEN 'coins' THEN
      UPDATE public.users
      SET coin_balance = coin_balance + v_value
      WHERE id = p_user_id
      RETURNING coin_balance INTO v_current_balance;

      RETURN jsonb_build_object(
        'success', TRUE,
        'type', 'coins',
        'value', v_value,
        'new_balance', v_current_balance
      );

    -- ====== TICKETS ======
    WHEN 'ticket' THEN
      -- v_tier should be: 'amateur', 'master', or 'apex'
      v_result := public.grant_ticket(
        p_user_id,
        COALESCE(v_tier, 'amateur')::TEXT,
        COALESCE(v_value, 7) -- Default 7 days expiry
      );

      RETURN jsonb_build_object(
        'success', (v_result->>'success')::BOOLEAN,
        'type', 'ticket',
        'tier', v_tier,
        'ticket_id', v_result->>'ticket_id',
        'message', v_result->>'message'
      );

    -- ====== XP ======
    WHEN 'xp' THEN
      -- Add XP via activity_log
      INSERT INTO public.activity_log (user_id, action_type, xp_gained, metadata)
      VALUES (
        p_user_id,
        'challenge_reward',
        v_value,
        jsonb_build_object('reward_type', 'xp', 'amount', v_value)
      );

      -- Get updated XP
      SELECT xp INTO v_current_xp
      FROM public.users
      WHERE id = p_user_id;

      RETURN jsonb_build_object(
        'success', TRUE,
        'type', 'xp',
        'value', v_value,
        'new_xp', v_current_xp
      );

    -- ====== SPINS ======
    WHEN 'spin' THEN
      -- Grant spin using new grant_spin function
      -- v_tier: 'amateur', 'master', 'apex', or 'premium'
      -- v_value: quantity (default 1)
      PERFORM public.grant_spin(
        p_user_id,
        COALESCE(v_tier, 'amateur'),
        COALESCE(v_value, 1)
      );

      RETURN jsonb_build_object(
        'success', TRUE,
        'type', 'spin',
        'tier', COALESCE(v_tier, 'amateur'),
        'quantity', COALESCE(v_value, 1)
      );

    -- ====== PREMIUM SUBSCRIPTIONS ======
    WHEN 'premium_3d', 'premium_7d' THEN
      -- Calculate expiry date
      DECLARE
        v_days INTEGER;
        v_new_expiry TIMESTAMPTZ;
      BEGIN
        v_days := CASE v_reward_type
          WHEN 'premium_3d' THEN 3
          WHEN 'premium_7d' THEN 7
          ELSE 0
        END;

        -- Extend from current premium_expires_at or NOW()
        SELECT GREATEST(premium_expires_at, NOW()) + (v_days || ' days')::INTERVAL
        INTO v_new_expiry
        FROM public.users
        WHERE id = p_user_id;

        UPDATE public.users
        SET premium_expires_at = v_new_expiry
        WHERE id = p_user_id;

        RETURN jsonb_build_object(
          'success', TRUE,
          'type', v_reward_type,
          'days', v_days,
          'new_expiry', v_new_expiry
        );
      END;

    -- ====== GIFT CARD (PLACEHOLDER) ======
    WHEN 'giftcard' THEN
      -- Placeholder: Give 5000 coins instead
      UPDATE public.users
      SET coin_balance = coin_balance + 5000
      WHERE id = p_user_id
      RETURNING coin_balance INTO v_current_balance;

      -- Log placeholder usage
      RAISE NOTICE 'Gift card reward converted to 5000 coins placeholder for user %', p_user_id;

      RETURN jsonb_build_object(
        'success', TRUE,
        'type', 'giftcard_placeholder',
        'value', 5000,
        'original_value', v_value,
        'new_balance', v_current_balance,
        'message', 'Gift card reward (5000 coins placeholder)'
      );

    -- ====== MASTERPASS (PLACEHOLDER) ======
    WHEN 'masterpass' THEN
      -- Placeholder: Give 5000 coins instead
      UPDATE public.users
      SET coin_balance = coin_balance + 5000
      WHERE id = p_user_id
      RETURNING coin_balance INTO v_current_balance;

      -- Log placeholder usage
      RAISE NOTICE 'MasterPass reward converted to 5000 coins placeholder for user %', p_user_id;

      RETURN jsonb_build_object(
        'success', TRUE,
        'type', 'masterpass_placeholder',
        'value', 5000,
        'tier', v_tier,
        'new_balance', v_current_balance,
        'message', 'MasterPass reward (5000 coins placeholder)'
      );

    -- ====== CUSTOM / OTHER ======
    ELSE
      RAISE NOTICE 'Unknown or custom reward type: % for user %', v_reward_type, p_user_id;
      RETURN jsonb_build_object(
        'success', FALSE,
        'type', v_reward_type,
        'message', 'Unknown or unhandled reward type'
      );

  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.distribute_reward_to_user(UUID, JSONB) IS
  'Distributes a single reward to a user. Supports: coins, tickets, xp, spins, premium subscriptions, gift cards (placeholder), masterpass (placeholder).';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Test grant_spin function
DO $$
DECLARE
  v_test_user_id UUID;
  v_result BOOLEAN;
BEGIN
  -- Get first user from database (or create test)
  SELECT id INTO v_test_user_id FROM public.users LIMIT 1;

  IF v_test_user_id IS NOT NULL THEN
    -- Test granting amateur spins
    v_result := public.grant_spin(v_test_user_id, 'amateur', 2);
    RAISE NOTICE 'Grant spin test: % (expected TRUE)', v_result;

    -- Verify available_spins was updated
    DECLARE
      v_spins JSONB;
    BEGIN
      SELECT available_spins INTO v_spins
      FROM public.user_spin_states
      WHERE user_id = v_test_user_id;

      RAISE NOTICE 'User spin state after grant: %', v_spins;
    END;
  ELSE
    RAISE NOTICE 'No users found for testing grant_spin';
  END IF;
END $$;

-- Verify functions exist
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('grant_spin', 'distribute_reward_to_user')
ORDER BY routine_name;
