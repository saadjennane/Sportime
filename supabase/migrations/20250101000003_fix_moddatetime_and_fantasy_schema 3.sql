/*
          # [MODDATETIME FIX & FANTASY SCHEMA]
          This script enables the 'moddatetime' extension required for automatic 'updated_at' timestamps and creates the full schema for the Sportime Fantasy module.

          ## Query Description: [This operation enables a required database extension and adds several new tables for the fantasy football game mode. It also alters the existing 'players' and 'users' tables to add new columns. This is a structural change and is safe to run on the existing database.]
          
          ## Metadata:
          - Schema-Category: ["Structural"]
          - Impact-Level: ["Medium"]
          - Requires-Backup: [false]
          - Reversible: [false]
          
          ## Structure Details:
          - Enables 'moddatetime' extension.
          - Alters 'players' table to add: stats, pgs, category, fatigue.
          - Alters 'users' table to add: is_admin.
          - Creates new tables: fantasy_games, game_weeks, user_teams, boosters, scores.
          
          ## Security Implications:
          - RLS Status: [Enabled]
          - Policy Changes: [Yes]
          - Auth Requirements: [Admin policies are added for new tables.]
          
          ## Performance Impact:
          - Indexes: [Primary and foreign key indexes are added.]
          - Triggers: [Adds 'updated_at' triggers to new tables.]
          - Estimated Impact: [Low performance impact on existing operations.]
          */

-- Enable the moddatetime extension to handle updated_at automatically
CREATE EXTENSION IF NOT EXISTS moddatetime WITH SCHEMA extensions;

-- Add fantasy-related columns to the existing players table
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS stats jsonb,
ADD COLUMN IF NOT EXISTS pgs numeric,
ADD COLUMN IF NOT EXISTS category text,
ADD COLUMN IF NOT EXISTS fatigue numeric;

-- Create the fantasy_games table
CREATE TABLE IF NOT EXISTS public.fantasy_games (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    type text NOT NULL,
    format text NOT NULL,
    leagues jsonb,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    entry_price integer,
    prizes jsonb,
    conditions jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT fantasy_games_pkey PRIMARY KEY (id)
);
COMMENT ON TABLE public.fantasy_games IS 'Stores information about each fantasy game instance.';
ALTER TABLE public.fantasy_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read fantasy games" ON public.fantasy_games FOR SELECT USING (true);
CREATE POLICY "Admin can manage fantasy games" ON public.fantasy_games FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE is_admin = true));
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.fantasy_games
  FOR EACH ROW EXECUTE PROCEDURE extensions.moddatetime (updated_at);

-- Create the game_weeks table
CREATE TABLE IF NOT EXISTS public.game_weeks (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    fantasy_game_id uuid NOT NULL,
    week_number integer NOT NULL,
    formation text,
    theme text,
    fatigue_modifiers jsonb,
    limits jsonb,
    status text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT game_weeks_pkey PRIMARY KEY (id),
    CONSTRAINT game_weeks_fantasy_game_id_fkey FOREIGN KEY (fantasy_game_id) REFERENCES public.fantasy_games(id) ON DELETE CASCADE
);
COMMENT ON TABLE public.game_weeks IS 'Defines rules and themes for each week within a fantasy game.';
ALTER TABLE public.game_weeks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read game weeks" ON public.game_weeks FOR SELECT USING (true);
CREATE POLICY "Admin can manage game weeks" ON public.game_weeks FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE is_admin = true));
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.game_weeks
  FOR EACH ROW EXECUTE PROCEDURE extensions.moddatetime (updated_at);

-- Create the user_teams table
CREATE TABLE IF NOT EXISTS public.user_teams (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    fantasy_game_id uuid NOT NULL,
    starters uuid[],
    substitutes uuid[],
    captain_id uuid,
    active_booster text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT user_teams_pkey PRIMARY KEY (id),
    CONSTRAINT user_teams_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT user_teams_fantasy_game_id_fkey FOREIGN KEY (fantasy_game_id) REFERENCES public.fantasy_games(id) ON DELETE CASCADE
);
COMMENT ON TABLE public.user_teams IS 'Stores the team composition for each user in a fantasy game.';
ALTER TABLE public.user_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own teams" ON public.user_teams FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admin can manage all teams" ON public.user_teams FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE is_admin = true));
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.user_teams
  FOR EACH ROW EXECUTE PROCEDURE extensions.moddatetime (updated_at);

-- Create the boosters table
CREATE TABLE IF NOT EXISTS public.boosters (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    fantasy_game_id uuid NOT NULL,
    game_week_id uuid NOT NULL,
    type text NOT NULL,
    used_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT boosters_pkey PRIMARY KEY (id),
    CONSTRAINT boosters_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT boosters_fantasy_game_id_fkey FOREIGN KEY (fantasy_game_id) REFERENCES public.fantasy_games(id) ON DELETE CASCADE,
    CONSTRAINT boosters_game_week_id_fkey FOREIGN KEY (game_week_id) REFERENCES public.game_weeks(id) ON DELETE CASCADE
);
COMMENT ON TABLE public.boosters IS 'Tracks booster usage by users per game week.';
ALTER TABLE public.boosters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own boosters" ON public.boosters FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admin can manage all boosters" ON public.boosters FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE is_admin = true));

-- Create the scores table
CREATE TABLE IF NOT EXISTS public.scores (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_team_id uuid NOT NULL,
    game_week_id uuid NOT NULL,
    total_points integer NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT scores_pkey PRIMARY KEY (id),
    CONSTRAINT scores_user_team_id_fkey FOREIGN KEY (user_team_id) REFERENCES public.user_teams(id) ON DELETE CASCADE,
    CONSTRAINT scores_game_week_id_fkey FOREIGN KEY (game_week_id) REFERENCES public.game_weeks(id) ON DELETE CASCADE
);
COMMENT ON TABLE public.scores IS 'Stores the points scored by a user''s team for a specific game week.';
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read scores" ON public.scores FOR SELECT USING (true);
CREATE POLICY "Admin can manage scores" ON public.scores FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE is_admin = true));

-- Add is_admin column to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
