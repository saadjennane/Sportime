-- Migration to support the new fantasy engine rules.

-- 1. Add new columns to the 'players' table
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS pgs NUMERIC,
ADD COLUMN IF NOT EXISTS status TEXT, -- 'Star', 'Key', 'Wild'
ADD COLUMN IF NOT EXISTS playtime_ratio NUMERIC;

-- 2. Add new columns to the 'user_fantasy_teams' table
-- Note: Supabase doesn't have a native map/JSONB array type that's easily queryable without extra steps.
-- Storing fatigue_state as JSONB is a flexible approach.
ALTER TABLE public.user_fantasy_teams
ADD COLUMN IF NOT EXISTS fatigue_state JSONB, -- e.g., {'p1': 0.8, 'p2': 1.0}
ADD COLUMN IF NOT EXISTS booster_used INTEGER,
ADD COLUMN IF NOT EXISTS captain_id TEXT;

-- 3. Create a new table for fantasy configurations
CREATE TABLE IF NOT EXISTS public.fantasy_configs (
    id TEXT PRIMARY KEY DEFAULT 'default_config',
    config JSONB NOT NULL
);

-- Ensure RLS is enabled
ALTER TABLE public.fantasy_configs ENABLE ROW LEVEL SECURITY;

-- Policies for fantasy_configs
CREATE POLICY "Allow public read access" ON public.fantasy_configs FOR SELECT USING (true);
CREATE POLICY "Allow admin write access" ON public.fantasy_configs FOR ALL USING (auth.jwt()-&gt;&gt;'user_metadata'-&gt;&gt;'is_admin' = 'true');

-- Insert default configuration if it doesn't exist
INSERT INTO public.fantasy_configs (id, config)
VALUES ('default_config', '{
  "fatigue": {"star": 0.2, "key": 0.1, "rest": 0.1},
  "bonuses": {"no_star": 1.25, "crazy": 1.4, "vintage": 1.2},
  "boosters": {"double_impact": 2.2, "golden_game": 1.2},
  "captain_passive": 1.1
}')
ON CONFLICT (id) DO NOTHING;
