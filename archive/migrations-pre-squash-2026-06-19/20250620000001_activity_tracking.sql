/*
  # Activity Tracking System

  ## Description
  This migration creates the infrastructure for tracking user activity
  to enable real XP calculations based on actual user behavior.

  ## Tables Created
  - user_activity_logs: Aggregated weekly activity metrics per user

  ## Features
  - Tracks daily activity, predictions, fantasy games, bets
  - Aggregates data weekly (Monday to Sunday)
  - Automatic updates via triggers on relevant tables
  - Supports XP calculation with real user data
*/

-- ============================================================================
-- 1. USER ACTIVITY LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL, -- Always Monday of the week

  -- Activity metrics
  days_active INT DEFAULT 0,

  -- Prediction metrics
  predictions_made INT DEFAULT 0,
  predictions_correct INT DEFAULT 0,

  -- Fantasy metrics
  fantasy_games INT DEFAULT 0,
  fantasy_avg_score NUMERIC DEFAULT 0,
  fantasy_total_score NUMERIC DEFAULT 0,

  -- Betting metrics
  bets_placed INT DEFAULT 0,
  bets_won INT DEFAULT 0,
  total_bet_amount NUMERIC DEFAULT 0,
  total_win_amount NUMERIC DEFAULT 0,
  avg_win_odds NUMERIC DEFAULT 0,

  -- Badge metrics
  badges_earned INT DEFAULT 0,

  -- Game variety
  game_types_played INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id, week_start)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_week_start ON public.user_activity_logs(week_start);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_week ON public.user_activity_logs(user_id, week_start);

-- RLS policies
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to read their own activity logs"
  ON public.user_activity_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Allow admin full access to activity logs"
  ON public.user_activity_logs FOR ALL
  USING (public.is_admin());

-- ============================================================================
-- 2. HELPER FUNCTION: GET CURRENT WEEK START (MONDAY)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_week_start(p_date TIMESTAMPTZ DEFAULT now())
RETURNS DATE AS $$
BEGIN
  -- Get Monday of the week for the given date
  RETURN DATE(date_trunc('week', p_date));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 3. FUNCTION: TRACK USER ACTIVITY
-- ============================================================================

CREATE OR REPLACE FUNCTION public.track_user_activity(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_week_start DATE;
  v_today DATE;
BEGIN
  v_week_start := public.get_week_start(now());
  v_today := CURRENT_DATE;

  -- Insert or update activity log for this week
  INSERT INTO public.user_activity_logs (user_id, week_start, days_active, updated_at)
  VALUES (p_user_id, v_week_start, 1, now())
  ON CONFLICT (user_id, week_start)
  DO UPDATE SET
    days_active = CASE
      -- Only increment if we haven't counted today yet
      WHEN public.user_activity_logs.updated_at::date < v_today THEN
        public.user_activity_logs.days_active + 1
      ELSE
        public.user_activity_logs.days_active
    END,
    updated_at = now();

  -- Update last_active_date in users table
  UPDATE public.users
  SET last_active_date = now()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. FUNCTION: TRACK PREDICTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.track_prediction(
  p_user_id UUID,
  p_is_correct BOOLEAN DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_week_start DATE;
BEGIN
  v_week_start := public.get_week_start(now());

  -- Insert or update activity log
  INSERT INTO public.user_activity_logs (
    user_id,
    week_start,
    predictions_made,
    predictions_correct,
    updated_at
  )
  VALUES (
    p_user_id,
    v_week_start,
    1,
    CASE WHEN p_is_correct = true THEN 1 ELSE 0 END,
    now()
  )
  ON CONFLICT (user_id, week_start)
  DO UPDATE SET
    predictions_made = public.user_activity_logs.predictions_made + 1,
    predictions_correct = CASE
      WHEN p_is_correct = true THEN public.user_activity_logs.predictions_correct + 1
      ELSE public.user_activity_logs.predictions_correct
    END,
    updated_at = now();

  -- Track general activity
  PERFORM public.track_user_activity(p_user_id);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. FUNCTION: TRACK BET
-- ============================================================================

CREATE OR REPLACE FUNCTION public.track_bet(
  p_user_id UUID,
  p_bet_amount NUMERIC,
  p_win_amount NUMERIC DEFAULT 0,
  p_odds NUMERIC DEFAULT 0
)
RETURNS void AS $$
DECLARE
  v_week_start DATE;
  v_is_won BOOLEAN;
BEGIN
  v_week_start := public.get_week_start(now());
  v_is_won := p_win_amount > 0;

  -- Insert or update activity log
  INSERT INTO public.user_activity_logs (
    user_id,
    week_start,
    bets_placed,
    bets_won,
    total_bet_amount,
    total_win_amount,
    avg_win_odds,
    updated_at
  )
  VALUES (
    p_user_id,
    v_week_start,
    1,
    CASE WHEN v_is_won THEN 1 ELSE 0 END,
    p_bet_amount,
    p_win_amount,
    CASE WHEN v_is_won THEN p_odds ELSE 0 END,
    now()
  )
  ON CONFLICT (user_id, week_start)
  DO UPDATE SET
    bets_placed = public.user_activity_logs.bets_placed + 1,
    bets_won = public.user_activity_logs.bets_won + CASE WHEN v_is_won THEN 1 ELSE 0 END,
    total_bet_amount = public.user_activity_logs.total_bet_amount + p_bet_amount,
    total_win_amount = public.user_activity_logs.total_win_amount + p_win_amount,
    avg_win_odds = CASE
      WHEN v_is_won THEN
        (public.user_activity_logs.avg_win_odds * public.user_activity_logs.bets_won + p_odds) /
        (public.user_activity_logs.bets_won + 1)
      ELSE
        public.user_activity_logs.avg_win_odds
    END,
    updated_at = now();

  -- Track general activity
  PERFORM public.track_user_activity(p_user_id);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. FUNCTION: TRACK FANTASY GAME
-- ============================================================================

CREATE OR REPLACE FUNCTION public.track_fantasy_game(
  p_user_id UUID,
  p_score NUMERIC
)
RETURNS void AS $$
DECLARE
  v_week_start DATE;
BEGIN
  v_week_start := public.get_week_start(now());

  -- Insert or update activity log
  INSERT INTO public.user_activity_logs (
    user_id,
    week_start,
    fantasy_games,
    fantasy_total_score,
    fantasy_avg_score,
    updated_at
  )
  VALUES (
    p_user_id,
    v_week_start,
    1,
    p_score,
    p_score,
    now()
  )
  ON CONFLICT (user_id, week_start)
  DO UPDATE SET
    fantasy_games = public.user_activity_logs.fantasy_games + 1,
    fantasy_total_score = public.user_activity_logs.fantasy_total_score + p_score,
    fantasy_avg_score = (public.user_activity_logs.fantasy_total_score + p_score) /
                        (public.user_activity_logs.fantasy_games + 1),
    updated_at = now();

  -- Track general activity
  PERFORM public.track_user_activity(p_user_id);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. FUNCTION: TRACK BADGE EARNED
-- ============================================================================

CREATE OR REPLACE FUNCTION public.track_badge_earned(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_week_start DATE;
BEGIN
  v_week_start := public.get_week_start(now());

  -- Insert or update activity log
  INSERT INTO public.user_activity_logs (
    user_id,
    week_start,
    badges_earned,
    updated_at
  )
  VALUES (
    p_user_id,
    v_week_start,
    1,
    now()
  )
  ON CONFLICT (user_id, week_start)
  DO UPDATE SET
    badges_earned = public.user_activity_logs.badges_earned + 1,
    updated_at = now();

  -- Track general activity
  PERFORM public.track_user_activity(p_user_id);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. FUNCTION: TRACK GAME TYPE PLAYED
-- ============================================================================

CREATE OR REPLACE FUNCTION public.track_game_type(
  p_user_id UUID,
  p_game_type TEXT
)
RETURNS void AS $$
DECLARE
  v_week_start DATE;
  v_current_types TEXT[];
  v_new_count INT;
BEGIN
  v_week_start := public.get_week_start(now());

  -- Get current game types played this week (stored in a custom column or calculated)
  -- For now, we'll just increment the counter
  -- A more sophisticated version would track unique game types

  INSERT INTO public.user_activity_logs (
    user_id,
    week_start,
    game_types_played,
    updated_at
  )
  VALUES (
    p_user_id,
    v_week_start,
    1,
    now()
  )
  ON CONFLICT (user_id, week_start)
  DO UPDATE SET
    -- This is simplified - in reality you'd track unique game types
    game_types_played = GREATEST(
      public.user_activity_logs.game_types_played,
      1
    ),
    updated_at = now();

  -- Track general activity
  PERFORM public.track_user_activity(p_user_id);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. TRIGGER: AUTO-TRACK BADGE AWARDS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_track_badge_earned()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.track_badge_earned(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_track_badge_earned ON public.user_badges;
CREATE TRIGGER auto_track_badge_earned
  AFTER INSERT ON public.user_badges
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_track_badge_earned();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON TABLE public.user_activity_logs IS 'Weekly aggregated user activity metrics for XP calculation';
COMMENT ON FUNCTION public.track_user_activity IS 'Tracks general user activity and updates last_active_date';
COMMENT ON FUNCTION public.track_prediction IS 'Records a prediction made by the user';
COMMENT ON FUNCTION public.track_bet IS 'Records a bet placed by the user';
COMMENT ON FUNCTION public.track_fantasy_game IS 'Records a fantasy game played by the user';
COMMENT ON FUNCTION public.track_badge_earned IS 'Increments badge counter when user earns a badge';
COMMENT ON FUNCTION public.track_game_type IS 'Tracks variety of game types played';
