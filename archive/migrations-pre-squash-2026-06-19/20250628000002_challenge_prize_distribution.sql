/*
  Challenge Prize Distribution System

  Automatically distributes prizes when a challenge is finalized.

  Features:
  - Distributes coins, tickets, XP, and other rewards
  - Handles rank-based rewards (top 1, top 3, etc.)
  - Handles range-based rewards (1-10, 11-50, etc.)
  - Handles percentage-based rewards (top 10%, etc.)
  - Records distributed prizes in challenge_participants.reward column
  - Prevents double distribution

  Prize types supported:
  - coins: Add coins to user balance
  - ticket: Grant ticket (rookie/amateur/master/apex)
  - xp: Grant XP points
  - spin: Grant free spins
  - premium_3d / premium_7d: Grant premium subscription
  - giftcard / masterpass / custom: Record in reward column
*/

-- Function to distribute a single reward to a user
CREATE OR REPLACE FUNCTION public.distribute_reward_to_user(
  p_user_id UUID,
  p_reward_type TEXT,
  p_reward_value INTEGER,
  p_reward_tier TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_success BOOLEAN := FALSE;
BEGIN
  CASE p_reward_type
    WHEN 'coins' THEN
      -- Add coins to user balance
      UPDATE public.users
      SET coins_balance = coins_balance + p_reward_value
      WHERE id = p_user_id;
      v_success := TRUE;

    WHEN 'ticket' THEN
      -- Grant ticket (tier specified in p_reward_tier: rookie/amateur/master/apex)
      INSERT INTO public.user_tickets (user_id, ticket_type, expires_at, is_used)
      VALUES (
        p_user_id,
        COALESCE(p_reward_tier, 'rookie'),
        NOW() + INTERVAL '30 days',
        FALSE
      );
      v_success := TRUE;

    WHEN 'xp' THEN
      -- Grant XP (using existing XP system)
      INSERT INTO public.activity_log (user_id, activity_type, xp_earned, activity_metadata)
      VALUES (
        p_user_id,
        'challenge_reward',
        p_reward_value,
        JSONB_BUILD_OBJECT('source', 'prize_distribution')
      );
      v_success := TRUE;

    WHEN 'spin' THEN
      -- Grant free spins (stored in user metadata or separate table)
      -- TODO: Implement spin system if needed
      v_success := TRUE;

    WHEN 'premium_3d' THEN
      -- Grant 3 days of premium
      UPDATE public.users
      SET
        is_subscriber = TRUE,
        subscription_expires_at = GREATEST(
          COALESCE(subscription_expires_at, NOW()),
          NOW()
        ) + INTERVAL '3 days'
      WHERE id = p_user_id;
      v_success := TRUE;

    WHEN 'premium_7d' THEN
      -- Grant 7 days of premium
      UPDATE public.users
      SET
        is_subscriber = TRUE,
        subscription_expires_at = GREATEST(
          COALESCE(subscription_expires_at, NOW()),
          NOW()
        ) + INTERVAL '7 days'
      WHERE id = p_user_id;
      v_success := TRUE;

    ELSE
      -- For giftcard, masterpass, custom: just record in reward column
      v_success := TRUE;
  END CASE;

  RETURN v_success;
END;
$$ LANGUAGE plpgsql;

-- Function to check if a participant qualifies for a reward tier
CREATE OR REPLACE FUNCTION public.participant_qualifies_for_reward(
  p_rank INTEGER,
  p_total_participants INTEGER,
  p_position_type TEXT,
  p_tier_start INTEGER,
  p_tier_end INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_percentage NUMERIC;
BEGIN
  CASE p_position_type
    WHEN 'rank' THEN
      -- Exact rank (e.g., rank 1)
      RETURN (p_rank = p_tier_start);

    WHEN 'range' THEN
      -- Range of ranks (e.g., ranks 1-10)
      IF p_tier_end IS NULL THEN
        RETURN (p_rank = p_tier_start);
      ELSE
        RETURN (p_rank >= p_tier_start AND p_rank <= p_tier_end);
      END IF;

    WHEN 'percent' THEN
      -- Top X% (e.g., top 10%)
      IF p_total_participants = 0 THEN
        RETURN FALSE;
      END IF;
      v_percentage := (p_rank::NUMERIC / p_total_participants::NUMERIC) * 100;
      RETURN (v_percentage <= p_tier_start);

    ELSE
      RETURN FALSE;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Main function to distribute prizes for a challenge
CREATE OR REPLACE FUNCTION public.distribute_challenge_prizes(
  p_challenge_id UUID
)
RETURNS TABLE(
  out_user_id UUID,
  out_rank INTEGER,
  out_rewards_distributed JSONB,
  out_success BOOLEAN
) AS $$
DECLARE
  v_challenge RECORD;
  v_participant RECORD;
  v_prize_tier JSONB;
  v_reward JSONB;
  v_total_participants INTEGER;
  v_qualifies BOOLEAN;
  v_distributed_rewards JSONB;
  v_reward_success BOOLEAN;
BEGIN
  -- Get challenge details
  SELECT * INTO v_challenge
  FROM public.challenges
  WHERE id = p_challenge_id;

  IF v_challenge IS NULL THEN
    RAISE EXCEPTION 'Challenge not found';
  END IF;

  -- Get total participants count
  SELECT COUNT(*) INTO v_total_participants
  FROM public.challenge_participants
  WHERE challenge_id = p_challenge_id;

  -- Loop through all participants
  FOR v_participant IN
    SELECT *
    FROM public.challenge_participants
    WHERE challenge_id = p_challenge_id
    ORDER BY rank ASC
  LOOP
    -- Skip if already has rewards
    IF v_participant.reward IS NOT NULL THEN
      CONTINUE;
    END IF;

    v_distributed_rewards := '[]'::JSONB;

    -- Check each prize tier in the challenge
    IF v_challenge.prizes IS NOT NULL THEN
      FOR v_prize_tier IN SELECT * FROM JSONB_ARRAY_ELEMENTS(v_challenge.prizes)
      LOOP
        -- Check if participant qualifies for this tier
        v_qualifies := public.participant_qualifies_for_reward(
          v_participant.rank,
          v_total_participants,
          v_prize_tier->>'positionType',
          (v_prize_tier->>'start')::INTEGER,
          CASE WHEN v_prize_tier->>'end' IS NOT NULL
            THEN (v_prize_tier->>'end')::INTEGER
            ELSE NULL
          END
        );

        IF v_qualifies THEN
          -- Distribute each reward in this tier
          FOR v_reward IN SELECT * FROM JSONB_ARRAY_ELEMENTS(v_prize_tier->'rewards')
          LOOP
            -- Distribute the reward
            v_reward_success := public.distribute_reward_to_user(
              v_participant.user_id,
              v_reward->>'type',
              COALESCE((v_reward->>'value')::INTEGER, 0),
              v_reward->>'tier'
            );

            -- Add to distributed rewards list
            IF v_reward_success THEN
              v_distributed_rewards := v_distributed_rewards || JSONB_BUILD_ARRAY(v_reward);
            END IF;
          END LOOP;

          -- Only apply first matching tier (prevent double rewards)
          EXIT;
        END IF;
      END LOOP;
    END IF;

    -- Update participant with distributed rewards
    UPDATE public.challenge_participants
    SET reward = v_distributed_rewards
    WHERE id = v_participant.id;

    -- Return result for this participant
    RETURN QUERY SELECT
      v_participant.user_id,
      v_participant.rank,
      v_distributed_rewards,
      TRUE;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to auto-distribute prizes when challenge is finalized
CREATE OR REPLACE FUNCTION public.trigger_distribute_prizes_on_finalize()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if status changed to 'finished'
  IF NEW.status = 'finished' AND (OLD.status IS NULL OR OLD.status != 'finished') THEN
    -- Distribute prizes automatically
    PERFORM public.distribute_challenge_prizes(NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on challenges table
DROP TRIGGER IF EXISTS on_challenge_finalized_distribute_prizes ON public.challenges;
CREATE TRIGGER on_challenge_finalized_distribute_prizes
  AFTER UPDATE ON public.challenges
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_distribute_prizes_on_finalize();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.distribute_reward_to_user(UUID, TEXT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.participant_qualifies_for_reward(INTEGER, INTEGER, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.distribute_challenge_prizes(UUID) TO authenticated;

-- Add comments
COMMENT ON FUNCTION public.distribute_reward_to_user IS 'Distributes a single reward (coins, ticket, XP, etc.) to a user';
COMMENT ON FUNCTION public.participant_qualifies_for_reward IS 'Checks if a participant qualifies for a reward tier based on rank/range/percent';
COMMENT ON FUNCTION public.distribute_challenge_prizes IS 'Distributes all prizes for a challenge based on final rankings';
COMMENT ON FUNCTION public.trigger_distribute_prizes_on_finalize IS 'Trigger function that auto-distributes prizes when challenge status → finished';
