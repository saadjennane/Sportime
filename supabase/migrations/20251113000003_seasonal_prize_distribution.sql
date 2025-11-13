/*
  Seasonal Prize Distribution Integration

  This migration adds support for seasonal prize distribution that integrates
  with the main reward distribution system. This ensures seasonal prizes:
  1. Go through the same validation and error handling
  2. Create reward notifications
  3. Are tracked and logged properly

  Usage:
  SELECT * FROM distribute_seasonal_prizes(
    'game-id',
    '2025-01-01T00:00:00Z',
    '2025-03-31T23:59:59Z',
    10, -- top N players
    '{"type": "coins", "value": 5000}'::JSONB
  );
*/

-- ============================================================================
-- FUNCTION: distribute_seasonal_prizes
-- ============================================================================

CREATE OR REPLACE FUNCTION public.distribute_seasonal_prizes(
  p_game_id UUID,
  p_period_start TIMESTAMP WITH TIME ZONE,
  p_period_end TIMESTAMP WITH TIME ZONE,
  p_top_n INTEGER,
  p_reward JSONB
)
RETURNS TABLE(
  out_user_id UUID,
  out_rank INTEGER,
  out_username TEXT,
  out_score INTEGER,
  out_reward_distributed JSONB,
  out_success BOOLEAN,
  out_error TEXT
) AS $$
DECLARE
  v_game RECORD;
  v_winner RECORD;
  v_reward_result JSONB;
  v_error_message TEXT;
  v_rank_counter INTEGER := 1;
BEGIN
  -- Validate game exists
  SELECT * INTO v_game
  FROM public.games
  WHERE id = p_game_id;

  IF v_game IS NULL THEN
    RAISE EXCEPTION 'Game not found: %', p_game_id;
  END IF;

  -- Validate it's a season game
  IF v_game.duration_type != 'season' THEN
    RAISE WARNING 'Game % is not a season game (duration_type: %)', p_game_id, v_game.duration_type;
  END IF;

  -- Get top N players for the period
  -- This query calculates aggregated scores per user within the period
  FOR v_winner IN
    WITH participant_scores AS (
      SELECT
        cp.user_id,
        u.username,
        SUM(cp.score) AS total_score
      FROM public.challenge_participants cp
      INNER JOIN public.users u ON u.id = cp.user_id
      WHERE cp.challenge_id = p_game_id
        AND cp.created_at BETWEEN p_period_start AND p_period_end
      GROUP BY cp.user_id, u.username
      ORDER BY SUM(cp.score) DESC
      LIMIT p_top_n
    )
    SELECT * FROM participant_scores
  LOOP
    BEGIN
      -- Distribute reward using the main reward distribution function
      v_reward_result := public.distribute_reward_to_user(
        v_winner.user_id,
        p_reward
      );

      -- Check if distribution was successful
      IF (v_reward_result->>'success')::BOOLEAN THEN
        RAISE NOTICE 'Successfully distributed seasonal reward to user % (rank %, score: %)',
          v_winner.user_id, v_rank_counter, v_winner.total_score;

        -- Return success result
        RETURN QUERY SELECT
          v_winner.user_id,
          v_rank_counter,
          v_winner.username,
          v_winner.total_score::INTEGER,
          p_reward,
          TRUE,
          NULL::TEXT;
      ELSE
        -- Distribution failed
        v_error_message := format('Failed to distribute reward: %',
          COALESCE(v_reward_result->>'message', 'Unknown error'));

        RAISE WARNING '%', v_error_message;

        RETURN QUERY SELECT
          v_winner.user_id,
          v_rank_counter,
          v_winner.username,
          v_winner.total_score::INTEGER,
          '[]'::JSONB,
          FALSE,
          v_error_message;
      END IF;

      v_rank_counter := v_rank_counter + 1;

    EXCEPTION
      WHEN OTHERS THEN
        v_error_message := format('Error distributing seasonal reward to user %: %',
          v_winner.user_id, SQLERRM);
        RAISE WARNING '%', v_error_message;

        -- Log error
        INSERT INTO public.prize_distribution_errors (
          challenge_id,
          user_id,
          error_message,
          error_details
        ) VALUES (
          p_game_id,
          v_winner.user_id,
          v_error_message,
          jsonb_build_object(
            'period_start', p_period_start,
            'period_end', p_period_end,
            'rank', v_rank_counter,
            'score', v_winner.total_score
          )
        );

        RETURN QUERY SELECT
          v_winner.user_id,
          v_rank_counter,
          v_winner.username,
          v_winner.total_score::INTEGER,
          '[]'::JSONB,
          FALSE,
          v_error_message;

        v_rank_counter := v_rank_counter + 1;
    END;
  END LOOP;

  RAISE NOTICE 'Seasonal prize distribution completed for game %', p_game_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Critical error in distribute_seasonal_prizes for game %: %',
      p_game_id, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.distribute_seasonal_prizes(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, INTEGER, JSONB) IS
  'Distributes prizes to top N players for a seasonal game within a specified period. Integrates with the main reward distribution system.';

-- ============================================================================
-- FUNCTION: create_seasonal_celebration
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_seasonal_celebration(
  p_game_id UUID,
  p_period_start TIMESTAMP WITH TIME ZONE,
  p_period_end TIMESTAMP WITH TIME ZONE,
  p_message TEXT,
  p_winners JSONB -- Array of {user_id, rank, username, score, reward}
)
RETURNS UUID AS $$
DECLARE
  v_celebration_id UUID;
  v_game_name TEXT;
BEGIN
  -- Get game name
  SELECT name INTO v_game_name
  FROM public.games
  WHERE id = p_game_id;

  -- Create celebration feed entry (if you have a celebrations table)
  -- For now, we'll just create notifications for all winners

  -- Create notifications for each winner
  FOR i IN 0..jsonb_array_length(p_winners) - 1 LOOP
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      action_label,
      action_link,
      metadata
    ) VALUES (
      (p_winners->i->>'user_id')::UUID,
      'system',
      format('🏆 Seasonal Winner - %s', v_game_name),
      p_message,
      'View Game',
      format('/games/%s', p_game_id),
      jsonb_build_object(
        'celebration_type', 'seasonal',
        'game_id', p_game_id,
        'rank', (p_winners->i->>'rank')::INTEGER,
        'period_start', p_period_start,
        'period_end', p_period_end
      )
    );
  END LOOP;

  -- Return a generated celebration ID (you could store this in a table)
  v_celebration_id := uuid_generate_v4();

  RAISE NOTICE 'Created seasonal celebration % with % winners', v_celebration_id, jsonb_array_length(p_winners);

  RETURN v_celebration_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.create_seasonal_celebration(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT, JSONB) IS
  'Creates celebration notifications for seasonal winners';
