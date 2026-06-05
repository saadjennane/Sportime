-- Check if the finished matches have valid teams
SELECT
  f.id,
  f.api_id,
  f.date,
  f.status,
  f.home_team_id,
  f.away_team_id,
  ht.name as home_team_name,
  at.name as away_team_name,
  f.league_id,
  l.name as league_name
FROM fb_fixtures f
LEFT JOIN fb_teams ht ON ht.id = f.home_team_id
LEFT JOIN fb_teams at ON at.id = f.away_team_id
LEFT JOIN fb_leagues l ON l.id = f.league_id
WHERE DATE(f.date) = '2025-11-23'
  AND f.status = 'FT'
ORDER BY f.date DESC;

-- Check if teams exist for these team_ids
SELECT
  'Home teams' as team_type,
  COUNT(DISTINCT f.home_team_id) as unique_team_ids,
  COUNT(DISTINCT ht.id) as teams_found
FROM fb_fixtures f
LEFT JOIN fb_teams ht ON ht.id = f.home_team_id
WHERE DATE(f.date) = '2025-11-23' AND f.status = 'FT';

SELECT
  'Away teams' as team_type,
  COUNT(DISTINCT f.away_team_id) as unique_team_ids,
  COUNT(DISTINCT at.id) as teams_found
FROM fb_fixtures f
LEFT JOIN fb_teams at ON at.id = f.away_team_id
WHERE DATE(f.date) = '2025-11-23' AND f.status = 'FT';
