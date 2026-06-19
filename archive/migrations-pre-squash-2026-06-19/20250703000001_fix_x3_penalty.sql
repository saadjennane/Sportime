/*
  Fix x3 Booster Penalty

  This migration updates the calculate_bet_points function to correctly apply
  the -200 point penalty when a bet with x3 booster loses.

  Changes:
  - Add penalty handling for x3 booster on losing bets
  - Maintain gross gain calculation for winning bets
  - Align backend logic with frontend implementation

  Points Rules:
  - Win without booster: points = odds * amount
  - Win with x2: points = (odds * amount) * 2
  - Win with x3: points = (odds * amount) * 3
  - Loss without booster or x2: points = 0
  - Loss with x3: points = -200 (PENALTY)
*/

-- Update calculate_bet_points function to handle x3 penalty
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

  -- Handle x3 booster penalty on loss
  IF NOT v_correct AND p_has_booster AND p_booster_type = 'x3' THEN
    RETURN -200;  -- x3 penalty
  END IF;

  -- Return 0 for any other incorrect prediction
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

  -- Calculate base points (gross gain: odds * amount)
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

-- Add comment documenting the penalty
COMMENT ON FUNCTION public.calculate_bet_points IS
  'Calculates points for a challenge bet using gross gain model. Returns -200 penalty for losing x3 boosted bets, 0 for other losses, and gross gain (odds * amount * booster) for wins.';

-- Test the function with various scenarios
DO $$
DECLARE
  v_test_odds JSONB := '{"teamA": 2.0, "draw": 3.2, "teamB": 2.4}'::JSONB;
  v_result INTEGER;
BEGIN
  -- Test 1: Winning bet without booster
  v_result := public.calculate_bet_points('teamA', 'teamA', v_test_odds, 100, FALSE, NULL);
  RAISE NOTICE 'Test 1 (Win no booster): % points (expected 200)', v_result;

  -- Test 2: Winning bet with x2 booster
  v_result := public.calculate_bet_points('teamA', 'teamA', v_test_odds, 100, TRUE, 'x2');
  RAISE NOTICE 'Test 2 (Win x2 booster): % points (expected 400)', v_result;

  -- Test 3: Winning bet with x3 booster
  v_result := public.calculate_bet_points('teamA', 'teamA', v_test_odds, 100, TRUE, 'x3');
  RAISE NOTICE 'Test 3 (Win x3 booster): % points (expected 600)', v_result;

  -- Test 4: Losing bet without booster
  v_result := public.calculate_bet_points('teamA', 'teamB', v_test_odds, 100, FALSE, NULL);
  RAISE NOTICE 'Test 4 (Loss no booster): % points (expected 0)', v_result;

  -- Test 5: Losing bet with x2 booster (no penalty)
  v_result := public.calculate_bet_points('teamA', 'teamB', v_test_odds, 100, TRUE, 'x2');
  RAISE NOTICE 'Test 5 (Loss x2 booster): % points (expected 0)', v_result;

  -- Test 6: Losing bet with x3 booster (penalty!)
  v_result := public.calculate_bet_points('teamA', 'teamB', v_test_odds, 100, TRUE, 'x3');
  RAISE NOTICE 'Test 6 (Loss x3 booster): % points (expected -200)', v_result;
END $$;
