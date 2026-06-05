-- Vérifier l'état des cotes
-- 1. Combien de cotes au total
SELECT COUNT(*) as total_odds FROM fb_odds;

-- 2. Cotes pour les matchs d'aujourd'hui
SELECT
  f.id as fixture_id,
  f.date,
  f.status,
  o.id as odds_id,
  o.home_win,
  o.draw,
  o.away_win,
  o.bookmaker_name
FROM fb_fixtures f
LEFT JOIN fb_odds o ON o.fixture_id = f.id
WHERE f.date >= NOW() - INTERVAL '1 day'
  AND f.date <= NOW() + INTERVAL '1 day'
ORDER BY f.date;

-- 3. Statistiques odds
SELECT
  COUNT(DISTINCT fixture_id) as fixtures_with_odds,
  COUNT(*) as total_odds_records,
  COUNT(DISTINCT bookmaker_name) as unique_bookmakers
FROM fb_odds;
