-- ============================================================================
-- FORCE UN MATCH À ÊTRE LIVE (POUR TESTER LE SYSTÈME)
-- ============================================================================

-- Sélectionner le premier match et le mettre "en cours"
UPDATE fb_fixtures
SET
  date = NOW() - INTERVAL '30 minutes',  -- Match commencé il y a 30 min
  status = '1H',                          -- Première mi-temps
  goals_home = 1,                         -- Score test
  goals_away = 0
WHERE id = (
  SELECT id FROM fb_fixtures
  WHERE date >= NOW() - INTERVAL '1 day'
    AND date <= NOW() + INTERVAL '1 day'
  ORDER BY date
  LIMIT 1
)
RETURNING id, date, status, goals_home, goals_away;

-- ============================================================================
-- POUR REVENIR EN ARRIÈRE (ANNULER LE TEST)
-- ============================================================================
-- UPDATE fb_fixtures
-- SET
--   date = '2025-11-23 13:00:00+00',
--   status = 'NS',
--   goals_home = NULL,
--   goals_away = NULL
-- WHERE id = '<id du match>';
