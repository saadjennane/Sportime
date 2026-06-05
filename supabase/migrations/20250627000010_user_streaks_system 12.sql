/*
  Daily Streaks System for Supabase

  Creates table and functions to manage daily login streaks with rewards.
  - Streaks run from Day 1 to Day 7, then reset
  - Daily window: 8h00 to 7h59 next day
  - Reset after 24h of inactivity
  - Rewards: coins for days 1-6, rookie ticket on day 7
*/

-- Table to store user streak data
CREATE TABLE IF NOT EXISTS public.user_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  current_day INTEGER NOT NULL DEFAULT 1 CHECK (current_day >= 1 AND current_day <= 7),
  last_claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

-- Users can read their own streaks
CREATE POLICY "Users can view their own streaks"
  ON public.user_streaks
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own streaks
CREATE POLICY "Users can insert their own streaks"
  ON public.user_streaks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own streaks
CREATE POLICY "Users can update their own streaks"
  ON public.user_streaks
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all streaks
CREATE POLICY "Admins can view all streaks"
  ON public.user_streaks
  FOR SELECT
  USING (public.is_admin());

-- Add updated_at trigger
CREATE TRIGGER on_user_streaks_updated
  BEFORE UPDATE ON public.user_streaks
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_streaks_user_id ON public.user_streaks(user_id);

-- Function to check if a user can claim their daily streak
CREATE OR REPLACE FUNCTION public.check_daily_streak(p_user_id UUID)
RETURNS TABLE(
  is_available BOOLEAN,
  streak_day INTEGER,
  is_first_time BOOLEAN
) AS $$
DECLARE
  v_streak RECORD;
  v_now TIMESTAMPTZ;
  v_current_streak_day TIMESTAMPTZ;
  v_last_claimed_streak_day TIMESTAMPTZ;
  v_days_difference INTEGER;
BEGIN
  v_now := now();

  -- Get user streak data
  SELECT * INTO v_streak
  FROM public.user_streaks
  WHERE user_id = p_user_id;

  -- If no streak exists, it's the first time
  IF v_streak IS NULL THEN
    RETURN QUERY SELECT true, 1, true;
    RETURN;
  END IF;

  -- Define "streak day": from 8:00 today to 7:59 tomorrow
  v_current_streak_day := v_now;
  IF EXTRACT(HOUR FROM v_now) < 8 THEN
    -- Before 8:00, we're still in yesterday's streak day
    v_current_streak_day := v_current_streak_day - INTERVAL '1 day';
  END IF;
  v_current_streak_day := date_trunc('day', v_current_streak_day) + INTERVAL '8 hours';

  -- Calculate last claimed streak day
  v_last_claimed_streak_day := v_streak.last_claimed_at;
  IF EXTRACT(HOUR FROM v_last_claimed_streak_day) < 8 THEN
    v_last_claimed_streak_day := v_last_claimed_streak_day - INTERVAL '1 day';
  END IF;
  v_last_claimed_streak_day := date_trunc('day', v_last_claimed_streak_day) + INTERVAL '8 hours';

  -- Calculate days difference
  v_days_difference := EXTRACT(DAY FROM v_current_streak_day - v_last_claimed_streak_day)::INTEGER;

  -- Already claimed today
  IF v_days_difference = 0 THEN
    RETURN QUERY SELECT false, 0, false;
    RETURN;
  END IF;

  -- Can claim today - streak continues
  IF v_days_difference = 1 THEN
    RETURN QUERY SELECT
      true,
      CASE WHEN v_streak.current_day = 7 THEN 1 ELSE v_streak.current_day + 1 END,
      false;
    RETURN;
  END IF;

  -- More than 1 day of inactivity - streak reset
  RETURN QUERY SELECT true, 1, false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to claim daily streak and grant rewards
CREATE OR REPLACE FUNCTION public.claim_daily_streak(p_user_id UUID)
RETURNS TABLE(
  success BOOLEAN,
  streak_day INTEGER,
  reward_type TEXT,
  reward_amount INTEGER,
  new_balance INTEGER
) AS $$
DECLARE
  v_check RECORD;
  v_new_day INTEGER;
  v_reward_coins INTEGER;
  v_reward_ticket TEXT;
  v_new_balance INTEGER;
BEGIN
  -- Check if user can claim
  SELECT * INTO v_check FROM public.check_daily_streak(p_user_id);

  IF NOT v_check.is_available THEN
    RAISE EXCEPTION 'Streak not available to claim';
  END IF;

  v_new_day := v_check.streak_day;

  -- Determine reward based on day
  CASE v_new_day
    WHEN 1 THEN v_reward_coins := 100;
    WHEN 2 THEN v_reward_coins := 200;
    WHEN 3 THEN v_reward_coins := 300;
    WHEN 4, 5, 6 THEN v_reward_coins := 500;
    WHEN 7 THEN v_reward_ticket := 'rookie';
  END CASE;

  -- Update or insert streak record
  INSERT INTO public.user_streaks (user_id, current_day, last_claimed_at)
  VALUES (p_user_id, v_new_day, now())
  ON CONFLICT (user_id) DO UPDATE
  SET
    current_day = v_new_day,
    last_claimed_at = now(),
    updated_at = now();

  -- Grant coin reward
  IF v_reward_coins IS NOT NULL THEN
    UPDATE public.users
    SET coins_balance = coins_balance + v_reward_coins
    WHERE id = p_user_id
    RETURNING coins_balance INTO v_new_balance;

    RETURN QUERY SELECT
      true,
      v_new_day,
      'coins'::TEXT,
      v_reward_coins,
      v_new_balance;
    RETURN;
  END IF;

  -- Grant ticket reward (Day 7)
  IF v_reward_ticket IS NOT NULL THEN
    -- Insert ticket into user_tickets table
    INSERT INTO public.user_tickets (user_id, ticket_type, expires_at)
    VALUES (
      p_user_id,
      v_reward_ticket,
      now() + INTERVAL '30 days'
    );

    -- Get current balance
    SELECT coins_balance INTO v_new_balance
    FROM public.users
    WHERE id = p_user_id;

    RETURN QUERY SELECT
      true,
      v_new_day,
      'ticket'::TEXT,
      0,
      v_new_balance;
    RETURN;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_daily_streak(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_streak(UUID) TO authenticated;

-- Show streak rewards reference
SELECT
  day,
  CASE
    WHEN day <= 6 THEN 'coins'
    ELSE 'ticket'
  END as reward_type,
  CASE
    WHEN day = 1 THEN 100
    WHEN day = 2 THEN 200
    WHEN day = 3 THEN 300
    WHEN day IN (4,5,6) THEN 500
    ELSE 0
  END as coins,
  CASE
    WHEN day = 7 THEN 'rookie'
    ELSE NULL
  END as ticket
FROM generate_series(1, 7) as day;
