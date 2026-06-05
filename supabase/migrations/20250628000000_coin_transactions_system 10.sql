/*
  Coin Transactions System for Supabase

  Creates comprehensive coin transaction tracking with RPC functions.
  - Logs all coin additions and deductions
  - Provides balance checking and transaction history
  - Updates existing functions to use transaction logging
*/

-- =====================================================
-- Table: coin_transactions
-- =====================================================
CREATE TABLE IF NOT EXISTS public.coin_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Positive for addition, negative for deduction
  balance_after INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'shop_purchase',
    'daily_streak',
    'spin_wheel',
    'challenge_entry',
    'challenge_refund',
    'challenge_reward',
    'premium_bonus',
    'referral_reward',
    'admin_adjustment',
    'initial_bonus'
  )),
  metadata JSONB DEFAULT '{}', -- Store pack_id, challenge_id, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_coin_transactions_user_id ON public.coin_transactions(user_id);
CREATE INDEX idx_coin_transactions_type ON public.coin_transactions(transaction_type);
CREATE INDEX idx_coin_transactions_created ON public.coin_transactions(created_at DESC);

-- Enable RLS
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own transactions
CREATE POLICY "Users can view own transactions"
  ON public.coin_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all transactions
CREATE POLICY "Admins can view all transactions"
  ON public.coin_transactions
  FOR SELECT
  USING (public.is_admin());

-- =====================================================
-- RPC Function: add_coins
-- =====================================================
CREATE OR REPLACE FUNCTION public.add_coins(
  p_user_id UUID,
  p_amount INTEGER,
  p_transaction_type TEXT,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE(
  success BOOLEAN,
  new_balance INTEGER,
  transaction_id UUID
) AS $$
DECLARE
  v_new_balance INTEGER;
  v_transaction_id UUID;
BEGIN
  -- Validate user (must be self or admin)
  IF p_user_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Add coins and get new balance
  UPDATE public.users
  SET coins_balance = coins_balance + p_amount
  WHERE id = p_user_id
  RETURNING coins_balance INTO v_new_balance;

  -- Log transaction
  INSERT INTO public.coin_transactions (user_id, amount, balance_after, transaction_type, metadata)
  VALUES (p_user_id, p_amount, v_new_balance, p_transaction_type, p_metadata)
  RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT true, v_new_balance, v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RPC Function: deduct_coins
-- =====================================================
CREATE OR REPLACE FUNCTION public.deduct_coins(
  p_user_id UUID,
  p_amount INTEGER,
  p_transaction_type TEXT,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE(
  success BOOLEAN,
  new_balance INTEGER,
  transaction_id UUID
) AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_transaction_id UUID;
BEGIN
  -- Validate user (must be self or admin)
  IF p_user_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Check balance and deduct
  SELECT coins_balance INTO v_current_balance
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_COINS';
  END IF;

  UPDATE public.users
  SET coins_balance = coins_balance - p_amount
  WHERE id = p_user_id
  RETURNING coins_balance INTO v_new_balance;

  -- Log transaction (negative amount)
  INSERT INTO public.coin_transactions (user_id, amount, balance_after, transaction_type, metadata)
  VALUES (p_user_id, -p_amount, v_new_balance, p_transaction_type, p_metadata)
  RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT true, v_new_balance, v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RPC Function: get_coin_balance
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_coin_balance(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  SELECT coins_balance INTO v_balance
  FROM public.users
  WHERE id = p_user_id;

  RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RPC Function: refund_challenge_entry
-- =====================================================
CREATE OR REPLACE FUNCTION public.refund_challenge_entry(
  p_challenge_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_entry_cost INTEGER;
  v_entry_method TEXT;
BEGIN
  -- Get challenge entry cost
  SELECT entry_cost INTO v_entry_cost
  FROM public.challenges
  WHERE id = p_challenge_id;

  -- Get user's entry method
  SELECT entry_method INTO v_entry_method
  FROM public.challenge_entries
  WHERE challenge_id = p_challenge_id AND user_id = p_user_id;

  -- Only refund if paid with coins
  IF v_entry_method = 'coins' THEN
    PERFORM public.add_coins(
      p_user_id,
      v_entry_cost,
      'challenge_refund',
      jsonb_build_object('challenge_id', p_challenge_id)
    );
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.add_coins(UUID, INTEGER, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_coins(UUID, INTEGER, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_coin_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_challenge_entry(UUID, UUID) TO authenticated;

-- =====================================================
-- Update claim_daily_streak to use add_coins
-- =====================================================
CREATE OR REPLACE FUNCTION public.claim_daily_streak(p_user_id UUID)
RETURNS TABLE(
  success BOOLEAN,
  streak_day INTEGER,
  reward_type TEXT,
  reward_amount INTEGER,
  new_balance INTEGER
) AS $$
DECLARE
  v_check RECORD;
  v_new_day INTEGER;
  v_reward_coins INTEGER;
  v_reward_ticket TEXT;
  v_new_balance INTEGER;
  v_add_result RECORD;
BEGIN
  -- Check if user can claim
  SELECT * INTO v_check FROM public.check_daily_streak(p_user_id);

  IF NOT v_check.is_available THEN
    RAISE EXCEPTION 'Streak not available to claim';
  END IF;

  v_new_day := v_check.streak_day;

  -- Determine reward based on day
  CASE v_new_day
    WHEN 1 THEN v_reward_coins := 100;
    WHEN 2 THEN v_reward_coins := 200;
    WHEN 3 THEN v_reward_coins := 300;
    WHEN 4, 5, 6 THEN v_reward_coins := 500;
    WHEN 7 THEN v_reward_ticket := 'rookie';
  END CASE;

  -- Update or insert streak record
  INSERT INTO public.user_streaks (user_id, current_day, last_claimed_at)
  VALUES (p_user_id, v_new_day, now())
  ON CONFLICT (user_id) DO UPDATE
  SET
    current_day = v_new_day,
    last_claimed_at = now(),
    updated_at = now();

  -- Grant coin reward
  IF v_reward_coins IS NOT NULL THEN
    -- Use add_coins RPC to log transaction
    SELECT * INTO v_add_result
    FROM public.add_coins(
      p_user_id,
      v_reward_coins,
      'daily_streak',
      jsonb_build_object('streak_day', v_new_day)
    );

    RETURN QUERY SELECT
      true,
      v_new_day,
      'coins'::TEXT,
      v_reward_coins,
      v_add_result.new_balance;
    RETURN;
  END IF;

  -- Grant ticket reward (Day 7)
  IF v_reward_ticket IS NOT NULL THEN
    -- Insert ticket into user_tickets table
    INSERT INTO public.user_tickets (user_id, ticket_type, expires_at)
    VALUES (
      p_user_id,
      v_reward_ticket,
      now() + INTERVAL '30 days'
    );

    -- Get current balance
    SELECT coins_balance INTO v_new_balance
    FROM public.users
    WHERE id = p_user_id;

    RETURN QUERY SELECT
      true,
      v_new_day,
      'ticket'::TEXT,
      0,
      v_new_balance;
    RETURN;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Update join_betting_challenge to use deduct_coins
-- =====================================================
CREATE OR REPLACE FUNCTION public.join_betting_challenge(
  p_challenge_id UUID,
  p_user_id UUID,
  p_method TEXT,
  p_ticket_id UUID DEFAULT NULL
) RETURNS TABLE(already_joined BOOLEAN, coins_balance INTEGER) AS $$
DECLARE
  v_entry_cost INTEGER;
  v_rows BIGINT;
  v_balance INTEGER;
  v_deduct_result RECORD;
BEGIN
  -- Validate user
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Validate method
  IF p_method NOT IN ('coins', 'ticket') THEN
    RAISE EXCEPTION 'Invalid entry method %', p_method;
  END IF;

  -- Get challenge entry cost
  SELECT entry_cost INTO v_entry_cost
  FROM public.challenges
  WHERE id = p_challenge_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge not found';
  END IF;

  -- Add to challenge_participants
  INSERT INTO public.challenge_participants (challenge_id, user_id)
  VALUES (p_challenge_id, p_user_id)
  ON CONFLICT (challenge_id, user_id) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  already_joined := v_rows = 0;

  -- Deduct coins if using coins and not already joined
  IF p_method = 'coins' AND NOT already_joined THEN
    -- Use deduct_coins RPC to log transaction
    SELECT * INTO v_deduct_result
    FROM public.deduct_coins(
      p_user_id,
      v_entry_cost,
      'challenge_entry',
      jsonb_build_object('challenge_id', p_challenge_id)
    );
    v_balance := v_deduct_result.new_balance;
  ELSE
    SELECT coins_balance INTO v_balance FROM public.users WHERE id = p_user_id;
  END IF;

  -- Log challenge entry
  INSERT INTO public.challenge_entries (challenge_id, user_id, entry_method, ticket_id)
  VALUES (p_challenge_id, p_user_id, p_method, p_ticket_id)
  ON CONFLICT (challenge_id, user_id) DO UPDATE
  SET entry_method = EXCLUDED.entry_method, ticket_id = EXCLUDED.ticket_id, updated_at = now();

  coins_balance := v_balance;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Show transaction types reference
SELECT
  unnest(ARRAY[
    'shop_purchase',
    'daily_streak',
    'spin_wheel',
    'challenge_entry',
    'challenge_refund',
    'challenge_reward',
    'premium_bonus',
    'referral_reward',
    'admin_adjustment',
    'initial_bonus'
  ]) as transaction_type,
  unnest(ARRAY[
    'User purchases coins from shop',
    'User claims daily streak reward',
    'User receives coins from spin wheel',
    'User pays coins to enter challenge',
    'Challenge cancelled, coins refunded',
    'User wins challenge and receives reward',
    'User receives bonus for premium subscription',
    'User receives reward for referring someone',
    'Admin manually adjusts balance',
    'Initial account creation bonus'
  ]) as description;
