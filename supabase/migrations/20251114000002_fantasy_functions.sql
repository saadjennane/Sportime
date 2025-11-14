/*
  Fantasy Game PostgreSQL Functions

  Core functions for Fantasy game logic:
  1. check_team_composition - Validates team formation (1 GK, 2-3 DEF, 2-3 MID, 1-2 ATT)
  2. calculate_fantasy_leaderboard - Generates ranked leaderboard for a game week
  3. get_available_fantasy_players - Returns players with fatigue > 0
  4. update_player_fatigue - Applies fatigue decay after game week
*/

-- ============================================================================
-- FUNCTION: check_team_composition
-- Validates Fantasy team composition rules
-- ============================================================================

CREATE OR REPLACE FUNCTION check_team_composition(
  p_starters UUID[]
)
RETURNS BOOLEAN AS $$
DECLARE
  v_gk INTEGER;
  v_def INTEGER;
  v_mid INTEGER;
  v_att INTEGER;
BEGIN
  -- Validate array length
  IF array_length(p_starters, 1) != 7 THEN
    RETURN false;
  END IF;

  -- Count players by position
  SELECT
    COUNT(*) FILTER (WHERE position = 'Goalkeeper'),
    COUNT(*) FILTER (WHERE position = 'Defender'),
    COUNT(*) FILTER (WHERE position = 'Midfielder'),
    COUNT(*) FILTER (WHERE position = 'Attacker')
  INTO v_gk, v_def, v_mid, v_att
  FROM fantasy_players
  WHERE id = ANY(p_starters);

  -- Validate composition: 1 GK, 2-3 DEF, 2-3 MID, 1-2 ATT
  IF v_gk != 1 THEN
    RAISE NOTICE 'Invalid GK count: %', v_gk;
    RETURN false;
  END IF;

  IF v_def < 2 OR v_def > 3 THEN
    RAISE NOTICE 'Invalid DEF count: %', v_def;
    RETURN false;
  END IF;

  IF v_mid < 2 OR v_mid > 3 THEN
    RAISE NOTICE 'Invalid MID count: %', v_mid;
    RETURN false;
  END IF;

  IF v_att < 1 OR v_att > 2 THEN
    RAISE NOTICE 'Invalid ATT count: %', v_att;
    RETURN false;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_team_composition(UUID[]) IS
  'Validates Fantasy team composition: 1 GK, 2-3 DEF, 2-3 MID, 1-2 ATT (total 7 players)';

-- ============================================================================
-- FUNCTION: calculate_fantasy_leaderboard
-- Generates ranked leaderboard for a game week
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_fantasy_leaderboard(
  p_game_id UUID,
  p_game_week_id UUID
)
RETURNS TABLE(
  user_id UUID,
  username TEXT,
  avatar TEXT,
  total_points DECIMAL,
  booster_used INTEGER,
  rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked_teams AS (
    SELECT
      uft.user_id,
      u.username,
      u.avatar_url as avatar,
      uft.total_points,
      uft.booster_used,
      RANK() OVER (ORDER BY uft.total_points DESC) as rank
    FROM user_fantasy_teams uft
    INNER JOIN users u ON u.id = uft.user_id
    WHERE uft.game_id = p_game_id
      AND uft.game_week_id = p_game_week_id
    ORDER BY rank
  )
  SELECT * FROM ranked_teams;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION calculate_fantasy_leaderboard(UUID, UUID) IS
  'Calculates Fantasy leaderboard with ranking for a game week. Uses RANK() to handle ties correctly';

-- ============================================================================
-- FUNCTION: get_available_fantasy_players
-- Returns players available for selection (fatigue > 0)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_available_fantasy_players(
  p_game_week_id UUID DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  api_player_id INTEGER,
  name TEXT,
  photo TEXT,
  position TEXT,
  status TEXT,
  fatigue INTEGER,
  team_name TEXT,
  team_logo TEXT,
  birthdate DATE,
  pgs DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fp.id,
    fp.api_player_id,
    fp.name,
    fp.photo,
    fp.position,
    fp.status,
    fp.fatigue,
    fp.team_name,
    fp.team_logo,
    fp.birthdate,
    fp.pgs
  FROM fantasy_players fp
  WHERE fp.fatigue > 0
  ORDER BY fp.pgs DESC, fp.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_available_fantasy_players(UUID) IS
  'Returns available Fantasy players filtered by fatigue > 0, ordered by PGS';

-- ============================================================================
-- FUNCTION: update_player_fatigue
-- Applies fatigue decay rules after a game week
-- ============================================================================

CREATE OR REPLACE FUNCTION update_player_fatigue(
  p_game_week_id UUID
)
RETURNS void AS $$
DECLARE
  v_team RECORD;
  v_player_id UUID;
BEGIN
  -- For each team in this game week
  FOR v_team IN
    SELECT user_id, starters, substitutes
    FROM user_fantasy_teams
    WHERE game_week_id = p_game_week_id
  LOOP
    -- Apply fatigue decay to starters based on status
    -- Star: -20%, Key: -10%, Wild: no change
    FOREACH v_player_id IN ARRAY v_team.starters
    LOOP
      UPDATE fantasy_players
      SET fatigue = CASE
        WHEN status = 'Star' THEN GREATEST(0, fatigue - 20)
        WHEN status = 'Key' THEN GREATEST(0, fatigue - 10)
        ELSE fatigue
      END,
      updated_at = NOW()
      WHERE id = v_player_id;
    END LOOP;

    -- Apply fatigue recovery to substitutes (+10%)
    FOREACH v_player_id IN ARRAY v_team.substitutes
    LOOP
      UPDATE fantasy_players
      SET fatigue = LEAST(100, fatigue + 10),
          updated_at = NOW()
      WHERE id = v_player_id;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Fatigue updated for game week %', p_game_week_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_player_fatigue(UUID) IS
  'Applies fatigue rules after game week: Star -20%, Key -10%, Rest +10%. Called after game week completion';

-- ============================================================================
-- FUNCTION: get_user_fantasy_team_with_players
-- Returns user team with full player details (for UI display)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_fantasy_team_with_players(
  p_user_id UUID,
  p_game_week_id UUID
)
RETURNS TABLE(
  team_id UUID,
  game_id UUID,
  starters JSONB,
  substitutes JSONB,
  captain JSONB,
  booster_used INTEGER,
  total_points DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    uft.id as team_id,
    uft.game_id,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', fp.id,
          'name', fp.name,
          'photo', fp.photo,
          'position', fp.position,
          'status', fp.status,
          'fatigue', fp.fatigue,
          'team_name', fp.team_name,
          'team_logo', fp.team_logo,
          'pgs', fp.pgs
        )
      )
      FROM fantasy_players fp
      WHERE fp.id = ANY(uft.starters)
    ) as starters,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', fp.id,
          'name', fp.name,
          'photo', fp.photo,
          'position', fp.position,
          'status', fp.status,
          'fatigue', fp.fatigue,
          'team_name', fp.team_name,
          'team_logo', fp.team_logo,
          'pgs', fp.pgs
        )
      )
      FROM fantasy_players fp
      WHERE fp.id = ANY(uft.substitutes)
    ) as substitutes,
    (
      SELECT jsonb_build_object(
        'id', fp.id,
        'name', fp.name,
        'photo', fp.photo,
        'position', fp.position,
        'status', fp.status
      )
      FROM fantasy_players fp
      WHERE fp.id = uft.captain_id
    ) as captain,
    uft.booster_used,
    uft.total_points
  FROM user_fantasy_teams uft
  WHERE uft.user_id = p_user_id
    AND uft.game_week_id = p_game_week_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_fantasy_team_with_players(UUID, UUID) IS
  'Returns user Fantasy team with full player details as JSON. Optimized for UI display';
