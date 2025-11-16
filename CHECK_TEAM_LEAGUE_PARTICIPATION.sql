-- ============================================================================
-- CHECK TEAM_LEAGUE_PARTICIPATION DATA
-- ============================================================================

-- Check if there are any records in team_league_participation
SELECT COUNT(*) as total_records
FROM team_league_participation;

-- Check records for each league
SELECT
  l.name as league_name,
  l.id as league_id,
  COUNT(tlp.id) as team_count
FROM leagues l
LEFT JOIN team_league_participation tlp ON tlp.league_id = l.id
GROUP BY l.id, l.name
ORDER BY l.name;

-- Check if teams were actually inserted
SELECT COUNT(*) as total_teams
FROM teams;

-- Sample of team_league_participation records
SELECT
  tlp.id,
  tlp.league_id,
  tlp.team_id,
  t.name as team_name,
  l.name as league_name
FROM team_league_participation tlp
LEFT JOIN teams t ON t.id = tlp.team_id
LEFT JOIN leagues l ON l.id = tlp.league_id
LIMIT 10;
