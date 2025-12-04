/*
          # [Feature] Sportime Fantasy Module Schema
          [This script creates the necessary tables and relationships for the new Fantasy Football game mode. It alters the existing 'players' table to add fantasy-specific attributes and creates new tables for game weeks, user teams, boosters, and scores. It also adds an 'is_admin' flag to the 'users' table to support admin-only RLS policies.]

          ## Query Description: [This operation will add new tables and alter the existing 'users' and 'players' tables. It is designed to be non-destructive to existing data. No backup is strictly required, but it is always best practice before significant schema changes.]
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Medium"
          - Requires-Backup: false
          - Reversible: true
          
          ## Structure Details:
          - Tables Created: game_weeks, user_fantasy_teams, user_fantasy_boosters, user_fantasy_scores
          - Tables Altered: users, players
          - Types Created: player_category (ENUM)
          
          ## Security Implications:
          - RLS Status: Enabled on all new tables.
          - Policy Changes: Yes, new policies are created for all new tables. An 'is_admin' check is introduced.
          - Auth Requirements: Policies are based on `auth.uid()` and the new `is_admin` flag.
          
          ## Performance Impact:
          - Indexes: Primary keys and foreign keys are indexed by default.
          - Triggers: `updated_at` triggers are added to all new tables.
          - Estimated Impact: Low.
          */

-- Add an is_admin column to the users table for RLS policies
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create ENUM type for player categories
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'player_category') THEN
        CREATE TYPE public.player_category AS ENUM ('Star', 'Key', 'Wild');
    END IF;
END$$;

-- 1. Alter 'players' table to add fantasy-specific fields
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS stats JSONB,
ADD COLUMN IF NOT EXISTS pgs REAL,
ADD COLUMN IF NOT EXISTS category public.player_category,
ADD COLUMN IF NOT EXISTS fatigue INTEGER NOT NULL DEFAULT 100;

-- 2. Create 'game_weeks' table
CREATE TABLE IF NOT EXISTS public.game_weeks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL,
    name TEXT,
    formation_constraint TEXT,
    theme TEXT,
    fatigue_modifiers JSONB, -- e.g., {"Star": -20, "Key": -10}
    player_limits JSONB, -- e.g., {"max_stars": 2, "max_from_club": 2}
    status TEXT NOT NULL DEFAULT 'upcoming', -- upcoming, active, finished
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(challenge_id, week_number)
);

-- 3. Create 'user_fantasy_teams' table
CREATE TABLE IF NOT EXISTS public.user_fantasy_teams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    game_week_id UUID NOT NULL REFERENCES public.game_weeks(id) ON DELETE CASCADE,
    starters UUID[] NOT NULL,
    substitutes UUID[] NOT NULL,
    captain_id UUID NOT NULL REFERENCES public.players(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(user_id, challenge_id, game_week_id)
);

-- 4. Create 'user_fantasy_boosters' table
CREATE TABLE IF NOT EXISTS public.user_fantasy_boosters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    booster_type TEXT NOT NULL, -- e.g., 'Double Impact', 'Golden Game', 'Recovery Boost'
    used_in_gameweek_id UUID NOT NULL REFERENCES public.game_weeks(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(user_id, challenge_id, booster_type) -- A user can use each booster type once per challenge
);

-- 5. Create 'user_fantasy_scores' table
CREATE TABLE IF NOT EXISTS public.user_fantasy_scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    game_week_id UUID NOT NULL REFERENCES public.game_weeks(id) ON DELETE CASCADE,
    points INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(user_id, challenge_id, game_week_id)
);

-- RLS Policies
-- Helper function to check for admin role
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT is_admin FROM public.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- game_weeks
ALTER TABLE public.game_weeks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read game weeks" ON public.game_weeks;
CREATE POLICY "Public can read game weeks" ON public.game_weeks FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage game weeks" ON public.game_weeks;
CREATE POLICY "Admins can manage game weeks" ON public.game_weeks FOR ALL USING (is_admin());

-- user_fantasy_teams
ALTER TABLE public.user_fantasy_teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own teams" ON public.user_fantasy_teams;
CREATE POLICY "Users can manage their own teams" ON public.user_fantasy_teams FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all teams" ON public.user_fantasy_teams;
CREATE POLICY "Admins can view all teams" ON public.user_fantasy_teams FOR SELECT USING (is_admin());


-- user_fantasy_boosters
ALTER TABLE public.user_fantasy_boosters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own boosters" ON public.user_fantasy_boosters;
CREATE POLICY "Users can manage their own boosters" ON public.user_fantasy_boosters FOR ALL USING (auth.uid() = user_id);

-- user_fantasy_scores
ALTER TABLE public.user_fantasy_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read scores" ON public.user_fantasy_scores;
CREATE POLICY "Public can read scores" ON public.user_fantasy_scores FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage scores" ON public.user_fantasy_scores;
CREATE POLICY "Admins can manage scores" ON public.user_fantasy_scores FOR ALL USING (is_admin());

-- Add updated_at triggers for new tables
CREATE OR REPLACE TRIGGER handle_updated_at_game_weeks BEFORE UPDATE ON public.game_weeks
  FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);

CREATE OR REPLACE TRIGGER handle_updated_at_user_fantasy_teams BEFORE UPDATE ON public.user_fantasy_teams
  FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);

CREATE OR REPLACE TRIGGER handle_updated_at_user_fantasy_boosters BEFORE UPDATE ON public.user_fantasy_boosters
  FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);

CREATE OR REPLACE TRIGGER handle_updated_at_user_fantasy_scores BEFORE UPDATE ON public.user_fantasy_scores
  FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);
