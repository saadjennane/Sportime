/*
  Sync fb_teams to teams Table

  This migration synchronizes the `teams` table with data from `fb_teams`,
  then creates a trigger to keep them automatically synchronized.

  Tables affected:
  - teams (populated from fb_teams)
  - fb_teams (source of truth from API-Football)

  Mapping:
  - fb_teams.id (INTEGER)       → teams.api_team_id (INTEGER)
  - fb_teams.name               → teams.name
  - fb_teams.logo               → teams.logo_url
  - fb_teams.country_id (INT)   → teams.country (TEXT) - via countries lookup
*/

-- Step 1: Add api_team_id column to teams table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'teams'
      AND column_name = 'api_team_id'
  ) THEN
    ALTER TABLE public.teams ADD COLUMN api_team_id INTEGER UNIQUE;
    RAISE NOTICE 'Added api_team_id column to teams table';
  ELSE
    RAISE NOTICE 'api_team_id column already exists';
  END IF;
END $$;

-- Step 2: Populate teams from fb_teams (only for teams not already synced)
DO $$
DECLARE
  admin_user_id UUID;
  inserted_count INTEGER := 0;
BEGIN
  -- Get admin user ID (saadjennane@gmail.com)
  SELECT id INTO admin_user_id FROM public.users WHERE email = 'saadjennane@gmail.com';

  IF admin_user_id IS NULL THEN
    RAISE WARNING 'Admin user not found. Using NULL for created_by.';
  END IF;

  -- Insert teams from fb_teams that don't already exist
  WITH inserted_teams AS (
    INSERT INTO public.teams (
      id,                    -- Generate new UUID
      name,                  -- From fb_teams.name
      logo_url,              -- From fb_teams.logo
      country,               -- From fb_teams.country_id (lookup if possible)
      api_team_id            -- From fb_teams.id
    )
    SELECT
      gen_random_uuid(),                                           -- Generate UUID
      ft.name,                                                      -- Team name
      ft.logo,                                                      -- Logo URL
      COALESCE(
        (SELECT name FROM public.countries WHERE id = ft.country_id),
        'Unknown'
      ),                                                            -- Country name from lookup
      ft.id                                                         -- API team ID
    FROM public.fb_teams ft
    WHERE ft.id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.teams t WHERE t.api_team_id = ft.id
      )
    RETURNING *
  )
  SELECT COUNT(*) INTO inserted_count FROM inserted_teams;

  RAISE NOTICE 'Populated % new teams from fb_teams', inserted_count;
  RAISE NOTICE 'Total teams in table: %', (SELECT COUNT(*) FROM public.teams);
END $$;

-- Step 3: Create trigger function to keep teams synchronized with fb_teams
CREATE OR REPLACE FUNCTION public.sync_fb_teams_to_teams()
RETURNS TRIGGER AS $$
DECLARE
  team_uuid UUID;
  country_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Get country name if available
    SELECT name INTO country_name
    FROM public.countries
    WHERE id = NEW.country_id;

    -- Insert new team when fb_teams row is inserted
    INSERT INTO public.teams (
      id,
      name,
      logo_url,
      country,
      api_team_id
    )
    VALUES (
      gen_random_uuid(),
      NEW.name,
      NEW.logo,
      COALESCE(country_name, 'Unknown'),
      NEW.id
    )
    ON CONFLICT (api_team_id) DO NOTHING;

    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Get country name if available
    SELECT name INTO country_name
    FROM public.countries
    WHERE id = NEW.country_id;

    -- Update existing team when fb_teams row is updated
    UPDATE public.teams
    SET
      name = NEW.name,
      logo_url = NEW.logo,
      country = COALESCE(country_name, 'Unknown'),
      updated_at = NOW()
    WHERE api_team_id = NEW.id;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- Delete team when fb_teams row is deleted
    -- WARNING: This will fail if there are foreign key references
    DELETE FROM public.teams
    WHERE api_team_id = OLD.id;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create trigger on fb_teams table
DROP TRIGGER IF EXISTS on_fb_teams_sync_to_teams ON public.fb_teams;
CREATE TRIGGER on_fb_teams_sync_to_teams
  AFTER INSERT OR UPDATE OR DELETE ON public.fb_teams
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_fb_teams_to_teams();

-- Step 5: Verification - Show synchronized teams
SELECT
  t.id AS team_uuid,
  t.name,
  t.api_team_id,
  t.country,
  t.logo_url
FROM public.teams t
WHERE t.api_team_id IS NOT NULL
ORDER BY t.name
LIMIT 20;

COMMENT ON FUNCTION public.sync_fb_teams_to_teams() IS
  'Automatically synchronizes fb_teams (API-Football source) with teams (application table). Maintains UUID mapping via api_team_id.';

COMMENT ON COLUMN public.teams.api_team_id IS
  'Maps to fb_teams.id - the INTEGER ID from API-Football. Used for synchronization.';
