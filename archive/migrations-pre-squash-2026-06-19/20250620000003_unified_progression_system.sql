/*
  # Unified Progression System Migration

  ## Description
  This migration consolidates all progression-related tables and functions into a single,
  unified system with standardized level names and dynamic badge conditions.

  ## Changes
  1. Standardize level names to: Rookie, Rising Star, Pro, Elite, Legend, GOAT
  2. Create/update levels_config table with correct XP thresholds
  3. Update badges table to support dynamic conditions
  4. Create challenge_required_badges junction table for multi-badge support
  5. Ensure all progression columns exist in users table
  6. Add indexes for performance

  ## Standardized Levels
  - Level 1: Amateur (0 XP)
  - Level 2: Rising Star (5,000 XP)
  - Level 3: Pro (15,000 XP)
  - Level 4: Elite (35,000 XP)
  - Level 5: Legend (70,000 XP)
  - Level 6: GOAT (120,000 XP)
*/

-- ============================================================================
-- 1. LEVELS CONFIGURATION
-- ============================================================================

-- Drop existing levels_config if it exists and recreate with correct structure
DROP TABLE IF EXISTS public.levels_config CASCADE;

CREATE TABLE public.levels_config (
  level INT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  xp_required INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert standardized level data
INSERT INTO public.levels_config (level, name, xp_required) VALUES
  (1, 'Amateur', 0),
  (2, 'Rising Star', 5000),
  (3, 'Pro', 15000),
  (4, 'Elite', 35000),
  (5, 'Legend', 70000),
  (6, 'GOAT', 120000);

-- RLS for levels_config
ALTER TABLE public.levels_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to levels"
  ON public.levels_config FOR SELECT
  USING (true);

-- ============================================================================
-- 2. ENSURE USERS TABLE HAS ALL PROGRESSION COLUMNS
-- ============================================================================

-- Add progression columns to users table (IF NOT EXISTS to avoid conflicts)
DO $$
BEGIN
  -- xp_total
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'xp_total'
  ) THEN
    ALTER TABLE public.users ADD COLUMN xp_total INT NOT NULL DEFAULT 0;
  END IF;

  -- current_level
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'current_level'
  ) THEN
    ALTER TABLE public.users ADD COLUMN current_level INT NOT NULL DEFAULT 1;
  END IF;

  -- level_name
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'level_name'
  ) THEN
    ALTER TABLE public.users ADD COLUMN level_name TEXT NOT NULL DEFAULT 'Amateur';
  END IF;

  -- last_active_date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'last_active_date'
  ) THEN
    ALTER TABLE public.users ADD COLUMN last_active_date TIMESTAMPTZ;
  END IF;

  -- goat_bonus_active
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'goat_bonus_active'
  ) THEN
    ALTER TABLE public.users ADD COLUMN goat_bonus_active BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Update any existing users with old level names to new standardized names
UPDATE public.users SET level_name = 'Amateur' WHERE level_name IN ('Rookie', 'rookie', 'amateur');
UPDATE public.users SET level_name = 'Rising Star' WHERE level_name IN ('rising_star', 'Rising star');
UPDATE public.users SET level_name = 'Pro' WHERE level_name = 'pro';
UPDATE public.users SET level_name = 'Elite' WHERE level_name IN ('Expert', 'elite');
UPDATE public.users SET level_name = 'Legend' WHERE level_name IN ('Master', 'legend');
UPDATE public.users SET level_name = 'GOAT' WHERE level_name IN ('goat', 'Goat');

-- Add index on xp_total for faster level calculations
CREATE INDEX IF NOT EXISTS idx_users_xp_total ON public.users(xp_total);
CREATE INDEX IF NOT EXISTS idx_users_current_level ON public.users(current_level);

-- ============================================================================
-- 3. DYNAMIC BADGES SCHEMA
-- ============================================================================

-- Update badges table to support dynamic conditions
DO $$
BEGIN
  -- condition_type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'badges' AND column_name = 'condition_type'
  ) THEN
    ALTER TABLE public.badges ADD COLUMN condition_type TEXT;
  END IF;

  -- condition_value (JSONB for flexible conditions)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'badges' AND column_name = 'condition_value'
  ) THEN
    ALTER TABLE public.badges ADD COLUMN condition_value JSONB;
  END IF;

  -- condition_query (for custom SQL conditions)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'badges' AND column_name = 'condition_query'
  ) THEN
    ALTER TABLE public.badges ADD COLUMN condition_query TEXT;
  END IF;

  -- is_active
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'badges' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.badges ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;

  -- xp_bonus
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'badges' AND column_name = 'xp_bonus'
  ) THEN
    ALTER TABLE public.badges ADD COLUMN xp_bonus INT DEFAULT 150;
  END IF;
END $$;

-- Add index on is_active for faster queries
CREATE INDEX IF NOT EXISTS idx_badges_is_active ON public.badges(is_active);

-- ============================================================================
-- 4. MULTI-BADGE SUPPORT FOR CHALLENGES
-- ============================================================================

-- Create junction table for challenge required badges
CREATE TABLE IF NOT EXISTS public.challenge_required_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(challenge_id, badge_id)
);

-- Indexes for junction table
CREATE INDEX IF NOT EXISTS idx_challenge_required_badges_challenge
  ON public.challenge_required_badges(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_required_badges_badge
  ON public.challenge_required_badges(badge_id);

-- RLS for junction table
ALTER TABLE public.challenge_required_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to challenge badge requirements"
  ON public.challenge_required_badges FOR SELECT
  USING (true);
CREATE POLICY "Allow admin to manage challenge badge requirements"
  ON public.challenge_required_badges FOR ALL
  USING (public.is_admin());

-- Migrate existing required_badge data if column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'challenges' AND column_name = 'required_badge'
  ) THEN
    -- Copy existing required_badge relationships to new table
    INSERT INTO public.challenge_required_badges (challenge_id, badge_id)
    SELECT c.id, b.id
    FROM public.challenges c
    INNER JOIN public.badges b ON b.name = c.required_badge
    WHERE c.required_badge IS NOT NULL
    ON CONFLICT (challenge_id, badge_id) DO NOTHING;

    -- Drop old column
    ALTER TABLE public.challenges DROP COLUMN required_badge;
  END IF;
END $$;

-- ============================================================================
-- 5. SEASONS TABLES (if not already exist)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read-only access to seasons"
  ON public.seasons FOR SELECT
  USING (true);
CREATE POLICY "Allow admin full access to seasons"
  ON public.seasons FOR ALL
  USING (public.is_admin());

-- Season logs table
CREATE TABLE IF NOT EXISTS public.season_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  xp_final INT NOT NULL,
  level_final TEXT NOT NULL,
  goat_earned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_season_logs_user_id ON public.season_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_season_logs_season_id ON public.season_logs(season_id);

ALTER TABLE public.season_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow owner to read their season logs"
  ON public.season_logs FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Allow admin full access to season logs"
  ON public.season_logs FOR ALL
  USING (public.is_admin());

-- ============================================================================
-- 6. ADD SEASON_ID TO USER_BADGES IF NOT EXISTS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_badges' AND column_name = 'season_id'
  ) THEN
    ALTER TABLE public.user_badges
    ADD COLUMN season_id UUID REFERENCES public.seasons(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_badges_season_id ON public.user_badges(season_id);

-- ============================================================================
-- 7. HELPER FUNCTION: GET LEVEL BY XP
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_level_by_xp(p_xp_total INT)
RETURNS TABLE(level INT, name TEXT, xp_required INT) AS $$
BEGIN
  RETURN QUERY
  SELECT lc.level, lc.name, lc.xp_required
  FROM public.levels_config lc
  WHERE lc.xp_required <= p_xp_total
  ORDER BY lc.xp_required DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 8. HELPER FUNCTION: ADD XP AND UPDATE LEVEL
-- ============================================================================

CREATE OR REPLACE FUNCTION public.add_xp_to_user(
  p_user_id UUID,
  p_xp_amount INT
)
RETURNS TABLE(new_xp_total INT, new_level INT, new_level_name TEXT, leveled_up BOOLEAN) AS $$
DECLARE
  v_old_level INT;
  v_new_total INT;
  v_new_level INT;
  v_new_level_name TEXT;
  v_leveled_up BOOLEAN := false;
BEGIN
  -- Get current level
  SELECT current_level INTO v_old_level
  FROM public.users
  WHERE id = p_user_id;

  -- Add XP
  UPDATE public.users
  SET xp_total = xp_total + p_xp_amount
  WHERE id = p_user_id
  RETURNING xp_total INTO v_new_total;

  -- Calculate new level
  SELECT level, name INTO v_new_level, v_new_level_name
  FROM public.get_level_by_xp(v_new_total);

  -- Update level if changed
  IF v_new_level > v_old_level THEN
    v_leveled_up := true;
    UPDATE public.users
    SET current_level = v_new_level,
        level_name = v_new_level_name
    WHERE id = p_user_id;
  END IF;

  RETURN QUERY SELECT v_new_total, v_new_level, v_new_level_name, v_leveled_up;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON TABLE public.levels_config IS 'Standardized user progression levels with XP thresholds';
COMMENT ON TABLE public.challenge_required_badges IS 'Junction table for challenges requiring multiple badges';
COMMENT ON FUNCTION public.get_level_by_xp IS 'Helper function to determine user level based on XP total';
COMMENT ON FUNCTION public.add_xp_to_user IS 'Helper function to add XP and automatically update user level';
