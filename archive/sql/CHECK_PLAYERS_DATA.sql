-- ============================================================================
-- CHECK PLAYERS DATA AND ASSOCIATIONS
-- ============================================================================

-- 1. Check total players and data completeness
SELECT
  COUNT(*) as total_players,
  COUNT(nationality) as players_with_nationality,
  COUNT(photo_url) as players_with_photo
FROM players;

-- 2. Check sample player data
SELECT id, name, first_name, last_name, nationality, photo_url, api_id
FROM players
LIMIT 5;

-- 3. Check player_team_association count
SELECT COUNT(*) as total_associations
FROM player_team_association;

-- 4. Check if associations link correctly
SELECT
  p.name,
  p.nationality,
  t.name as team_name,
  pta.season
FROM players p
LEFT JOIN player_team_association pta ON p.id = pta.player_id
LEFT JOIN teams t ON pta.team_id = t.id
LIMIT 10;

-- 5. Count players by team
SELECT
  t.name as team_name,
  COUNT(pta.player_id) as player_count
FROM teams t
LEFT JOIN player_team_association pta ON t.id = pta.team_id
GROUP BY t.id, t.name
ORDER BY player_count DESC
LIMIT 10;
