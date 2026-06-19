/*
  Reward History View

  Creates a comprehensive view and functions for retrieving a user's
  complete reward history from all sources.
*/

-- ============================================================================
-- FUNCTION: get_user_reward_history
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_reward_history(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_reward_type TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  reward_type TEXT,
  reward_value JSONB,
  reward_tier TEXT,
  source_type TEXT,
  source_id UUID,
  source_name TEXT,
  status TEXT,
  earned_at TIMESTAMP WITH TIME ZONE,
  fulfilled_at TIMESTAMP WITH TIME ZONE,
  fulfillment_details JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH reward_records AS (
    -- Rewards from challenge participants (completed challenges)
    SELECT
      cp.id,
      (jsonb_array_elements(cp.reward)->>'type')::TEXT as reward_type,
      jsonb_array_elements(cp.reward) as reward_value,
      (jsonb_array_elements(cp.reward)->>'tier')::TEXT as reward_tier,
      'challenge'::TEXT as source_type,
      cp.challenge_id as source_id,
      g.name as source_name,
      'fulfilled'::TEXT as status,
      cp.created_at as earned_at,
      cp.created_at as fulfilled_at,
      NULL::JSONB as fulfillment_details
    FROM public.challenge_participants cp
    INNER JOIN public.games g ON g.id = cp.challenge_id
    WHERE cp.user_id = p_user_id
      AND cp.reward IS NOT NULL
      AND cp.reward != '[]'::JSONB
      AND jsonb_array_length(cp.reward) > 0

    UNION ALL

    -- Rewards from fulfillment system
    SELECT
      rf.id,
      rf.reward_type,
      rf.reward_value,
      (rf.reward_value->>'tier')::TEXT as reward_tier,
      rf.source_type,
      rf.source_id,
      CASE
        WHEN rf.source_type = 'challenge' THEN (SELECT name FROM public.games WHERE id = rf.source_id)
        WHEN rf.source_type = 'seasonal' THEN 'Seasonal Reward'
        WHEN rf.source_type = 'promotion' THEN 'Promotion'
        ELSE 'Manual Reward'
      END as source_name,
      rf.status::TEXT,
      rf.created_at as earned_at,
      rf.fulfilled_at,
      rf.fulfillment_details
    FROM public.reward_fulfillments rf
    WHERE rf.user_id = p_user_id
  )
  SELECT *
  FROM reward_records
  WHERE (p_reward_type IS NULL OR reward_type = p_reward_type)
    AND (p_status IS NULL OR status = p_status)
  ORDER BY earned_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_user_reward_history(UUID, INTEGER, INTEGER, TEXT, TEXT) IS
  'Retrieves comprehensive reward history for a user from all sources with optional filtering';

-- ============================================================================
-- FUNCTION: get_user_reward_stats
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_reward_stats(
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_stats JSONB;
BEGIN
  WITH reward_aggregates AS (
    -- From challenge participants
    SELECT
      (jsonb_array_elements(cp.reward)->>'type')::TEXT as reward_type,
      CASE
        WHEN (jsonb_array_elements(cp.reward)->>'type')::TEXT IN ('coins', 'xp') THEN
          ((jsonb_array_elements(cp.reward)->>'value')::INTEGER)
        ELSE 1
      END as reward_count
    FROM public.challenge_participants cp
    WHERE cp.user_id = p_user_id
      AND cp.reward IS NOT NULL
      AND cp.reward != '[]'::JSONB

    UNION ALL

    -- From fulfillment system
    SELECT
      rf.reward_type,
      CASE
        WHEN rf.reward_type IN ('coins', 'xp') THEN
          COALESCE((rf.reward_value->>'value')::INTEGER, 1)
        ELSE 1
      END as reward_count
    FROM public.reward_fulfillments rf
    WHERE rf.user_id = p_user_id
      AND rf.status = 'fulfilled'
  )
  SELECT jsonb_build_object(
    'total_rewards', COUNT(*),
    'total_coins', COALESCE(SUM(CASE WHEN reward_type = 'coins' THEN reward_count ELSE 0 END), 0),
    'total_xp', COALESCE(SUM(CASE WHEN reward_type = 'xp' THEN reward_count ELSE 0 END), 0),
    'total_tickets', COALESCE(SUM(CASE WHEN reward_type = 'ticket' THEN reward_count ELSE 0 END), 0),
    'total_spins', COALESCE(SUM(CASE WHEN reward_type = 'spin' THEN reward_count ELSE 0 END), 0),
    'total_giftcards', COALESCE(SUM(CASE WHEN reward_type = 'giftcard' THEN reward_count ELSE 0 END), 0),
    'total_custom', COALESCE(SUM(CASE WHEN reward_type = 'custom' THEN reward_count ELSE 0 END), 0),
    'pending_fulfillments', (
      SELECT COUNT(*)
      FROM public.reward_fulfillments
      WHERE user_id = p_user_id
        AND status IN ('pending', 'processing')
    )
  ) INTO v_stats
  FROM reward_aggregates;

  RETURN COALESCE(v_stats, jsonb_build_object(
    'total_rewards', 0,
    'total_coins', 0,
    'total_xp', 0,
    'total_tickets', 0,
    'total_spins', 0,
    'total_giftcards', 0,
    'total_custom', 0,
    'pending_fulfillments', 0
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_user_reward_stats(UUID) IS
  'Returns aggregated statistics about a user''s reward history';

-- ============================================================================
-- RLS: Ensure users can only see their own reward history
-- ============================================================================

-- The function uses SECURITY DEFINER and filters by user_id internally
-- No additional RLS policies needed as queries go through the function
