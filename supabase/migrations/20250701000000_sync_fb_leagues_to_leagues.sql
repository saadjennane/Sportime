/*
  Sync fb_leagues to leagues Table

  This migration empties the `leagues` table and fills it with data from `fb_leagues`,
  then creates a trigger to keep them automatically synchronized.

  Tables affected:
  - leagues (TRUNCATED and repopulated)
  - fb_leagues (source of truth)

  Safety:
  - This is a destructive operation
  - All existing leagues data will be deleted
  - Foreign key references from challenges will break if they exist
*/

-- Step 1: Safety check - verify we're not breaking active challenges
DO $$
DECLARE
  challenge_count INTEGER;
  challenge_leagues_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO challenge_count FROM public.challenges;
  SELECT COUNT(*) INTO challenge_leagues_count FROM public.challenge_leagues;

  IF challenge_count > 0 OR challenge_leagues_count > 0 THEN
    RAISE WARNING 'Found % challenges and % challenge_leagues entries. Proceeding will orphan these references.',
      challenge_count, challenge_leagues_count;
    -- Note: Not raising an exception, just warning. User confirmed they want to proceed.
  END IF;
END $$;

-- Step 2: Truncate the leagues table (keeps structure, removes all data)
TRUNCATE TABLE public.leagues CASCADE;

-- Step 3: Populate leagues from fb_leagues
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Get admin user ID (saadjennane@gmail.com)
  SELECT id INTO admin_user_id FROM public.users WHERE email = 'saadjennane@gmail.com';

  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Admin user not found. Cannot populate leagues.';
  END IF;

  -- Insert all fb_leagues data into leagues
  INSERT INTO public.leagues (
    id,                    -- Generate new UUID
    name,                  -- From fb_leagues.name
    description,           -- Default to name
    logo,                  -- From fb_leagues.logo
    type,                  -- From fb_leagues.type (or default to 'football_competition')
    api_league_id,         -- From fb_leagues.api_league_id
    created_by,            -- Admin user
    invite_code,           -- Generated from name
    country_or_region,     -- From fb_leagues.country
    season                 -- From fb_leagues.season (cast to TEXT)
  )
  SELECT
    gen_random_uuid(),                                           -- Generate UUID
    fl.name,                                                      -- League name
    fl.name,                                                      -- Description = name
    fl.logo,                                                      -- Logo URL
    COALESCE(fl.type, 'football_competition'),                   -- Type (default if NULL)
    fl.api_league_id::INTEGER,                                   -- API league ID (cast BIGINT to INTEGER)
    admin_user_id,                                               -- Creator
    UPPER(REPLACE(REGEXP_REPLACE(fl.name, '[^a-zA-Z0-9 ]', '', 'g'), ' ', '_')), -- Invite code from name
    fl.country,                                                  -- Country/region
    fl.season::TEXT                                              -- Season as TEXT
  FROM public.fb_leagues fl
  WHERE fl.api_league_id IS NOT NULL;  -- Only leagues with valid API IDs

  RAISE NOTICE 'Populated % leagues from fb_leagues', (SELECT COUNT(*) FROM public.leagues);
END $$;

-- Step 4: Create trigger function to keep leagues synchronized with fb_leagues
CREATE OR REPLACE FUNCTION public.sync_fb_leagues_to_leagues()
RETURNS TRIGGER AS $$
DECLARE
  admin_user_id UUID;
  league_uuid UUID;
BEGIN
  -- Get admin user for created_by field
  SELECT id INTO admin_user_id FROM public.users WHERE email = 'saadjennane@gmail.com';

  IF admin_user_id IS NULL THEN
    RAISE WARNING 'Admin user not found. Using NULL for created_by.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Insert new league when fb_leagues row is inserted
    INSERT INTO public.leagues (
      id,
      name,
      description,
      logo,
      type,
      api_league_id,
      created_by,
      invite_code,
      country_or_region,
      season
    )
    VALUES (
      gen_random_uuid(),
      NEW.name,
      NEW.name,
      NEW.logo,
      COALESCE(NEW.type, 'football_competition'),
      NEW.api_league_id::INTEGER,
      admin_user_id,
      UPPER(REPLACE(REGEXP_REPLACE(NEW.name, '[^a-zA-Z0-9 ]', '', 'g'), ' ', '_')),
      NEW.country,
      NEW.season::TEXT
    );

    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Update existing league when fb_leagues row is updated
    UPDATE public.leagues
    SET
      name = NEW.name,
      description = NEW.name,
      logo = NEW.logo,
      type = COALESCE(NEW.type, 'football_competition'),
      country_or_region = NEW.country,
      season = NEW.season::TEXT,
      updated_at = NOW()
    WHERE api_league_id = NEW.api_league_id::INTEGER;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- Delete league when fb_leagues row is deleted
    DELETE FROM public.leagues
    WHERE api_league_id = OLD.api_league_id::INTEGER;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create trigger on fb_leagues table
DROP TRIGGER IF EXISTS on_fb_leagues_sync_to_leagues ON public.fb_leagues;
CREATE TRIGGER on_fb_leagues_sync_to_leagues
  AFTER INSERT OR UPDATE OR DELETE ON public.fb_leagues
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_fb_leagues_to_leagues();

-- Step 6: Verification - Show synchronized leagues
SELECT
  l.id AS league_uuid,
  l.name,
  l.api_league_id,
  l.country_or_region,
  l.season,
  l.type
FROM public.leagues l
ORDER BY l.name
LIMIT 20;

COMMENT ON FUNCTION public.sync_fb_leagues_to_leagues() IS
  'Automatically synchronizes fb_leagues (API-Football source) with leagues (application table). Maintains UUID mapping via api_league_id.';
