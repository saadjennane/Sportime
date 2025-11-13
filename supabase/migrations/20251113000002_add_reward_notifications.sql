/*
  Add Reward Notifications Integration

  This migration enhances the notifications system for rewards:
  1. Add 'reward' notification type
  2. Modify distribute_reward_to_user to create notifications
  3. Add helper function to format reward notification messages
*/

-- ============================================================================
-- UPDATE: Add 'reward' to notification types
-- ============================================================================

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('gameplay', 'league', 'squad', 'premium', 'reminder', 'system', 'reward'));

COMMENT ON COLUMN public.notifications.type IS
  'Notification category: gameplay, league, squad, premium, reminder, system, or reward';

-- ============================================================================
-- FUNCTION: format_reward_notification_message
-- ============================================================================

CREATE OR REPLACE FUNCTION public.format_reward_notification_message(
  p_reward JSONB
)
RETURNS TEXT AS $$
DECLARE
  v_type TEXT;
  v_value TEXT;
  v_tier TEXT;
  v_name TEXT;
  v_message TEXT;
BEGIN
  v_type := p_reward->>'type';
  v_value := p_reward->>'value';
  v_tier := p_reward->>'tier';
  v_name := p_reward->>'name';

  CASE v_type
    WHEN 'coins' THEN
      v_message := format('You received %s coins!', v_value);

    WHEN 'xp' THEN
      v_message := format('You earned %s XP!', v_value);

    WHEN 'ticket' THEN
      v_message := format('You won a %s tournament ticket!', INITCAP(v_tier));

    WHEN 'spin' THEN
      v_message := format('You received a %s spin!', INITCAP(v_tier));

    WHEN 'masterpass' THEN
      v_message := format('You earned a %s MasterPass!', INITCAP(v_tier));

    WHEN 'premium_3d' THEN
      v_message := 'You received 3 days of premium subscription!';

    WHEN 'premium_7d' THEN
      v_message := 'You received 7 days of premium subscription!';

    WHEN 'giftcard' THEN
      v_message := format('You won a €%s gift card!', v_value);

    WHEN 'custom' THEN
      v_message := format('You won: %s!', COALESCE(v_name, 'Special Reward'));

    ELSE
      v_message := format('You received a %s reward!', v_type);
  END CASE;

  RETURN v_message;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.format_reward_notification_message(JSONB) IS
  'Formats a user-friendly notification message for a reward';

-- ============================================================================
-- UPDATE: distribute_reward_to_user with notification creation
-- ============================================================================

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
  v_notification_message TEXT;
BEGIN
  v_reward_type := p_reward->>'type';
  v_value := COALESCE((p_reward->>'value')::INTEGER, 0);
  v_tier := p_reward->>'tier';

  -- Format notification message
  v_notification_message := public.format_reward_notification_message(p_reward);

  -- Distribution logic (same as before)
  IF v_reward_type = 'coins' THEN
    SELECT coin_balance INTO v_current_balance
    FROM public.users
    WHERE id = p_user_id;

    UPDATE public.users
    SET coin_balance = coin_balance + v_value
    WHERE id = p_user_id;

    -- Log transaction
    INSERT INTO public.coin_transactions (user_id, amount, balance_after, transaction_type, metadata)
    VALUES (
      p_user_id,
      v_value,
      v_current_balance + v_value,
      'challenge_reward',
      jsonb_build_object('reward_type', 'coins', 'amount', v_value)
    );

    v_result := jsonb_build_object(
      'success', TRUE,
      'type', 'coins',
      'value', v_value,
      'message', format('Awarded %s coins', v_value)
    );

  ELSIF v_reward_type = 'xp' THEN
    SELECT xp INTO v_current_xp
    FROM public.users
    WHERE id = p_user_id;

    -- Insert activity log (which will trigger xp update)
    INSERT INTO public.activity_log (user_id, action_type, xp_gained, metadata)
    VALUES (
      p_user_id,
      'challenge_reward',
      v_value,
      jsonb_build_object('reward_type', 'xp', 'amount', v_value)
    );

    v_result := jsonb_build_object(
      'success', TRUE,
      'type', 'xp',
      'value', v_value,
      'message', format('Awarded %s XP', v_value)
    );

  ELSIF v_reward_type = 'ticket' THEN
    PERFORM public.grant_ticket(p_user_id, v_tier::public.tournament_type, 30, 'challenge_reward');

    v_result := jsonb_build_object(
      'success', TRUE,
      'type', 'ticket',
      'tier', v_tier,
      'message', format('Granted %s ticket', v_tier)
    );

  ELSIF v_reward_type = 'spin' THEN
    PERFORM public.grant_spin(p_user_id, v_tier, COALESCE(v_value, 1));

    v_result := jsonb_build_object(
      'success', TRUE,
      'type', 'spin',
      'tier', v_tier,
      'quantity', COALESCE(v_value, 1),
      'message', 'Spin reward granted'
    );

  ELSIF v_reward_type = 'premium_3d' OR v_reward_type = 'premium_7d' THEN
    DECLARE
      v_days INTEGER := CASE v_reward_type WHEN 'premium_3d' THEN 3 ELSE 7 END;
      v_new_expiry TIMESTAMPTZ;
    BEGIN
      UPDATE public.users
      SET subscription_expires_at = GREATEST(
        COALESCE(subscription_expires_at, NOW()),
        NOW()
      ) + (v_days || ' days')::INTERVAL
      WHERE id = p_user_id
      RETURNING subscription_expires_at INTO v_new_expiry;

      v_result := jsonb_build_object(
        'success', TRUE,
        'type', v_reward_type,
        'days', v_days,
        'new_expiry', v_new_expiry,
        'message', format('Premium extended by %s days', v_days)
      );
    END;

  ELSIF v_reward_type = 'giftcard' THEN
    -- Placeholder: Grant 5000 coins
    UPDATE public.users
    SET coin_balance = coin_balance + 5000
    WHERE id = p_user_id;

    RAISE NOTICE 'Gift card reward converted to 5000 coins placeholder for user %', p_user_id;

    v_result := jsonb_build_object(
      'success', TRUE,
      'type', 'giftcard_placeholder',
      'value', 5000,
      'original_value', v_value,
      'message', 'Gift card reward (5000 coins placeholder)'
    );

  ELSIF v_reward_type = 'masterpass' THEN
    -- Placeholder: Grant 5000 coins
    UPDATE public.users
    SET coin_balance = coin_balance + 5000
    WHERE id = p_user_id;

    RAISE NOTICE 'MasterPass reward converted to 5000 coins placeholder for user %', p_user_id;

    v_result := jsonb_build_object(
      'success', TRUE,
      'type', 'masterpass_placeholder',
      'value', 5000,
      'tier', v_tier,
      'message', 'MasterPass reward (5000 coins placeholder)'
    );

  ELSE
    RAISE NOTICE 'Unknown or custom reward type: % for user %', v_reward_type, p_user_id;
    v_result := jsonb_build_object(
      'success', FALSE,
      'type', v_reward_type,
      'message', 'Unknown or unhandled reward type'
    );
  END IF;

  -- Create notification if distribution was successful
  IF (v_result->>'success')::BOOLEAN THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      action_label,
      action_link,
      metadata
    ) VALUES (
      p_user_id,
      'reward',
      '🎁 Reward Earned!',
      v_notification_message,
      'View Profile',
      '/profile',
      jsonb_build_object(
        'reward_type', v_reward_type,
        'reward_value', v_value,
        'reward_tier', v_tier
      )
    );

    RAISE NOTICE 'Created reward notification for user %: %', p_user_id, v_notification_message;
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.distribute_reward_to_user(UUID, JSONB) IS
  'Distributes a reward to a user and creates a notification. Returns JSONB with success status.';
