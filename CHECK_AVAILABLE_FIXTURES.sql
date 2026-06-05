-- ============================================================================
-- VÉRIFIER LES FIXTURES DISPONIBLES PAR LIGUE
-- ============================================================================
-- Ce script te montre les fixtures disponibles pour chaque ligue

-- 1. Compter les fixtures par ligue
SELECT
  l.id as league_id,
  l.name as league_name,
  COUNT(f.id) as total_fixtures,
  MIN(f.date) as first_match_date,
  MAX(f.date) as last_match_date
FROM public.fb_leagues l
LEFT JOIN public.fb_fixtures f ON f.league_id = l.id
GROUP BY l.id, l.name
HAVING COUNT(f.id) > 0
ORDER BY COUNT(f.id) DESC;

-- 2. Voir les 20 prochains fixtures disponibles
SELECT
  l.name as league_name,
  f.date as fixture_date,
  f.home_team_id,
  f.away_team_id,
  f.status
FROM public.fb_fixtures f
JOIN public.fb_leagues l ON l.id = f.league_id
WHERE f.date >= CURRENT_DATE
ORDER BY f.date ASC
LIMIT 20;

-- 3. Compter les fixtures par date pour une ligue spécifique
-- Remplace 'LEAGUE_ID' par l'ID de ta ligue
-- SELECT
--   DATE(date) as match_date,
--   COUNT(*) as fixtures_count
-- FROM public.fb_fixtures
-- WHERE league_id = 'LEAGUE_ID'
-- AND date >= CURRENT_DATE
-- GROUP BY DATE(date)
-- ORDER BY match_date ASC
-- LIMIT 30;
