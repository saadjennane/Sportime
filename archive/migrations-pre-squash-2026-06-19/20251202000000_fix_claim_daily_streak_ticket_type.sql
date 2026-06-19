/*
  Fix claim_daily_streak function to use correct ticket_type enum value

  Problem: Day 7 reward uses 'rookie' but the ticket_type enum only has
  ('amateur', 'master', 'apex'). Also needs explicit cast to ticket_type.
*/

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
  v_reward_ticket public.ticket_type;  -- Use the enum type directly
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
    WHEN 7 THEN v_reward_ticket := 'amateur'::public.ticket_type;  -- Fixed: use 'amateur' instead of 'rookie'
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
    -- Insert ticket into user_tickets table with proper enum type
    INSERT INTO public.user_tickets (user_id, ticket_type, expires_at)
    VALUES (
      p_user_id,
      v_reward_ticket,  -- Already typed as ticket_type enum
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

-- Re-grant execute permission
GRANT EXECUTE ON FUNCTION public.claim_daily_streak(UUID) TO authenticated;
