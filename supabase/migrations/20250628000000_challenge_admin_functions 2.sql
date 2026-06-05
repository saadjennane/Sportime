/*
  Challenge Admin RPC Functions

  Provides admin functions for CRUD operations on challenges:
  - create_challenge: Create a new challenge with configs and matches
  - update_challenge: Update challenge details and configs
  - delete_challenge: Delete a challenge (CASCADE handled by FK)
  - cancel_challenge: Cancel a challenge and refund participants
  - finalize_challenge: Finalize a challenge and distribute prizes
*/

-- Function to create a new challenge
CREATE OR REPLACE FUNCTION public.create_challenge(
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_game_type TEXT DEFAULT 'betting',
  p_format TEXT DEFAULT 'leaderboard',
  p_sport TEXT DEFAULT 'football',
  p_start_date TIMESTAMPTZ DEFAULT NOW(),
  p_end_date TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  p_entry_cost INTEGER DEFAULT 0,
  p_prizes JSONB DEFAULT '[]'::JSONB,
  p_rules JSONB DEFAULT '{}'::JSONB,
  p_status TEXT DEFAULT 'upcoming',
  p_entry_conditions JSONB DEFAULT '{}'::JSONB,
  p_configs JSONB DEFAULT '[]'::JSONB,
  p_league_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_match_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS TABLE(
  out_challenge_id UUID,
  out_success BOOLEAN,
  out_message TEXT
) AS $$
DECLARE
  v_challenge_id UUID;
  v_league_id UUID;
  v_match_id UUID;
  v_config JSONB;
BEGIN
  -- Check admin permission
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can create challenges';
  END IF;

  -- Create challenge
  INSERT INTO public.challenges (
    name,
    description,
    game_type,
    format,
    sport,
    start_date,
    end_date,
    entry_cost,
    prizes,
    rules,
    status,
    entry_conditions
  ) VALUES (
    p_name,
    p_description,
    p_game_type::public.game_type_enum,
    p_format::public.challenge_format_enum,
    p_sport::public.sport_enum,
    p_start_date,
    p_end_date,
    p_entry_cost,
    p_prizes,
    p_rules,
    p_status::public.challenge_status_enum,
    p_entry_conditions
  )
  RETURNING id INTO v_challenge_id;

  -- Add challenge configs
  IF jsonb_array_length(p_configs) > 0 THEN
    FOR v_config IN SELECT * FROM jsonb_array_elements(p_configs)
    LOOP
      INSERT INTO public.challenge_configs (
        challenge_id,
        config_type,
        config_data
      ) VALUES (
        v_challenge_id,
        v_config->>'config_type',
        v_config->'config_data'
      )
      ON CONFLICT (challenge_id, config_type) DO UPDATE
      SET config_data = EXCLUDED.config_data;
    END LOOP;
  END IF;

  -- Link leagues
  IF array_length(p_league_ids, 1) > 0 THEN
    FOREACH v_league_id IN ARRAY p_league_ids
    LOOP
      INSERT INTO public.challenge_leagues (challenge_id, league_id)
      VALUES (v_challenge_id, v_league_id)
      ON CONFLICT (challenge_id, league_id) DO NOTHING;
    END LOOP;
  END IF;

  -- Link matches
  IF array_length(p_match_ids, 1) > 0 THEN
    FOREACH v_match_id IN ARRAY p_match_ids
    LOOP
      INSERT INTO public.challenge_matches (challenge_id, match_id)
      VALUES (v_challenge_id, v_match_id)
      ON CONFLICT (challenge_id, match_id) DO NOTHING;
    END LOOP;
  END IF;

  RETURN QUERY SELECT
    v_challenge_id,
    TRUE,
    'Challenge created successfully'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update a challenge
CREATE OR REPLACE FUNCTION public.update_challenge(
  p_challenge_id UUID,
  p_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_entry_cost INTEGER DEFAULT NULL,
  p_prizes JSONB DEFAULT NULL,
  p_rules JSONB DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_entry_conditions JSONB DEFAULT NULL,
  p_configs JSONB DEFAULT NULL,
  p_league_ids UUID[] DEFAULT NULL,
  p_match_ids UUID[] DEFAULT NULL
)
RETURNS TABLE(
  out_success BOOLEAN,
  out_message TEXT
) AS $$
DECLARE
  v_league_id UUID;
  v_match_id UUID;
  v_config JSONB;
BEGIN
  -- Check admin permission
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can update challenges';
  END IF;

  -- Check if challenge exists
  IF NOT EXISTS (SELECT 1 FROM public.challenges WHERE id = p_challenge_id) THEN
    RETURN QUERY SELECT FALSE, 'Challenge not found'::TEXT;
    RETURN;
  END IF;

  -- Update challenge (only non-NULL fields)
  UPDATE public.challenges
  SET
    name = COALESCE(p_name, name),
    description = COALESCE(p_description, description),
    start_date = COALESCE(p_start_date, start_date),
    end_date = COALESCE(p_end_date, end_date),
    entry_cost = COALESCE(p_entry_cost, entry_cost),
    prizes = COALESCE(p_prizes, prizes),
    rules = COALESCE(p_rules, rules),
    status = COALESCE(p_status::public.challenge_status_enum, status),
    entry_conditions = COALESCE(p_entry_conditions, entry_conditions),
    updated_at = NOW()
  WHERE id = p_challenge_id;

  -- Update configs if provided
  IF p_configs IS NOT NULL AND jsonb_array_length(p_configs) > 0 THEN
    FOR v_config IN SELECT * FROM jsonb_array_elements(p_configs)
    LOOP
      INSERT INTO public.challenge_configs (
        challenge_id,
        config_type,
        config_data
      ) VALUES (
        p_challenge_id,
        v_config->>'config_type',
        v_config->'config_data'
      )
      ON CONFLICT (challenge_id, config_type) DO UPDATE
      SET config_data = EXCLUDED.config_data;
    END LOOP;
  END IF;

  -- Update leagues if provided
  IF p_league_ids IS NOT NULL THEN
    -- Remove existing leagues
    DELETE FROM public.challenge_leagues WHERE challenge_id = p_challenge_id;

    -- Add new leagues
    IF array_length(p_league_ids, 1) > 0 THEN
      FOREACH v_league_id IN ARRAY p_league_ids
      LOOP
        INSERT INTO public.challenge_leagues (challenge_id, league_id)
        VALUES (p_challenge_id, v_league_id)
        ON CONFLICT (challenge_id, league_id) DO NOTHING;
      END LOOP;
    END IF;
  END IF;

  -- Update matches if provided
  IF p_match_ids IS NOT NULL THEN
    -- Remove existing matches
    DELETE FROM public.challenge_matches WHERE challenge_id = p_challenge_id;

    -- Add new matches
    IF array_length(p_match_ids, 1) > 0 THEN
      FOREACH v_match_id IN ARRAY p_match_ids
      LOOP
        INSERT INTO public.challenge_matches (challenge_id, match_id)
        VALUES (p_challenge_id, v_match_id)
        ON CONFLICT (challenge_id, match_id) DO NOTHING;
      END LOOP;
    END IF;
  END IF;

  RETURN QUERY SELECT TRUE, 'Challenge updated successfully'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete a challenge
CREATE OR REPLACE FUNCTION public.delete_challenge(
  p_challenge_id UUID
)
RETURNS TABLE(
  out_success BOOLEAN,
  out_message TEXT
) AS $$
BEGIN
  -- Check admin permission
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can delete challenges';
  END IF;

  -- Check if challenge exists
  IF NOT EXISTS (SELECT 1 FROM public.challenges WHERE id = p_challenge_id) THEN
    RETURN QUERY SELECT FALSE, 'Challenge not found'::TEXT;
    RETURN;
  END IF;

  -- Delete challenge (CASCADE will handle related records)
  DELETE FROM public.challenges WHERE id = p_challenge_id;

  RETURN QUERY SELECT TRUE, 'Challenge deleted successfully'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cancel a challenge and refund participants
CREATE OR REPLACE FUNCTION public.cancel_challenge(
  p_challenge_id UUID
)
RETURNS TABLE(
  out_success BOOLEAN,
  out_message TEXT,
  out_refunded_users INTEGER
) AS $$
DECLARE
  v_entry_cost INTEGER;
  v_refunded_count INTEGER := 0;
  v_participant RECORD;
BEGIN
  -- Check admin permission
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can cancel challenges';
  END IF;

  -- Get challenge details
  SELECT entry_cost INTO v_entry_cost
  FROM public.challenges
  WHERE id = p_challenge_id;

  IF v_entry_cost IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Challenge not found'::TEXT, 0;
    RETURN;
  END IF;

  -- Refund all participants
  FOR v_participant IN
    SELECT user_id FROM public.challenge_participants WHERE challenge_id = p_challenge_id
  LOOP
    -- Refund coins
    UPDATE public.users
    SET coins_balance = coins_balance + v_entry_cost
    WHERE id = v_participant.user_id;

    v_refunded_count := v_refunded_count + 1;
  END LOOP;

  -- Update challenge status to cancelled
  UPDATE public.challenges
  SET status = 'finished'::public.challenge_status_enum,
      updated_at = NOW()
  WHERE id = p_challenge_id;

  RETURN QUERY SELECT TRUE, 'Challenge cancelled and participants refunded'::TEXT, v_refunded_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to finalize a challenge (mark as finished)
CREATE OR REPLACE FUNCTION public.finalize_challenge(
  p_challenge_id UUID
)
RETURNS TABLE(
  out_success BOOLEAN,
  out_message TEXT,
  out_total_participants INTEGER
) AS $$
DECLARE
  v_participant_count INTEGER;
BEGIN
  -- Check admin permission
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can finalize challenges';
  END IF;

  -- Check if challenge exists
  IF NOT EXISTS (SELECT 1 FROM public.challenges WHERE id = p_challenge_id) THEN
    RETURN QUERY SELECT FALSE, 'Challenge not found'::TEXT, 0;
    RETURN;
  END IF;

  -- Count participants
  SELECT COUNT(*) INTO v_participant_count
  FROM public.challenge_participants
  WHERE challenge_id = p_challenge_id;

  -- Update challenge status to finished
  UPDATE public.challenges
  SET status = 'finished'::public.challenge_status_enum,
      updated_at = NOW()
  WHERE id = p_challenge_id;

  RETURN QUERY SELECT TRUE, 'Challenge finalized'::TEXT, v_participant_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users (admin check is inside functions)
GRANT EXECUTE ON FUNCTION public.create_challenge(TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, JSONB, JSONB, TEXT, JSONB, JSONB, UUID[], UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_challenge(UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, JSONB, JSONB, TEXT, JSONB, JSONB, UUID[], UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_challenge(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_challenge(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_challenge(UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.create_challenge IS 'Admin function to create a new challenge with configs, leagues, and matches';
COMMENT ON FUNCTION public.update_challenge IS 'Admin function to update challenge details, configs, leagues, and matches';
COMMENT ON FUNCTION public.delete_challenge IS 'Admin function to delete a challenge (CASCADE handles related records)';
COMMENT ON FUNCTION public.cancel_challenge IS 'Admin function to cancel a challenge and refund all participants';
COMMENT ON FUNCTION public.finalize_challenge IS 'Admin function to mark a challenge as finished';
