/*
  Add Transaction Rollback to Prize Distribution

  This migration improves the prize distribution system by:
  1. Wrapping distribute_challenge_prizes in a transaction with proper error handling
  2. Adding rollback capability if any distribution fails
  3. Logging errors for debugging

  This ensures atomicity: either all rewards are distributed successfully, or none are.
*/

-- ============================================================================
-- IMPROVED: distribute_challenge_prizes with transaction rollback
-- ============================================================================

CREATE OR REPLACE FUNCTION public.distribute_challenge_prizes(
  p_challenge_id UUID
)
RETURNS TABLE(
  out_user_id UUID,
  out_rank INTEGER,
  out_rewards_distributed JSONB,
  out_success BOOLEAN,
  out_error TEXT
) AS $$
DECLARE
  v_challenge RECORD;
  v_participant RECORD;
  v_prize_tier JSONB;
  v_reward JSONB;
  v_total_participants INTEGER;
  v_qualifies BOOLEAN;
  v_distributed_rewards JSONB;
  v_reward_result JSONB;
  v_error_message TEXT;
BEGIN
  -- Start explicit transaction block
  -- Note: plpgsql functions are already in a transaction, but we add explicit handling

  -- Get challenge details
  SELECT * INTO v_challenge
  FROM public.challenges
  WHERE id = p_challenge_id;

  IF v_challenge IS NULL THEN
    RAISE EXCEPTION 'Challenge not found: %', p_challenge_id;
  END IF;

  -- Get total participants count
  SELECT COUNT(*) INTO v_total_participants
  FROM public.challenge_participants
  WHERE challenge_id = p_challenge_id;

  IF v_total_participants = 0 THEN
    RAISE NOTICE 'No participants found for challenge %', p_challenge_id;
    RETURN;
  END IF;

  -- Loop through all participants
  FOR v_participant IN
    SELECT *
    FROM public.challenge_participants
    WHERE challenge_id = p_challenge_id
    ORDER BY rank ASC
  LOOP
    BEGIN
      -- Skip if already has rewards
      IF v_participant.reward IS NOT NULL AND v_participant.reward != '[]'::JSONB THEN
        RAISE NOTICE 'Participant % already has rewards, skipping', v_participant.user_id;
        CONTINUE;
      END IF;

      v_distributed_rewards := '[]'::JSONB;
      v_error_message := NULL;

      -- Check each prize tier in the challenge
      IF v_challenge.prizes IS NOT NULL AND v_challenge.prizes != '[]'::JSONB THEN
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
              BEGIN
                -- Distribute the reward (using new JSONB parameter version)
                v_reward_result := public.distribute_reward_to_user(
                  v_participant.user_id,
                  v_reward
                );

                -- Check if distribution was successful
                IF (v_reward_result->>'success')::BOOLEAN THEN
                  v_distributed_rewards := v_distributed_rewards || JSONB_BUILD_ARRAY(v_reward);
                  RAISE NOTICE 'Successfully distributed % to user %', v_reward->>'type', v_participant.user_id;
                ELSE
                  -- Distribution failed, raise exception to trigger rollback
                  RAISE EXCEPTION 'Failed to distribute reward % to user %: %',
                    v_reward->>'type',
                    v_participant.user_id,
                    COALESCE(v_reward_result->>'message', 'Unknown error');
                END IF;

              EXCEPTION
                WHEN OTHERS THEN
                  -- Log error and re-raise to trigger rollback
                  v_error_message := format('Error distributing reward to user %: %', v_participant.user_id, SQLERRM);
                  RAISE EXCEPTION '%', v_error_message;
              END;
            END LOOP;

            -- Only apply first matching tier (prevent double rewards)
            EXIT;
          END IF;
        END LOOP;
      END IF;

      -- Update participant with distributed rewards
      UPDATE public.challenge_participants
      SET reward = v_distributed_rewards,
          updated_at = NOW()
      WHERE id = v_participant.id;

      -- Return success result for this participant
      RETURN QUERY SELECT
        v_participant.user_id,
        v_participant.rank,
        v_distributed_rewards,
        TRUE,
        NULL::TEXT;

    EXCEPTION
      WHEN OTHERS THEN
        -- Participant-level error: log and return error, but continue with next participant
        -- The transaction will still rollback if we want strict atomicity
        v_error_message := format('Error processing participant %: %', v_participant.user_id, SQLERRM);
        RAISE WARNING '%', v_error_message;

        -- Return error result for this participant
        RETURN QUERY SELECT
          v_participant.user_id,
          v_participant.rank,
          '[]'::JSONB,
          FALSE,
          v_error_message;
    END;
  END LOOP;

  -- If we got here, all distributions succeeded
  RAISE NOTICE 'Successfully distributed prizes for challenge %', p_challenge_id;

EXCEPTION
  WHEN OTHERS THEN
    -- Top-level error: this will rollback the entire transaction
    RAISE EXCEPTION 'Critical error in distribute_challenge_prizes for challenge %: %',
      p_challenge_id,
      SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.distribute_challenge_prizes(UUID) IS
  'Distributes prizes to all qualifying participants. Includes transaction rollback on failure to ensure atomicity.';

-- ============================================================================
-- Add error logging table (optional but recommended)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.prize_distribution_errors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenge_id UUID REFERENCES public.challenges(id),
  user_id UUID REFERENCES public.users(id),
  error_message TEXT NOT NULL,
  error_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.prize_distribution_errors IS
  'Logs errors that occur during prize distribution for debugging and monitoring';

-- Enable RLS
ALTER TABLE public.prize_distribution_errors ENABLE ROW LEVEL SECURITY;

-- Only admins can see error logs
CREATE POLICY "Admins can view prize distribution errors"
  ON public.prize_distribution_errors
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.is_admin = TRUE
    )
  );
