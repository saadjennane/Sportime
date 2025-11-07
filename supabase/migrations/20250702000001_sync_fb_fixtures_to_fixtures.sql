/*
  Sync fb_fixtures to fixtures Table

  This migration synchronizes the `fixtures` table with data from `fb_fixtures`,
  then creates a trigger to keep them automatically synchronized.

  Tables affected:
  - fixtures (populated from fb_fixtures)
  - fb_fixtures (source of truth from API-Football)

  Mapping:
  - fb_fixtures.id (INTEGER)           → fixtures.api_id (INTEGER)
  - fb_fixtures.home_team_id (INT)     → fixtures.home_team_id (UUID) - via teams.api_team_id lookup
  - fb_fixtures.away_team_id (INT)     → fixtures.away_team_id (UUID) - via teams.api_team_id lookup
  - fb_fixtures.league_id (BIGINT)     → fixtures.league_id (UUID) - via leagues.api_league_id lookup
  - fb_fixtures.match_date             → fixtures.match_date
  - fb_fixtures.status                 → fixtures.status
  - fb_fixtures.home_score             → fixtures.home_score
  - fb_fixtures.away_score             → fixtures.away_score
  - fb_fixtures.venue                  → fixtures.venue

  Note: This migration requires that teams sync migration (20250702000000) has been applied first.
*/

-- Step 1: Add api_id column to fixtures table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fixtures'
      AND column_name = 'api_id'
  ) THEN
    ALTER TABLE public.fixtures ADD COLUMN api_id INTEGER UNIQUE;
    RAISE NOTICE 'Added api_id column to fixtures table';
  ELSE
    RAISE NOTICE 'api_id column already exists';
  END IF;
END $$;

-- Step 2: Populate fixtures from fb_fixtures (only for fixtures not already synced)
DO $$
DECLARE
  inserted_count INTEGER := 0;
  skipped_count INTEGER := 0;
BEGIN
  -- Insert fixtures from fb_fixtures that don't already exist
  WITH inserted_fixtures AS (
    INSERT INTO public.fixtures (
      id,                    -- Generate new UUID
      home_team_id,          -- UUID from teams lookup
      away_team_id,          -- UUID from teams lookup
      league_id,             -- UUID from leagues lookup
      match_date,            -- From fb_fixtures.match_date
      status,                -- From fb_fixtures.status
      home_score,            -- From fb_fixtures.home_score
      away_score,            -- From fb_fixtures.away_score
      venue,                 -- From fb_fixtures.venue
      api_id                 -- From fb_fixtures.id
    )
    SELECT
      gen_random_uuid(),                                           -- Generate UUID
      ht.id,                                                        -- Home team UUID
      at.id,                                                        -- Away team UUID
      l.id,                                                         -- League UUID
      ff.match_date,                                                -- Match date
      ff.status,                                                    -- Status
      ff.home_score,                                                -- Home score
      ff.away_score,                                                -- Away score
      ff.venue,                                                     -- Venue
      ff.id                                                         -- API fixture ID
    FROM public.fb_fixtures ff
    INNER JOIN public.teams ht ON ht.api_team_id = ff.home_team_id  -- Home team lookup
    INNER JOIN public.teams at ON at.api_team_id = ff.away_team_id  -- Away team lookup
    INNER JOIN public.leagues l ON l.api_league_id = ff.league_id::INTEGER  -- League lookup
    WHERE ff.id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.fixtures f WHERE f.api_id = ff.id
      )
    RETURNING *
  )
  SELECT COUNT(*) INTO inserted_count FROM inserted_fixtures;

  -- Count skipped fixtures (missing team or league mappings)
  SELECT COUNT(*) INTO skipped_count
  FROM public.fb_fixtures ff
  WHERE ff.id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.fixtures f WHERE f.api_id = ff.id)
    AND (
      NOT EXISTS (SELECT 1 FROM public.teams ht WHERE ht.api_team_id = ff.home_team_id)
      OR NOT EXISTS (SELECT 1 FROM public.teams at WHERE at.api_team_id = ff.away_team_id)
      OR NOT EXISTS (SELECT 1 FROM public.leagues l WHERE l.api_league_id = ff.league_id::INTEGER)
    );

  RAISE NOTICE 'Populated % new fixtures from fb_fixtures', inserted_count;
  RAISE NOTICE 'Skipped % fixtures due to missing team/league mappings', skipped_count;
  RAISE NOTICE 'Total fixtures in table: %', (SELECT COUNT(*) FROM public.fixtures);
END $$;

-- Step 3: Create trigger function to keep fixtures synchronized with fb_fixtures
CREATE OR REPLACE FUNCTION public.sync_fb_fixtures_to_fixtures()
RETURNS TRIGGER AS $$
DECLARE
  home_team_uuid UUID;
  away_team_uuid UUID;
  league_uuid UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Lookup team and league UUIDs
    SELECT id INTO home_team_uuid FROM public.teams WHERE api_team_id = NEW.home_team_id;
    SELECT id INTO away_team_uuid FROM public.teams WHERE api_team_id = NEW.away_team_id;
    SELECT id INTO league_uuid FROM public.leagues WHERE api_league_id = NEW.league_id::INTEGER;

    -- Only insert if we have all required mappings
    IF home_team_uuid IS NOT NULL AND away_team_uuid IS NOT NULL AND league_uuid IS NOT NULL THEN
      INSERT INTO public.fixtures (
        id,
        home_team_id,
        away_team_id,
        league_id,
        match_date,
        status,
        home_score,
        away_score,
        venue,
        api_id
      )
      VALUES (
        gen_random_uuid(),
        home_team_uuid,
        away_team_uuid,
        league_uuid,
        NEW.match_date,
        NEW.status,
        NEW.home_score,
        NEW.away_score,
        NEW.venue,
        NEW.id
      )
      ON CONFLICT (api_id) DO NOTHING;
    ELSE
      RAISE WARNING 'Skipped fixture % - missing team or league mapping (home:%, away:%, league:%)',
        NEW.id, home_team_uuid, away_team_uuid, league_uuid;
    END IF;

    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Lookup team and league UUIDs
    SELECT id INTO home_team_uuid FROM public.teams WHERE api_team_id = NEW.home_team_id;
    SELECT id INTO away_team_uuid FROM public.teams WHERE api_team_id = NEW.away_team_id;
    SELECT id INTO league_uuid FROM public.leagues WHERE api_league_id = NEW.league_id::INTEGER;

    -- Update existing fixture
    IF home_team_uuid IS NOT NULL AND away_team_uuid IS NOT NULL AND league_uuid IS NOT NULL THEN
      UPDATE public.fixtures
      SET
        home_team_id = home_team_uuid,
        away_team_id = away_team_uuid,
        league_id = league_uuid,
        match_date = NEW.match_date,
        status = NEW.status,
        home_score = NEW.home_score,
        away_score = NEW.away_score,
        venue = NEW.venue,
        updated_at = NOW()
      WHERE api_id = NEW.id;
    END IF;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- Delete fixture when fb_fixtures row is deleted
    -- WARNING: This will fail if there are foreign key references (bets, etc.)
    DELETE FROM public.fixtures
    WHERE api_id = OLD.id;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create trigger on fb_fixtures table
DROP TRIGGER IF EXISTS on_fb_fixtures_sync_to_fixtures ON public.fb_fixtures;
CREATE TRIGGER on_fb_fixtures_sync_to_fixtures
  AFTER INSERT OR UPDATE OR DELETE ON public.fb_fixtures
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_fb_fixtures_to_fixtures();

-- Step 5: Verification - Show synchronized fixtures
SELECT
  f.id AS fixture_uuid,
  f.api_id,
  ht.name AS home_team,
  at.name AS away_team,
  l.name AS league,
  f.match_date,
  f.status,
  CONCAT(COALESCE(f.home_score::TEXT, '-'), ' - ', COALESCE(f.away_score::TEXT, '-')) AS score
FROM public.fixtures f
INNER JOIN public.teams ht ON f.home_team_id = ht.id
INNER JOIN public.teams at ON f.away_team_id = at.id
INNER JOIN public.leagues l ON f.league_id = l.id
WHERE f.api_id IS NOT NULL
ORDER BY f.match_date DESC
LIMIT 20;

COMMENT ON FUNCTION public.sync_fb_fixtures_to_fixtures() IS
  'Automatically synchronizes fb_fixtures (API-Football source) with fixtures (application table). Performs UUID lookups for teams and leagues via api_team_id and api_league_id mappings.';

COMMENT ON COLUMN public.fixtures.api_id IS
  'Maps to fb_fixtures.id - the INTEGER ID from API-Football. Used for synchronization.';
