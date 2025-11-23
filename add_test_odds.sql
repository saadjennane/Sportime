-- ============================================================================
-- AJOUTER DES COTES DE TEST POUR LES MATCHS D'AUJOURD'HUI
-- ============================================================================

-- Insérer des cotes de test pour les 5 matchs
INSERT INTO fb_odds (fixture_id, bookmaker_name, home_win, draw, away_win)
SELECT
  id as fixture_id,
  'Bet365' as bookmaker_name,
  -- Cotes aléatoires réalistes
  CASE
    WHEN RANDOM() < 0.5 THEN 2.10
    ELSE 3.50
  END as home_win,
  3.20 as draw,
  CASE
    WHEN RANDOM() < 0.5 THEN 3.80
    ELSE 2.50
  END as away_win
FROM fb_fixtures
WHERE date >= NOW() - INTERVAL '1 day'
  AND date <= NOW() + INTERVAL '1 day'
ON CONFLICT (fixture_id, bookmaker_name) DO UPDATE
SET
  home_win = EXCLUDED.home_win,
  draw = EXCLUDED.draw,
  away_win = EXCLUDED.away_win;

-- Vérifier les cotes insérées
SELECT
  f.id as fixture_id,
  f.date,
  f.status,
  o.bookmaker_name,
  o.home_win,
  o.draw,
  o.away_win
FROM fb_fixtures f
LEFT JOIN fb_odds o ON o.fixture_id = f.id
WHERE f.date >= NOW() - INTERVAL '1 day'
  AND f.date <= NOW() + INTERVAL '1 day'
ORDER BY f.date;
