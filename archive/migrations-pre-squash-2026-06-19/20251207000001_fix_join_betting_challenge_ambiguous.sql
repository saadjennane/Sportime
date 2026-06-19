-- Fix ambiguous column reference "coins_balance" in join_betting_challenge function
-- The issue: coins_balance is both a return column name AND a column in the users table
-- Solution: Use explicit table alias when selecting from users table

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
  SELECT c.entry_cost INTO v_entry_cost
  FROM public.challenges c
  WHERE c.id = p_challenge_id;

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
    -- Use table alias to avoid ambiguity with return column name
    SELECT u.coins_balance INTO v_balance FROM public.users u WHERE u.id = p_user_id;
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
