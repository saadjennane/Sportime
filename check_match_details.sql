-- Get full details of one finished match from yesterday
SELECT
  f.id,
  f.api_id,
  f.date,
  f.status,
  f.goals_home,
  f.goals_away,
  f.home_team_id,
  f.away_team_id,
  ht.id as home_team_db_id,
  ht.name as home_team_name,
  ht.logo_url as home_team_logo,
  at.id as away_team_db_id,
  at.name as away_team_name,
  at.logo_url as away_team_logo,
  f.league_id,
  l.id as league_db_id,
  l.name as league_name,
  l.logo as league_logo
FROM fb_fixtures f
JOIN fb_teams ht ON ht.id = f.home_team_id
JOIN fb_teams at ON at.id = f.away_team_id
JOIN fb_leagues l ON l.id = f.league_id
WHERE DATE(f.date) = '2025-11-23'
  AND f.status = 'FT'
ORDER BY f.date DESC
LIMIT 1;
