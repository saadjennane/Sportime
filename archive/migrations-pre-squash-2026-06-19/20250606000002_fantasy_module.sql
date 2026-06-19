/*
          # Fantasy Module Schema
          This migration creates the necessary tables for the Sportime Fantasy Football module and adds required columns to existing tables.

          ## Query Description: This operation is primarily structural. It adds several new tables (`fantasy_games`, `game_weeks`, `user_teams`, `boosters`, `scores`) and alters the existing `users` and `players` tables. It is designed to be non-destructive to existing data.

          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Medium"
          - Requires-Backup: false
          - Reversible: false

          ## Structure Details:
          - **Alters**: `users`, `players`
          - **Creates**: `fantasy_games`, `game_weeks`, `user_teams`, `boosters`, `scores`

          ## Security Implications:
          - RLS Status: Enabled on all new tables.
          - Policy Changes: Adds standard read and user-specific management policies.
          - Auth Requirements: Policies are tied to `auth.uid()`.
          
          ## Performance Impact:
          - Indexes: Adds primary and foreign key indexes.
          - Triggers: Adds `updated_at` triggers to all new tables.
          - Estimated Impact: Low.
          */

-- 1. Add new columns to existing tables
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS stats jsonb;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS pgs numeric;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS fatigue integer DEFAULT 100;

-- 2. Create `fantasy_games` table
CREATE TABLE IF NOT EXISTS public.fantasy_games (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    type text,
    format text,
    leagues jsonb,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    entry_price integer,
    prizes jsonb,
    conditions jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.fantasy_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for fantasy_games" ON public.fantasy_games FOR SELECT USING (true);
CREATE POLICY "Allow admins to manage fantasy_games" ON public.fantasy_games FOR ALL USING (
  (SELECT is_admin FROM public.users WHERE id = auth.uid()) = true
) WITH CHECK (
  (SELECT is_admin FROM public.users WHERE id = auth.uid()) = true
);
CREATE TRIGGER handle_updated_at_fantasy_games BEFORE UPDATE ON public.fantasy_games FOR EACH ROW EXECUTE FUNCTION moddatetime (updated_at);

-- 3. Create `game_weeks` table
CREATE TABLE IF NOT EXISTS public.game_weeks (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    fantasy_game_id uuid NOT NULL,
    formation text,
    theme text,
    fatigue_modifiers jsonb,
    limits jsonb,
    status text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fk_fantasy_game FOREIGN KEY (fantasy_game_id) REFERENCES public.fantasy_games(id) ON DELETE CASCADE
);
ALTER TABLE public.game_weeks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for game_weeks" ON public.game_weeks FOR SELECT USING (true);
CREATE POLICY "Allow admins to manage game_weeks" ON public.game_weeks FOR ALL USING (
  (SELECT is_admin FROM public.users WHERE id = auth.uid()) = true
) WITH CHECK (
  (SELECT is_admin FROM public.users WHERE id = auth.uid()) = true
);
CREATE TRIGGER handle_updated_at_game_weeks BEFORE UPDATE ON public.game_weeks FOR EACH ROW EXECUTE FUNCTION moddatetime (updated_at);

-- 4. Create `user_teams` table
CREATE TABLE IF NOT EXISTS public.user_teams (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid NOT NULL,
    fantasy_game_id uuid NOT NULL,
    starters jsonb,
    substitutes jsonb,
    captain_id uuid,
    booster text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_fantasy_game FOREIGN KEY (fantasy_game_id) REFERENCES public.fantasy_games(id) ON DELETE CASCADE,
    CONSTRAINT fk_captain FOREIGN KEY (captain_id) REFERENCES public.players(id) ON DELETE SET NULL
);
ALTER TABLE public.user_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow users to manage their own teams" ON public.user_teams FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow admins full access to user_teams" ON public.user_teams FOR ALL USING (
  (SELECT is_admin FROM public.users WHERE id = auth.uid()) = true
);
CREATE TRIGGER handle_updated_at_user_teams BEFORE UPDATE ON public.user_teams FOR EACH ROW EXECUTE FUNCTION moddatetime (updated_at);

-- 5. Create `boosters` table
CREATE TABLE IF NOT EXISTS public.boosters (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    type text NOT NULL,
    used_by uuid NOT NULL,
    used_on_week uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fk_user FOREIGN KEY (used_by) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_game_week FOREIGN KEY (used_on_week) REFERENCES public.game_weeks(id) ON DELETE CASCADE
);
ALTER TABLE public.boosters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow users to manage their own boosters" ON public.boosters FOR ALL USING (auth.uid() = used_by) WITH CHECK (auth.uid() = used_by);
CREATE POLICY "Allow admins full access to boosters" ON public.boosters FOR ALL USING (
  (SELECT is_admin FROM public.users WHERE id = auth.uid()) = true
);
CREATE TRIGGER handle_updated_at_boosters BEFORE UPDATE ON public.boosters FOR EACH ROW EXECUTE FUNCTION moddatetime (updated_at);

-- 6. Create `scores` table
CREATE TABLE IF NOT EXISTS public.scores (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_team_id uuid NOT NULL,
    game_week_id uuid NOT NULL,
    total_points integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fk_user_team FOREIGN KEY (user_team_id) REFERENCES public.user_teams(id) ON DELETE CASCADE,
    CONSTRAINT fk_game_week FOREIGN KEY (game_week_id) REFERENCES public.game_weeks(id) ON DELETE CASCADE
);
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for scores" ON public.scores FOR SELECT USING (true);
CREATE POLICY "Allow admins to manage scores" ON public.scores FOR ALL USING (
  (SELECT is_admin FROM public.users WHERE id = auth.uid()) = true
) WITH CHECK (
  (SELECT is_admin FROM public.users WHERE id = auth.uid()) = true
);
CREATE TRIGGER handle_updated_at_scores BEFORE UPDATE ON public.scores FOR EACH ROW EXECUTE FUNCTION moddatetime (updated_at);
