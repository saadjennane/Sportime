-- Vérifier les dates des matchs d'aujourd'hui
SELECT
  id,
  date,
  status,
  goals_home,
  goals_away,
  home_team_id,
  away_team_id,
  -- Calculer si le match devrait avoir commencé
  CASE
    WHEN date <= NOW() THEN 'Should have started'
    ELSE 'Not started yet'
  END as match_timing,
  -- Temps depuis/jusqu'au coup d'envoi
  EXTRACT(EPOCH FROM (NOW() - date)) / 60 as minutes_since_kickoff
FROM fb_fixtures
WHERE date >= NOW() - INTERVAL '1 day'
  AND date <= NOW() + INTERVAL '1 day'
ORDER BY date;
