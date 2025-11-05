/*
          # [User Progression Schema]
          This migration introduces a comprehensive user progression system, including levels, experience points (XP), and badges. It also expands the existing `users` table with more profile information.

          ## Query Description:
          - **ALTER TABLE users**: This operation modifies the existing `users` table. It adds new columns for profile customization and progression (`profile_picture_url`, `level`, `xp`, `favorite_team_id`, `is_subscribed`, `email`) and removes the now-redundant `is_guest` column. Existing user data will be preserved.
          - **CREATE TABLE badges**: Creates a new table to define all available badges in the game.
          - **CREATE TABLE user_badges**: Creates a join table to track which users have earned which badges.
          - **CREATE TABLE levels_config**: Creates a new table to define the XP requirements and icons for each level.
          - **RLS Policies**: Enables Row Level Security on all new tables and the modified `users` table to ensure users can only access and manage their own data.

          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Medium"
          - Requires-Backup: true
          - Reversible: false

          ## Structure Details:
          - **Modified**: `public.users`
          - **Created**: `public.badges`, `public.user_badges`, `public.levels_config`

          ## Security Implications:
          - RLS Status: Enabled on all affected tables.
          - Policy Changes: New policies are created to secure user data. Users can only access their own profile information and earned badges.
          - Auth Requirements: All policies rely on `auth.uid()` to identify the current user.
*/

-- Step 1: Alter the existing 'users' table to add new columns and remove the old 'is_guest' flag.
ALTER TABLE public.users
  ADD COLUMN email text UNIQUE,
  ADD COLUMN profile_picture_url text,
  ADD COLUMN level text NOT NULL DEFAULT 'Amateur',
  ADD COLUMN xp integer NOT NULL DEFAULT 0,
  ADD COLUMN favorite_team_id uuid,
  ADD COLUMN is_subscribed boolean NOT NULL DEFAULT false,
  DROP COLUMN is_guest;

-- Step 2: Create the 'badges' table
CREATE TABLE public.badges (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  icon_url text NOT NULL,
  condition_type text NOT NULL,
  condition_value jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.badges IS 'Stores definitions for all available badges.';

-- Step 3: Create the 'user_badges' table
CREATE TABLE public.user_badges (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);
COMMENT ON TABLE public.user_badges IS 'Tracks which badges have been earned by which users.';

-- Step 4: Create the 'levels_config' table
CREATE TABLE public.levels_config (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  level_name text NOT NULL UNIQUE,
  min_xp integer NOT NULL,
  max_xp integer,
  level_icon_url text
);
COMMENT ON TABLE public.levels_config IS 'Configuration for user levels based on XP.';

-- Step 5: Set up Row Level Security (RLS) for all tables

-- RLS for 'users' table (it should already be enabled, but we ensure policies are correct)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own profile." ON public.users;
CREATE POLICY "Users can view their own profile." ON public.users FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update their own profile." ON public.users;
CREATE POLICY "Users can update their own profile." ON public.users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- RLS for 'badges' table (all authenticated users can read)
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view badges." ON public.badges FOR SELECT TO authenticated USING (true);

-- RLS for 'user_badges' table
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own earned badges." ON public.user_badges FOR SELECT USING (auth.uid() = user_id);

-- RLS for 'levels_config' table (all authenticated users can read)
ALTER TABLE public.levels_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view level configurations." ON public.levels_config FOR SELECT TO authenticated USING (true);
