/*
  Integrate Fulfillment System with Reward Distribution

  This migration updates the distribute_reward_to_user function to:
  1. Automatically create fulfillment records for manual rewards
  2. Mark instant rewards as auto-fulfilled
  3. Return fulfillment status in the response
*/

-- ============================================================================
-- UPDATED: distribute_reward_to_user with fulfillment integration
-- ============================================================================

CREATE OR REPLACE FUNCTION public.distribute_reward_to_user(
  p_user_id UUID,
  p_reward JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_reward_type TEXT;
  v_value TEXT;
  v_tier TEXT;
  v_result JSONB;
  v_notification_message TEXT;
  v_fulfillment_id UUID;
  v_requires_fulfillment BOOLEAN := false;
BEGIN
  -- Extract reward properties
  v_reward_type := p_reward->>'type';
  v_value := p_reward->>'value';
  v_tier := p_reward->>'tier';

  -- Determine if reward requires manual fulfillment
  IF v_reward_type IN ('giftcard', 'masterpass', 'custom') THEN
    v_requires_fulfillment := true;
  END IF;

  -- Handle instant rewards (auto-fulfilled)
  IF NOT v_requires_fulfillment THEN
    CASE v_reward_type
      WHEN 'coins' THEN
        UPDATE public.users
        SET coins_balance = coins_balance + v_value::INTEGER
        WHERE id = p_user_id;

        v_notification_message := format('You received %s coins!', v_value);

      WHEN 'xp' THEN
        UPDATE public.users
        SET total_xp = COALESCE(total_xp, 0) + v_value::INTEGER
        WHERE id = p_user_id;

        v_notification_message := format('You earned %s XP!', v_value);

      WHEN 'ticket' THEN
        INSERT INTO public.user_tickets (user_id, type, expires_at)
        VALUES (
          p_user_id,
          v_tier::public.tournament_type,
          NOW() + INTERVAL '30 days'
        );

        v_notification_message := format('You won a %s tournament ticket!', INITCAP(v_tier));

      WHEN 'spin' THEN
        INSERT INTO public.user_spins (user_id, tier, expires_at)
        VALUES (
          p_user_id,
          v_tier,
          NOW() + INTERVAL '7 days'
        );

        v_notification_message := format('You won a %s spin!', INITCAP(v_tier));

      WHEN 'premium_3d' THEN
        UPDATE public.users
        SET
          is_premium = true,
          premium_expires_at = GREATEST(
            COALESCE(premium_expires_at, NOW()),
            NOW()
          ) + INTERVAL '3 days'
        WHERE id = p_user_id;

        v_notification_message := 'You received 3 days of Premium!';

      WHEN 'premium_7d' THEN
        UPDATE public.users
        SET
          is_premium = true,
          premium_expires_at = GREATEST(
            COALESCE(premium_expires_at, NOW()),
            NOW()
          ) + INTERVAL '7 days'
        WHERE id = p_user_id;

        v_notification_message := 'You received 7 days of Premium!';

      ELSE
        RAISE WARNING 'Unknown instant reward type: %', v_reward_type;
        RETURN jsonb_build_object(
          'success', false,
          'message', format('Unknown reward type: %s', v_reward_type)
        );
    END CASE;

    v_result := jsonb_build_object(
      'success', true,
      'message', v_notification_message,
      'reward_type', v_reward_type,
      'requires_fulfillment', false
    );

  -- Handle rewards requiring manual fulfillment
  ELSE
    -- Create fulfillment record
    v_fulfillment_id := public.create_reward_fulfillment(
      p_user_id,
      v_reward_type,
      p_reward,
      'challenge', -- default source type
      NULL -- source_id will be set by caller if needed
    );

    v_notification_message := format_reward_notification_message(p_reward) ||
                              ' Your reward will be processed shortly.';

    v_result := jsonb_build_object(
      'success', true,
      'message', v_notification_message,
      'reward_type', v_reward_type,
      'requires_fulfillment', true,
      'fulfillment_id', v_fulfillment_id
    );
  END IF;

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
    p_user_id,
    'reward',
    '🎁 Reward Earned!',
    v_notification_message,
    'View Profile',
    '/profile',
    jsonb_build_object(
      'reward_type', v_reward_type,
      'reward_value', v_value,
      'reward_tier', v_tier,
      'requires_fulfillment', v_requires_fulfillment,
      'fulfillment_id', v_fulfillment_id
    )
  );

  RAISE NOTICE 'Distributed % reward to user % (fulfillment: %)',
    v_reward_type, p_user_id, v_requires_fulfillment;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error distributing reward to user %: %', p_user_id, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'message', format('Error distributing reward: %s', SQLERRM)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.distribute_reward_to_user(UUID, JSONB) IS
  'Distributes a reward to a user. Auto-fulfills instant rewards, creates fulfillment records for manual rewards.';
