-- Migration: Auto-link fixtures to challenge matchdays
-- When a fixture is inserted or updated in fb_fixtures, automatically link it
-- to any matching challenge_matchdays (same date + same league)

-- Function: Auto-link fixture to matching challenge matchdays
CREATE OR REPLACE FUNCTION auto_link_fixture_to_matchdays()
RETURNS TRIGGER AS $$
BEGIN
  -- Find challenge_matchdays that:
  -- 1. Have the same date as the fixture
  -- 2. Belong to a challenge that uses this fixture's league
  INSERT INTO matchday_fixtures (matchday_id, fixture_id)
  SELECT DISTINCT
    cm.id,
    NEW.id
  FROM challenge_matchdays cm
  JOIN challenges c ON c.id = cm.challenge_id
  JOIN challenge_leagues cl ON cl.challenge_id = c.id
  WHERE
    -- Match date (fixture date to matchday date)
    cm.date = DATE(NEW.date AT TIME ZONE 'UTC')
    -- Match league
    AND cl.league_id = NEW.league_id
    -- Challenge is active (not finished)
    AND c.status IN ('upcoming', 'active')
    -- Avoid duplicates
    AND NOT EXISTS (
      SELECT 1 FROM matchday_fixtures mf
      WHERE mf.matchday_id = cm.id AND mf.fixture_id = NEW.id
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on INSERT and UPDATE
DROP TRIGGER IF EXISTS trg_auto_link_fixture_to_matchdays ON fb_fixtures;
CREATE TRIGGER trg_auto_link_fixture_to_matchdays
AFTER INSERT OR UPDATE ON fb_fixtures
FOR EACH ROW
EXECUTE FUNCTION auto_link_fixture_to_matchdays();

-- Backfill: Link existing fixtures to matchdays that are missing links
-- This fixes challenges like "Liga Betting Calendar TEST" where Dec 7 fixtures exist but aren't linked
INSERT INTO matchday_fixtures (matchday_id, fixture_id)
SELECT DISTINCT
  cm.id,
  f.id
FROM fb_fixtures f
JOIN challenge_matchdays cm ON cm.date = DATE(f.date AT TIME ZONE 'UTC')
JOIN challenges c ON c.id = cm.challenge_id
JOIN challenge_leagues cl ON cl.challenge_id = c.id AND cl.league_id = f.league_id
WHERE
  -- Challenge is active
  c.status IN ('upcoming', 'active')
  -- Not already linked
  AND NOT EXISTS (
    SELECT 1 FROM matchday_fixtures mf
    WHERE mf.matchday_id = cm.id AND mf.fixture_id = f.id
  );
