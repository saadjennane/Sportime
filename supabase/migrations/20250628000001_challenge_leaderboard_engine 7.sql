/*
  Challenge Leaderboard Calculation Engine

  Automatically calculates points and updates rankings when matches finish.

  Features:
  - Calculates points based on correct predictions
  - Applies booster multipliers (x2, x3)
  - Updates participant points and ranks automatically
  - Triggered when match status changes to 'finished'

  Points system:
  - Correct prediction = odds * bet_amount
  - With x2 booster = odds * bet_amount * 2
  - With x3 booster = odds * bet_amount * 3
*/

-- Function to calculate points for a single bet
CREATE OR REPLACE FUNCTION public.calculate_bet_points(
  p_prediction TEXT,
  p_result TEXT,
  p_odds JSONB,
  p_amount INTEGER,
  p_has_booster BOOLEAN DEFAULT FALSE,
  p_booster_type TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_correct BOOLEAN;
  v_odds_value NUMERIC;
  v_points INTEGER;
  v_multiplier NUMERIC;
BEGIN
  -- Check if prediction matches result
  v_correct := (p_prediction = p_result);

  IF NOT v_correct THEN
    RETURN 0;
  END IF;

  -- Get odds value for the prediction
  v_odds_value := CASE p_prediction
    WHEN 'teamA' THEN (p_odds->>'teamA')::NUMERIC
    WHEN 'draw' THEN (p_odds->>'draw')::NUMERIC
    WHEN 'teamB' THEN (p_odds->>'teamB')::NUMERIC
    ELSE 1.0
  END;

  -- Calculate base points (odds * amount)
  v_points := FLOOR(v_odds_value * p_amount);

  -- Apply booster multiplier if applicable
  IF p_has_booster THEN
    v_multiplier := CASE p_booster_type
      WHEN 'x2' THEN 2.0
      WHEN 'x3' THEN 3.0
      ELSE 1.0
    END;
    v_points := FLOOR(v_points * v_multiplier);
  END IF;

  RETURN v_points;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to recalculate points for a challenge participant
CREATE OR REPLACE FUNCTION public.recalculate_challenge_points(
  p_challenge_id UUID,
  p_user_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_total_points INTEGER := 0;
  v_entry RECORD;
  v_daily_entry RECORD;
  v_bet RECORD;
  v_match RECORD;
  v_has_booster BOOLEAN;
  v_booster_type TEXT;
  v_bet_points INTEGER;
BEGIN
  -- Get the challenge entry
  SELECT * INTO v_entry
  FROM public.challenge_entries
  WHERE challenge_id = p_challenge_id AND user_id = p_user_id;

  IF v_entry IS NULL THEN
    RETURN 0;
  END IF;

  -- Loop through all daily entries
  FOR v_daily_entry IN
    SELECT * FROM public.challenge_daily_entries
    WHERE entry_id = v_entry.id
  LOOP
    -- Check if this day has a booster
    v_has_booster := (v_daily_entry.booster_type IS NOT NULL);
    v_booster_type := v_daily_entry.booster_type;

    -- Loop through all bets for this day
    FOR v_bet IN
      SELECT * FROM public.challenge_bets
      WHERE daily_entry_id = v_daily_entry.id
    LOOP
      -- Get match details including result
      SELECT
        cm.id,
        m.status,
        m.score,
        JSONB_BUILD_OBJECT(
          'teamA', 2.0,
          'draw', 3.2,
          'teamB', 2.4
        ) as odds
      INTO v_match
      FROM public.challenge_matches cm
      JOIN public.matches m ON m.id = cm.match_id
      WHERE cm.id = v_bet.challenge_match_id;

      -- Only count if match is finished
      IF v_match.status IN ('finished', 'FT', 'AET', 'PEN') AND v_match.score IS NOT NULL THEN
        -- Determine match result
        DECLARE
          v_home_goals INTEGER;
          v_away_goals INTEGER;
          v_result TEXT;
        BEGIN
          v_home_goals := COALESCE((v_match.score->>'home')::INTEGER, (v_match.score->>'goals_home')::INTEGER, 0);
          v_away_goals := COALESCE((v_match.score->>'away')::INTEGER, (v_match.score->>'goals_away')::INTEGER, 0);

          v_result := CASE
            WHEN v_home_goals > v_away_goals THEN 'teamA'
            WHEN v_home_goals < v_away_goals THEN 'teamB'
            ELSE 'draw'
          END;

          -- Check if booster applies to this match
          DECLARE
            v_apply_booster BOOLEAN;
          BEGIN
            v_apply_booster := v_has_booster AND (v_daily_entry.booster_match_id = v_bet.challenge_match_id);

            -- Calculate points for this bet
            v_bet_points := public.calculate_bet_points(
              v_bet.prediction,
              v_result,
              v_match.odds,
              v_bet.amount,
              v_apply_booster,
              v_booster_type
            );

            v_total_points := v_total_points + v_bet_points;
          END;
        END;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_total_points;
END;
$$ LANGUAGE plpgsql;

-- Function to update all participant rankings for a challenge
CREATE OR REPLACE FUNCTION public.update_challenge_rankings(
  p_challenge_id UUID
)
RETURNS VOID AS $$
BEGIN
  -- Update ranks based on points (higher points = lower rank number)
  WITH ranked_participants AS (
    SELECT
      id,
      ROW_NUMBER() OVER (ORDER BY points DESC, created_at ASC) as new_rank
    FROM public.challenge_participants
    WHERE challenge_id = p_challenge_id
  )
  UPDATE public.challenge_participants cp
  SET rank = rp.new_rank
  FROM ranked_participants rp
  WHERE cp.id = rp.id;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to recalculate points when a match finishes
CREATE OR REPLACE FUNCTION public.trigger_recalculate_challenge_points()
RETURNS TRIGGER AS $$
DECLARE
  v_challenge_id UUID;
  v_participant RECORD;
  v_new_points INTEGER;
BEGIN
  -- Check if match status changed to finished
  IF NEW.status IN ('finished', 'FT', 'AET', 'PEN') AND
     (OLD.status IS NULL OR OLD.status NOT IN ('finished', 'FT', 'AET', 'PEN')) THEN

    -- Find all challenges using this match
    FOR v_challenge_id IN
      SELECT DISTINCT challenge_id
      FROM public.challenge_matches
      WHERE match_id = NEW.id
    LOOP
      -- Recalculate points for all participants in this challenge
      FOR v_participant IN
        SELECT user_id
        FROM public.challenge_participants
        WHERE challenge_id = v_challenge_id
      LOOP
        -- Calculate new points
        v_new_points := public.recalculate_challenge_points(
          v_challenge_id,
          v_participant.user_id
        );

        -- Update participant points
        UPDATE public.challenge_participants
        SET points = v_new_points,
            updated_at = NOW()
        WHERE challenge_id = v_challenge_id
          AND user_id = v_participant.user_id;
      END LOOP;

      -- Update rankings for this challenge
      PERFORM public.update_challenge_rankings(v_challenge_id);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on matches table
DROP TRIGGER IF EXISTS on_match_finished_recalculate_points ON public.matches;
CREATE TRIGGER on_match_finished_recalculate_points
  AFTER UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recalculate_challenge_points();

-- Manual recalculation function (for admins or debugging)
CREATE OR REPLACE FUNCTION public.recalculate_all_challenge_points(
  p_challenge_id UUID
)
RETURNS TABLE(
  out_user_id UUID,
  out_old_points INTEGER,
  out_new_points INTEGER,
  out_rank INTEGER
) AS $$
DECLARE
  v_participant RECORD;
  v_old_points INTEGER;
  v_new_points INTEGER;
BEGIN
  FOR v_participant IN
    SELECT user_id, points
    FROM public.challenge_participants
    WHERE challenge_id = p_challenge_id
  LOOP
    v_old_points := v_participant.points;

    -- Recalculate points
    v_new_points := public.recalculate_challenge_points(
      p_challenge_id,
      v_participant.user_id
    );

    -- Update participant
    UPDATE public.challenge_participants
    SET points = v_new_points,
        updated_at = NOW()
    WHERE challenge_id = p_challenge_id
      AND user_id = v_participant.user_id;
  END LOOP;

  -- Update rankings
  PERFORM public.update_challenge_rankings(p_challenge_id);

  -- Return results
  RETURN QUERY
  SELECT
    user_id,
    v_old_points,
    points as new_points,
    rank
  FROM public.challenge_participants
  WHERE challenge_id = p_challenge_id
  ORDER BY rank ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.calculate_bet_points(TEXT, TEXT, JSONB, INTEGER, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_challenge_points(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_challenge_rankings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_all_challenge_points(UUID) TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION public.calculate_bet_points IS 'Calculates points for a single bet based on prediction, result, odds, and booster';
COMMENT ON FUNCTION public.recalculate_challenge_points IS 'Recalculates total points for a participant in a challenge';
COMMENT ON FUNCTION public.update_challenge_rankings IS 'Updates rank column for all participants in a challenge based on points';
COMMENT ON FUNCTION public.trigger_recalculate_challenge_points IS 'Trigger function that recalculates points when a match finishes';
COMMENT ON FUNCTION public.recalculate_all_challenge_points IS 'Admin function to manually recalculate all points and rankings for a challenge';
