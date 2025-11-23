-- ============================================================================
-- VÉRIFIER TOUS LES FIXTURES (PASSÉS ET FUTURS)
-- ============================================================================

-- 1. Compter les fixtures par ligue (tous)
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
ORDER BY COUNT(f.id) DESC
LIMIT 10;

-- 2. Voir les 20 derniers fixtures (peu importe la date)
SELECT
  l.name as league_name,
  f.date as fixture_date,
  f.home_team_id,
  f.away_team_id,
  f.status,
  CASE
    WHEN f.date >= CURRENT_DATE THEN '🟢 FUTUR'
    ELSE '🔴 PASSÉ'
  END as timing
FROM public.fb_fixtures f
JOIN public.fb_leagues l ON l.id = f.league_id
ORDER BY f.date DESC
LIMIT 20;

-- 3. Statistiques globales
SELECT
  COUNT(*) as total_fixtures,
  COUNT(CASE WHEN date >= CURRENT_DATE THEN 1 END) as future_fixtures,
  COUNT(CASE WHEN date < CURRENT_DATE THEN 1 END) as past_fixtures,
  MIN(date) as oldest_fixture,
  MAX(date) as newest_fixture
FROM public.fb_fixtures;
