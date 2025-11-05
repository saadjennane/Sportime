-- 1. Enable moddatetime extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS moddatetime WITH SCHEMA extensions;

-- 2. Add is_admin to users table if it doesn't exist
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- 3. Update players table with new columns if they don't exist
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS stats jsonb;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS pgs numeric;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS fatigue integer DEFAULT 100;

-- 4. Create fantasy_games table
CREATE TABLE IF NOT EXISTS public.fantasy_games (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    type text NOT NULL,
    format text NOT NULL,
    leagues jsonb,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    entry_price integer DEFAULT 0,
    prizes jsonb,
    conditions jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Drop trigger if it exists, then create it to avoid errors on re-run
DROP TRIGGER IF EXISTS handle_updated_at ON public.fantasy_games;
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.fantasy_games FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);

-- 5. Create game_weeks table
CREATE TABLE IF NOT EXISTS public.game_weeks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    fantasy_game_id uuid REFERENCES public.fantasy_games(id) ON DELETE CASCADE,
    week_number integer NOT NULL,
    formation text,
    theme text,
    fatigue_modifiers jsonb,
    limits jsonb,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

DROP TRIGGER IF EXISTS handle_updated_at ON public.game_weeks;
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.game_weeks FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);

-- 6. Create user_teams table
CREATE TABLE IF NOT EXISTS public.user_teams (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    fantasy_game_id uuid REFERENCES public.fantasy_games(id) ON DELETE CASCADE,
    starters jsonb NOT NULL,
    substitutes jsonb NOT NULL,
    captain_id uuid REFERENCES public.players(id),
    booster text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

DROP TRIGGER IF EXISTS handle_updated_at ON public.user_teams;
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.user_teams FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);

-- 7. Create boosters table
CREATE TABLE IF NOT EXISTS public.boosters (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    type text NOT NULL,
    used_by uuid REFERENCES public.users(id) ON DELETE CASCADE,
    used_on_week uuid REFERENCES public.game_weeks(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 8. Create scores table
CREATE TABLE IF NOT EXISTS public.scores (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_team_id uuid REFERENCES public.user_teams(id) ON DELETE CASCADE,
    game_week_id uuid REFERENCES public.game_weeks(id) ON DELETE CASCADE,
    total_points integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 9. Add RLS policies (wrapped to be idempotent)
ALTER TABLE public.fantasy_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access for fantasy games" ON public.fantasy_games;
CREATE POLICY "Public read access for fantasy games" ON public.fantasy_games FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access for game weeks" ON public.game_weeks;
CREATE POLICY "Public read access for game weeks" ON public.game_weeks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage their own teams" ON public.user_teams;
CREATE POLICY "Users can manage their own teams" ON public.user_teams FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own boosters" ON public.boosters;
CREATE POLICY "Users can manage their own boosters" ON public.boosters FOR ALL USING (auth.uid() = used_by) WITH CHECK (auth.uid() = used_by);

DROP POLICY IF EXISTS "Users can view their own scores" ON public.scores;
CREATE POLICY "Users can view their own scores" ON public.scores FOR SELECT USING (EXISTS (SELECT 1 FROM user_teams WHERE user_teams.id = scores.user_team_id AND user_teams.user_id = auth.uid()));
