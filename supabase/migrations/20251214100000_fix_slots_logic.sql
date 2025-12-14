-- FIX: Update get_user_live_game_limits to only count 'live' games
-- Problem: Function was counting 'upcoming' games which blocked users from creating new games
-- Solution: Only count games with status = 'live'

-- 1. Drop existing function first (signature is different)
DROP FUNCTION IF EXISTS get_user_live_game_limits(UUID);

-- 2. Recreate the function
CREATE OR REPLACE FUNCTION get_user_live_game_limits(p_user_id UUID)
RETURNS TABLE (
  slots_used INTEGER,
  slots_max INTEGER,
  entry_max INTEGER,
  level_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Only count games that are actually LIVE (not upcoming)
    (SELECT COUNT(*)::INTEGER FROM live_game_entries lge
     JOIN live_games lg ON lge.live_game_id = lg.id
     WHERE lge.user_id = p_user_id AND lg.status = 'live') as slots_used,
    5 as slots_max,
    10000 as entry_max,
    'default'::TEXT as level_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Clean up zombie games (upcoming/live games where fixture is finished)
UPDATE live_games lg
SET status = 'finished'
FROM fb_fixtures f
WHERE lg.fixture_id = f.id
  AND lg.status IN ('upcoming', 'live')
  AND f.status IN ('FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO');

-- 3. Create a trigger to auto-update game status when fixture finishes
CREATE OR REPLACE FUNCTION sync_live_game_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When fixture status changes to finished, update all associated live_games
  IF NEW.status IN ('FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO')
     AND OLD.status NOT IN ('FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO') THEN
    UPDATE live_games
    SET status = 'finished'
    WHERE fixture_id = NEW.id
      AND status IN ('upcoming', 'live');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS sync_live_game_status_trigger ON fb_fixtures;

CREATE TRIGGER sync_live_game_status_trigger
  AFTER UPDATE OF status ON fb_fixtures
  FOR EACH ROW
  EXECUTE FUNCTION sync_live_game_status();

COMMENT ON FUNCTION get_user_live_game_limits IS 'Returns user slot limits - only counts LIVE games (not upcoming)';
COMMENT ON FUNCTION sync_live_game_status IS 'Auto-updates live_games status when fixture finishes';
