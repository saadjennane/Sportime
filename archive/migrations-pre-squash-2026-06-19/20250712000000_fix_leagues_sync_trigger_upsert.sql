/*
  Fix League Sync Trigger to Use UPSERT Pattern

  This migration updates the sync_fb_leagues_to_leagues trigger function
  to use UPSERT (ON CONFLICT DO UPDATE) instead of separate INSERT/UPDATE.

  This prevents duplicate leagues from being created when fb_leagues data is reimported.

  Related: fix_leagues_duplications.sql (already executed manually)
*/

-- Update the sync trigger function to use UPSERT pattern
CREATE OR REPLACE FUNCTION public.sync_fb_leagues_to_leagues()
RETURNS TRIGGER AS $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Get admin user for created_by field
  SELECT id INTO admin_user_id FROM public.users WHERE email = 'saadjennane@gmail.com';

  IF admin_user_id IS NULL THEN
    RAISE WARNING 'Admin user not found. Using NULL for created_by.';
  END IF;

  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- UPSERT: Insert new or update existing league
    INSERT INTO public.leagues (
      id,
      name,
      description,
      logo,
      type,
      api_id,
      created_by,
      invite_code
    )
    VALUES (
      gen_random_uuid(),
      NEW.name,
      CASE
        WHEN NEW.country IS NOT NULL THEN NEW.name || ' (' || NEW.country || ')'
        ELSE NEW.name
      END,
      NEW.logo,
      COALESCE(NEW.type, 'football_competition'),
      NEW.api_league_id::INTEGER,
      admin_user_id,
      UPPER(REPLACE(REGEXP_REPLACE(NEW.name, '[^a-zA-Z0-9 ]', '', 'g'), ' ', '_'))
    )
    ON CONFLICT (api_id) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      logo = EXCLUDED.logo,
      type = EXCLUDED.type,
      updated_at = NOW();

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- Delete league when fb_leagues row is deleted
    DELETE FROM public.leagues
    WHERE api_id = OLD.api_league_id::INTEGER;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify the trigger exists (should already be there from earlier migration)
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'on_fb_leagues_sync_to_leagues';

COMMENT ON FUNCTION public.sync_fb_leagues_to_leagues() IS
  'Automatically synchronizes fb_leagues (API-Football source) with leagues (application table). Uses UPSERT to prevent duplicates. Maintains UUID mapping via api_id.';
