-- ============================================================================
-- GAME CONFIGURATION TABLE
-- ============================================================================
-- This migration creates a centralized configuration table for all game settings
-- Allows runtime configuration changes without code deployment
-- Date: 2025-11-17

-- Create game_config table
CREATE TABLE IF NOT EXISTS public.game_config (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,  -- 'rewards' | 'progression' | 'tournament' | 'pgs_formula' | 'badges' | 'system'
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  version INT DEFAULT 1,  -- Incremented when "Publish" is clicked
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),

  CONSTRAINT unique_category_key UNIQUE (category, key)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_game_config_category ON public.game_config(category);
CREATE INDEX IF NOT EXISTS idx_game_config_key ON public.game_config(key);
CREATE INDEX IF NOT EXISTS idx_game_config_version ON public.game_config(version);
CREATE INDEX IF NOT EXISTS idx_game_config_is_active ON public.game_config(is_active);

-- Add comments for documentation
COMMENT ON TABLE public.game_config IS 'Centralized game configuration for runtime admin control';
COMMENT ON COLUMN public.game_config.id IS 'Unique identifier (e.g., "daily_streak_rewards")';
COMMENT ON COLUMN public.game_config.category IS 'Configuration category for grouping';
COMMENT ON COLUMN public.game_config.key IS 'Human-readable key within category';
COMMENT ON COLUMN public.game_config.value IS 'JSON configuration value';
COMMENT ON COLUMN public.game_config.version IS 'Cache invalidation version (incremented on publish)';
COMMENT ON COLUMN public.game_config.updated_by IS 'Admin user who last updated this config';

-- Enable Row Level Security
ALTER TABLE public.game_config ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can read configs (needed for frontend)
CREATE POLICY "Allow public read access to game configs"
ON public.game_config
FOR SELECT
USING (true);

-- RLS Policy: Only super_admin can insert/update/delete
-- (This will be created after users.role column exists in next migration)
-- For now, we'll create a permissive policy and lock it down later

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_game_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating updated_at
CREATE TRIGGER trigger_game_config_updated_at
BEFORE UPDATE ON public.game_config
FOR EACH ROW
EXECUTE FUNCTION update_game_config_updated_at();

-- ============================================================================
-- VERIFICATION QUERY (run separately to verify)
-- ============================================================================
-- SELECT
--   id,
--   category,
--   key,
--   value,
--   version,
--   is_active,
--   updated_at
-- FROM game_config
-- ORDER BY category, key;
