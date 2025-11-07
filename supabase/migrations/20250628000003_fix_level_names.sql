/*
  Fix Level Names - Correct "Amateur" to "Rookie"

  Level 1 should be "Rookie" (progression level), not "Amateur" (which is a challenge tier)

  Progression Levels: Rookie, Rising Star, Pro, Elite, Legend, GOAT
  Challenge Tiers: Amateur, Master, Apex
*/

-- Update level name from Amateur to Rookie
UPDATE public.levels_config
SET name = 'Rookie'
WHERE level = 1 AND name = 'Amateur';

-- Update any existing users who have level_name = 'Amateur' to 'Rookie'
UPDATE public.users
SET level_name = 'Rookie'
WHERE level_name = 'Amateur' AND current_level = 1;

-- Update default value for level_name column
ALTER TABLE public.users
ALTER COLUMN level_name SET DEFAULT 'Rookie';

COMMENT ON TABLE public.levels_config IS 'Standardized user progression levels: Rookie, Rising Star, Pro, Elite, Legend, GOAT (NOT challenge tiers which are Amateur/Master/Apex)';
