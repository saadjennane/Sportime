/*
          # [Operation Name]
          Update User Progression Schema

          ## Query Description: [This script updates the database to a new schema for user progression, including levels, badges, and an updated `users` table. It safely handles existing tables and columns to prevent errors on re-runs.

**Data Impact:**
- The `users` table will be modified. Columns `referral_code`, `referred_by`, `is_premium`, and `is_guest` will be removed if they exist.
- New columns (`profile_picture_url`, `level`, `xp`, etc.) will be added to the `users` table. No existing user data will be lost for retained columns like `email` and `coins_balance`.
- New tables `badges`, `user_badges`, and `levels_config` will be created.

**Safety:**
- This script uses `IF EXISTS` and `IF NOT EXISTS` to be non-destructive and safe to run multiple times.
- It is recommended to back up your database before applying major schema changes.]
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Medium"
          - Requires-Backup: true
          - Reversible: false
          
          ## Structure Details:
          - **Alters**: `public.users`
          - **Creates**: `public.badges`, `public.user_badges`, `public.levels_config`
          
          ## Security Implications:
          - RLS Status: Enabled
          - Policy Changes: Yes (Updates policies for the `users` table)
          - Auth Requirements: Supabase Auth
          
          ## Performance Impact:
          - Indexes: Adds primary keys and foreign keys, which create indexes.
          - Triggers: No new triggers.
          - Estimated Impact: Low performance impact on an empty or small database.
          */

-- Step 1: Safely drop old, unused columns from the users table if they exist.
ALTER TABLE public.users DROP COLUMN IF EXISTS referral_code;
ALTER TABLE public.users DROP COLUMN IF EXISTS referred_by;
ALTER TABLE public.users DROP COLUMN IF EXISTS is_premium;
ALTER TABLE public.users DROP COLUMN IF EXISTS is_guest;

-- Step 2: Add new columns to the users table if they don't exist.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_picture_url text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS level text NOT NULL DEFAULT 'Amateur';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS xp integer NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS favorite_team_id uuid;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_subscribed boolean NOT NULL DEFAULT false;

-- Step 3: Ensure core columns exist and have correct defaults.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS coins_balance integer NOT NULL DEFAULT 1000;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL;

-- Step 4: Create the new tables for the progression system.
CREATE TABLE IF NOT EXISTS public.badges (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    icon_url text,
    condition_type text,
    condition_value jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT badges_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.levels_config (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    level_name text NOT NULL,
    min_xp integer NOT NULL,
    max_xp integer NOT NULL,
    level_icon_url text,
    CONSTRAINT levels_config_pkey PRIMARY KEY (id),
    CONSTRAINT levels_config_level_name_key UNIQUE (level_name)
);

CREATE TABLE IF NOT EXISTS public.user_badges (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
    earned_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT user_badges_pkey PRIMARY KEY (id)
);

-- Step 5: Add foreign key constraint for favorite_team_id if needed (assuming a 'teams' table might exist later)
-- For now, we just have the column. If a 'teams' table is added, a constraint can be added like this:
-- ALTER TABLE public.users ADD CONSTRAINT users_favorite_team_id_fkey FOREIGN KEY (favorite_team_id) REFERENCES public.teams(id);

-- Step 6: Update Row Level Security (RLS) policies for the modified/new tables.
-- USERS table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users to read their own user record" ON public.users;
CREATE POLICY "Allow authenticated users to read their own user record" ON public.users
  FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Allow authenticated users to update their own user record" ON public.users;
CREATE POLICY "Allow authenticated users to update their own user record" ON public.users
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- BADGES table (allow all authenticated users to read)
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read access to all" ON public.badges;
CREATE POLICY "Allow authenticated read access to all" ON public.badges
  FOR SELECT TO authenticated USING (true);

-- USER_BADGES table
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users to read their own badges" ON public.user_badges;
CREATE POLICY "Allow authenticated users to read their own badges" ON public.user_badges
  FOR SELECT USING (auth.uid() = user_id);

-- LEVELS_CONFIG table (allow all authenticated users to read)
ALTER TABLE public.levels_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read access to all" ON public.levels_config;
CREATE POLICY "Allow authenticated read access to all" ON public.levels_config
  FOR SELECT TO authenticated USING (true);
