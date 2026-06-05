-- Fix fb_odds table structure to match the intended design
-- The fixture_id should be BIGINT (API ID) not UUID

-- First, check current structure
SELECT '=== Current fb_odds structure ===' as step;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'fb_odds' AND column_name = 'fixture_id';

SELECT '=== Current fb_fixtures structure ===' as step;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'fb_fixtures' AND column_name IN ('id', 'api_id')
ORDER BY column_name;

-- Drop and recreate fb_odds with correct structure
-- WARNING: This will delete all existing odds data
DROP TABLE IF EXISTS public.fb_odds CASCADE;

CREATE TABLE public.fb_odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id BIGINT NOT NULL, -- API-Football fixture ID (matches fb_fixtures.id)
  bookmaker_name TEXT NOT NULL,
  home_win DECIMAL(10, 2),
  draw DECIMAL(10, 2),
  away_win DECIMAL(10, 2),
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fixture_id, bookmaker_name)
);

CREATE INDEX idx_fb_odds_fixture ON public.fb_odds(fixture_id);
CREATE INDEX idx_fb_odds_bookmaker ON public.fb_odds(bookmaker_name);

-- Enable RLS
ALTER TABLE public.fb_odds ENABLE ROW LEVEL SECURITY;

-- Recreate permissions (keep the anon policy we added)
CREATE POLICY "Allow anon full access for fb_odds"
  ON public.fb_odds FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated full access for fb_odds"
  ON public.fb_odds FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service_role full access for fb_odds"
  ON public.fb_odds FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.fb_odds TO anon;
GRANT ALL ON public.fb_odds TO authenticated;
GRANT ALL ON public.fb_odds TO service_role;

-- Recreate the sync trigger
CREATE OR REPLACE FUNCTION public.sync_fb_odds_to_odds()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_fixture_uuid UUID;
  v_existing_odds_id UUID;
BEGIN
  -- Find the UUID of the corresponding fixture via api_id
  -- NEW.fixture_id is BIGINT (API ID from fb_fixtures.id)
  SELECT f.id INTO v_fixture_uuid
  FROM public.fixtures f
  WHERE f.api_id = NEW.fixture_id;

  -- If fixture not found, skip (it might be created later)
  IF v_fixture_uuid IS NULL THEN
    RAISE NOTICE 'sync_fb_odds_to_odds: No matching fixture found for api_id %', NEW.fixture_id;
    RETURN NEW;
  END IF;

  -- Check if odds already exist for this fixture and bookmaker
  SELECT id INTO v_existing_odds_id
  FROM public.odds
  WHERE fixture_id = v_fixture_uuid
    AND bookmaker_name = NEW.bookmaker_name;

  IF v_existing_odds_id IS NOT NULL THEN
    -- Update existing odds
    UPDATE public.odds
    SET
      home_win = NEW.home_win::REAL,
      draw = NEW.draw::REAL,
      away_win = NEW.away_win::REAL,
      updated_at = NEW.updated_at
    WHERE id = v_existing_odds_id;

    RAISE NOTICE 'sync_fb_odds_to_odds: Updated odds for fixture % bookmaker %', v_fixture_uuid, NEW.bookmaker_name;
  ELSE
    -- Insert new odds
    INSERT INTO public.odds (
      id,
      fixture_id,
      bookmaker_name,
      home_win,
      draw,
      away_win,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_fixture_uuid,
      NEW.bookmaker_name,
      NEW.home_win::REAL,
      NEW.draw::REAL,
      NEW.away_win::REAL,
      NEW.updated_at
    );

    RAISE NOTICE 'sync_fb_odds_to_odds: Inserted odds for fixture % bookmaker %', v_fixture_uuid, NEW.bookmaker_name;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_sync_fb_odds_to_odds ON public.fb_odds;

CREATE TRIGGER trigger_sync_fb_odds_to_odds
  AFTER INSERT OR UPDATE ON public.fb_odds
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_fb_odds_to_odds();

-- Verify the new structure
SELECT '=== New fb_odds structure ===' as step;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'fb_odds'
ORDER BY ordinal_position;

SELECT '=== Constraints ===' as step;
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.fb_odds'::regclass;

SELECT '=== Policies ===' as step;
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'fb_odds';
