/*
  # Real XP Calculation Functions

  ## Description
  This migration implements the complete XP calculation system using real user data
  from the activity logs. It replaces mocked calculations with actual queries.

  ## Functions
  - calculate_user_weekly_xp: Calculates XP for a single user based on real activity
  - update_all_weekly_xp: Batch updates XP for all active users
  - end_of_season_reset: Handles season transitions and GOAT badge awards

  ## XP Formula
  XP = (A + P + F + R + B + G) × D × GOAT_BONUS
  Where:
    A = Activity XP (days_active × 50)
    P = Prediction Accuracy XP (accuracy% × 120)
    F = Fantasy Score XP (avg_fantasy_score × 0.5)
    R = Risk Factor XP ((avg_win_odds - 1) × 100)
    B = Badges Earned XP (badges_earned × 150)
    G = Game Variety XP (game_types_played × 40)
    D = Diminishing Factor (1 / (1 + 0.05 × (current_level - 1)))
    GOAT_BONUS = 1.05 if goat_bonus_active, else 1.0
*/

-- ============================================================================
-- 1. CALCULATE XP FOR SINGLE USER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_user_weekly_xp(p_user_id UUID)
RETURNS INT AS $$
DECLARE
  -- User info
  v_current_level INT;
  v_goat_bonus_active BOOLEAN;
  v_last_active_date TIMESTAMPTZ;

  -- Activity metrics
  v_days_active INT := 0;
  v_predictions_made INT := 0;
  v_predictions_correct INT := 0;
  v_fantasy_avg_score NUMERIC := 0;
  v_avg_win_odds NUMERIC := 1.0;
  v_badges_earned INT := 0;
  v_game_types_played INT := 0;

  -- XP components
  v_activity_xp NUMERIC := 0;
  v_accuracy_xp NUMERIC := 0;
  v_fantasy_xp NUMERIC := 0;
  v_risk_xp NUMERIC := 0;
  v_badges_xp NUMERIC := 0;
  v_games_xp NUMERIC := 0;
  v_total_xp NUMERIC := 0;

  -- Modifiers
  v_diminishing_factor NUMERIC;
  v_decay_factor NUMERIC := 0;
  v_weeks_inactive INT := 0;
  v_goat_multiplier NUMERIC := 1.0;

  -- Calculated
  v_accuracy NUMERIC := 0;
  v_week_start DATE;
BEGIN
  -- Get user's current progression state
  SELECT current_level, goat_bonus_active, last_active_date
  INTO v_current_level, v_goat_bonus_active, v_last_active_date
  FROM public.users
  WHERE id = p_user_id;

  -- Calculate weeks inactive
  IF v_last_active_date IS NOT NULL THEN
    v_weeks_inactive := FLOOR(EXTRACT(EPOCH FROM (NOW() - v_last_active_date)) / 604800)::INT;
  END IF;

  -- Apply decay if inactive >= 2 weeks and not GOAT (level 6)
  IF v_weeks_inactive >= 2 AND v_current_level < 6 THEN
    v_decay_factor := LEAST(0.30, 0.02 * v_weeks_inactive);
  END IF;

  -- Get last week's activity data
  v_week_start := public.get_week_start(NOW() - INTERVAL '1 week');

  SELECT
    COALESCE(days_active, 0),
    COALESCE(predictions_made, 0),
    COALESCE(predictions_correct, 0),
    COALESCE(fantasy_avg_score, 0),
    COALESCE(NULLIF(avg_win_odds, 0), 1.0),
    COALESCE(badges_earned, 0),
    COALESCE(game_types_played, 0)
  INTO
    v_days_active,
    v_predictions_made,
    v_predictions_correct,
    v_fantasy_avg_score,
    v_avg_win_odds,
    v_badges_earned,
    v_game_types_played
  FROM public.user_activity_logs
  WHERE user_id = p_user_id
    AND week_start = v_week_start;

  -- Calculate accuracy percentage
  IF v_predictions_made > 0 THEN
    v_accuracy := (v_predictions_correct::NUMERIC / v_predictions_made) * 100;
  END IF;

  -- ========================================
  -- CALCULATE INDIVIDUAL XP COMPONENTS
  -- ========================================

  -- A: Activity XP (days_active × 50)
  v_activity_xp := v_days_active * 50;

  -- P: Prediction Accuracy XP (accuracy% × 1.2)
  v_accuracy_xp := v_accuracy * 1.2;

  -- F: Fantasy Score XP (avg_fantasy_score × 0.5)
  v_fantasy_xp := v_fantasy_avg_score * 0.5;

  -- R: Risk Factor XP ((avg_win_odds - 1) × 100)
  v_risk_xp := (v_avg_win_odds - 1) * 100;

  -- B: Badges Earned XP (badges_earned × 150)
  v_badges_xp := v_badges_earned * 150;

  -- G: Game Variety XP (game_types_played × 40)
  v_games_xp := v_game_types_played * 40;

  -- ========================================
  -- APPLY MODIFIERS
  -- ========================================

  -- D: Diminishing Factor (1 / (1 + 0.05 × (current_level - 1)))
  v_diminishing_factor := 1.0 / (1.0 + 0.05 * (v_current_level - 1));

  -- GOAT Bonus (+5%)
  IF v_goat_bonus_active THEN
    v_goat_multiplier := 1.05;
  END IF;

  -- ========================================
  -- FINAL XP CALCULATION
  -- ========================================

  v_total_xp := (
    v_activity_xp +
    v_accuracy_xp +
    v_fantasy_xp +
    v_risk_xp +
    v_badges_xp +
    v_games_xp
  ) * v_diminishing_factor * v_goat_multiplier;

  -- Apply decay
  v_total_xp := v_total_xp * (1.0 - v_decay_factor);

  -- Ensure XP is never negative
  v_total_xp := GREATEST(v_total_xp, 0);

  -- Round to nearest integer
  RETURN ROUND(v_total_xp)::INT;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 2. UPDATE XP FOR ALL USERS (BATCH)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_all_weekly_xp()
RETURNS TABLE(
  user_id UUID,
  xp_gained INT,
  new_xp_total INT,
  new_level INT,
  new_level_name TEXT,
  leveled_up BOOLEAN
) AS $$
DECLARE
  v_user RECORD;
  v_xp_gained INT;
  v_new_total INT;
  v_old_level INT;
  v_new_level INT;
  v_new_level_name TEXT;
  v_leveled_up BOOLEAN;
BEGIN
  -- Loop through all users
  FOR v_user IN
    SELECT u.id, u.xp_total, u.current_level, u.level_name
    FROM public.users u
  LOOP
    -- Calculate XP gained this week
    v_xp_gained := public.calculate_user_weekly_xp(v_user.id);

    -- Only process if user earned XP
    IF v_xp_gained > 0 THEN
      -- Calculate new total
      v_new_total := v_user.xp_total + v_xp_gained;
      v_old_level := v_user.current_level;

      -- Determine new level based on XP
      SELECT level, name
      INTO v_new_level, v_new_level_name
      FROM public.levels_config
      WHERE xp_required <= v_new_total
      ORDER BY xp_required DESC
      LIMIT 1;

      -- Check if leveled up
      v_leveled_up := v_new_level > v_old_level;

      -- Update user record
      UPDATE public.users
      SET
        xp_total = v_new_total,
        current_level = v_new_level,
        level_name = v_new_level_name,
        updated_at = NOW()
      WHERE id = v_user.id;

      -- Return results for this user
      RETURN QUERY SELECT
        v_user.id,
        v_xp_gained,
        v_new_total,
        v_new_level,
        v_new_level_name,
        v_leveled_up;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. END OF SEASON RESET
-- ============================================================================

CREATE OR REPLACE FUNCTION public.end_of_season_reset()
RETURNS TABLE(
  users_processed INT,
  goats_awarded INT,
  season_name TEXT
) AS $$
DECLARE
  v_current_season RECORD;
  v_next_season RECORD;
  v_users_processed INT := 0;
  v_goats_awarded INT := 0;
  v_user RECORD;
BEGIN
  -- Get current active season
  SELECT * INTO v_current_season
  FROM public.seasons
  WHERE is_active = true
  LIMIT 1;

  IF v_current_season.id IS NULL THEN
    RAISE EXCEPTION 'No active season found';
  END IF;

  -- Process all users
  FOR v_user IN
    SELECT id, xp_total, current_level, level_name, goat_bonus_active
    FROM public.users
  LOOP
    -- Archive current season data
    INSERT INTO public.season_logs (
      user_id,
      season_id,
      xp_final,
      level_final,
      goat_earned,
      created_at
    )
    VALUES (
      v_user.id,
      v_current_season.id,
      v_user.xp_total,
      v_user.level_name,
      v_user.current_level = 6, -- GOAT level
      NOW()
    );

    -- Check if user reached GOAT (level 6)
    IF v_user.current_level = 6 THEN
      v_goats_awarded := v_goats_awarded + 1;

      -- Award GOAT badge (assuming badge named 'GOAT' exists)
      INSERT INTO public.user_badges (user_id, badge_id, season_id, earned_at)
      SELECT v_user.id, b.id, v_current_season.id, NOW()
      FROM public.badges b
      WHERE b.name = 'GOAT'
      ON CONFLICT DO NOTHING;

      -- Reset GOAT users to Rising Star (level 2) with bonus active
      UPDATE public.users
      SET
        xp_total = 0,
        current_level = 2,
        level_name = 'Rising Star',
        goat_bonus_active = true,
        updated_at = NOW()
      WHERE id = v_user.id;
    ELSE
      -- Reset non-GOAT users to Rising Star without bonus
      UPDATE public.users
      SET
        xp_total = 0,
        current_level = 2,
        level_name = 'Rising Star',
        goat_bonus_active = false,
        updated_at = NOW()
      WHERE id = v_user.id;
    END IF;

    v_users_processed := v_users_processed + 1;
  END LOOP;

  -- Deactivate current season
  UPDATE public.seasons
  SET is_active = false
  WHERE id = v_current_season.id;

  -- Activate next season (if exists)
  UPDATE public.seasons
  SET is_active = true
  WHERE start_date > v_current_season.end_date
  ORDER BY start_date ASC
  LIMIT 1
  RETURNING * INTO v_next_season;

  -- Return summary
  RETURN QUERY SELECT
    v_users_processed,
    v_goats_awarded,
    v_current_season.name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. MANUAL TRIGGER: AWARD BADGE XP IMMEDIATELY
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_award_badge_xp()
RETURNS TRIGGER AS $$
DECLARE
  v_badge_xp_bonus INT;
  v_result RECORD;
BEGIN
  -- Get badge XP bonus
  SELECT xp_bonus INTO v_badge_xp_bonus
  FROM public.badges
  WHERE id = NEW.badge_id;

  -- Add XP to user immediately (not waiting for weekly calculation)
  SELECT * INTO v_result
  FROM public.add_xp_to_user(NEW.user_id, v_badge_xp_bonus);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS auto_award_badge_xp ON public.user_badges;

-- Create trigger to auto-award XP when badge is earned
CREATE TRIGGER auto_award_badge_xp
  AFTER INSERT ON public.user_badges
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_award_badge_xp();

-- ============================================================================
-- 5. HELPER: GET USER PROGRESSION SUMMARY
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_progression_summary(p_user_id UUID)
RETURNS TABLE(
  xp_total INT,
  current_level INT,
  level_name TEXT,
  xp_to_next_level INT,
  progress_percentage NUMERIC,
  goat_bonus_active BOOLEAN,
  weeks_inactive INT,
  will_decay BOOLEAN
) AS $$
DECLARE
  v_user RECORD;
  v_next_level_xp INT;
  v_current_level_xp INT;
  v_weeks_inactive INT := 0;
BEGIN
  -- Get user data
  SELECT u.xp_total, u.current_level, u.level_name, u.goat_bonus_active, u.last_active_date
  INTO v_user
  FROM public.users u
  WHERE u.id = p_user_id;

  -- Calculate weeks inactive
  IF v_user.last_active_date IS NOT NULL THEN
    v_weeks_inactive := FLOOR(EXTRACT(EPOCH FROM (NOW() - v_user.last_active_date)) / 604800)::INT;
  END IF;

  -- Get current level threshold
  SELECT xp_required INTO v_current_level_xp
  FROM public.levels_config
  WHERE level = v_user.current_level;

  -- Get next level threshold
  SELECT xp_required INTO v_next_level_xp
  FROM public.levels_config
  WHERE level = v_user.current_level + 1;

  -- If already at max level (GOAT), next level is same
  IF v_next_level_xp IS NULL THEN
    v_next_level_xp := v_current_level_xp;
  END IF;

  RETURN QUERY SELECT
    v_user.xp_total,
    v_user.current_level,
    v_user.level_name,
    GREATEST(v_next_level_xp - v_user.xp_total, 0)::INT AS xp_to_next_level,
    CASE
      WHEN v_next_level_xp = v_current_level_xp THEN 100.0 -- Already max level
      ELSE ((v_user.xp_total - v_current_level_xp)::NUMERIC / (v_next_level_xp - v_current_level_xp) * 100)
    END AS progress_percentage,
    v_user.goat_bonus_active,
    v_weeks_inactive,
    (v_weeks_inactive >= 2 AND v_user.current_level < 6) AS will_decay;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON FUNCTION public.calculate_user_weekly_xp IS 'Calculates XP earned by a user in the past week using real activity data';
COMMENT ON FUNCTION public.update_all_weekly_xp IS 'Batch updates XP for all users, returns summary of changes';
COMMENT ON FUNCTION public.end_of_season_reset IS 'Handles end-of-season processing: archives data, awards GOAT badges, resets XP';
COMMENT ON FUNCTION public.get_user_progression_summary IS 'Returns complete progression status for a user including decay warnings';
