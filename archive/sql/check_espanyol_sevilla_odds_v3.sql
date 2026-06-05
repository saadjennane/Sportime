-- Vérification des cotes pour Espanyol vs Séville
-- Date: 2025-11-24 (Version 3 - Structure correcte)

-- 1. Trouver le match Espanyol vs Séville aujourd'hui dans fixtures (production)
SELECT '=== 1. Match Espanyol vs Séville dans fixtures (production) ===' as step;
SELECT
  f.id,
  f.api_id,
  f.date,
  f.status,
  ht.name as home_team,
  at.name as away_team
FROM public.fixtures f
JOIN public.teams ht ON f.home_team_id = ht.id
JOIN public.teams at ON f.away_team_id = at.id
WHERE
  (ht.name ILIKE '%espanyol%' OR at.name ILIKE '%espanyol%')
  AND (ht.name ILIKE '%sevilla%' OR at.name ILIKE '%sevilla%' OR ht.name ILIKE '%seville%' OR at.name ILIKE '%seville%')
  AND f.date::date = CURRENT_DATE
ORDER BY f.date;

-- 2. Si le match existe, récupérer son api_id pour chercher dans fb_fixtures
SELECT '=== 2. Recherche dans fb_fixtures par api_id ===' as step;
WITH espanyol_sevilla AS (
  SELECT f.api_id
  FROM public.fixtures f
  JOIN public.teams ht ON f.home_team_id = ht.id
  JOIN public.teams at ON f.away_team_id = at.id
  WHERE
    (ht.name ILIKE '%espanyol%' OR at.name ILIKE '%espanyol%')
    AND (ht.name ILIKE '%sevilla%' OR at.name ILIKE '%sevilla%' OR ht.name ILIKE '%seville%' OR at.name ILIKE '%seville%')
    AND f.date::date = CURRENT_DATE
  LIMIT 1
)
SELECT
  ff.id as fb_fixture_id,
  ff.api_id,
  ff.date,
  ff.status,
  ht.name as home_team,
  at.name as away_team
FROM public.fb_fixtures ff
JOIN public.teams ht ON ff.home_team_id = ht.id
JOIN public.teams at ON ff.away_team_id = at.id
WHERE ff.api_id IN (SELECT api_id FROM espanyol_sevilla);

-- 3. Vérifier les odds dans fb_odds (staging) pour ce match
SELECT '=== 3. Odds dans fb_odds (staging) pour Espanyol-Séville ===' as step;
WITH espanyol_sevilla AS (
  SELECT ff.id as fb_fixture_id
  FROM public.fixtures f
  JOIN public.fb_fixtures ff ON ff.api_id = f.api_id
  JOIN public.teams ht ON f.home_team_id = ht.id
  JOIN public.teams at ON f.away_team_id = at.id
  WHERE
    (ht.name ILIKE '%espanyol%' OR at.name ILIKE '%espanyol%')
    AND (ht.name ILIKE '%sevilla%' OR at.name ILIKE '%sevilla%' OR ht.name ILIKE '%seville%' OR at.name ILIKE '%seville%')
    AND f.date::date = CURRENT_DATE
  LIMIT 1
)
SELECT
  fbo.id,
  fbo.fixture_id,
  fbo.bookmaker_name,
  fbo.home_win,
  fbo.draw,
  fbo.away_win,
  fbo.updated_at
FROM public.fb_odds fbo
WHERE fbo.fixture_id IN (SELECT fb_fixture_id FROM espanyol_sevilla)
ORDER BY fbo.bookmaker_name;

-- 4. Vérifier les odds dans odds (production) pour ce match
SELECT '=== 4. Odds dans odds (production) pour Espanyol-Séville ===' as step;
WITH espanyol_sevilla AS (
  SELECT f.id as fixture_id
  FROM public.fixtures f
  JOIN public.teams ht ON f.home_team_id = ht.id
  JOIN public.teams at ON f.away_team_id = at.id
  WHERE
    (ht.name ILIKE '%espanyol%' OR at.name ILIKE '%espanyol%')
    AND (ht.name ILIKE '%sevilla%' OR at.name ILIKE '%sevilla%' OR ht.name ILIKE '%seville%' OR at.name ILIKE '%seville%')
    AND f.date::date = CURRENT_DATE
  LIMIT 1
)
SELECT
  o.id,
  o.fixture_id,
  o.bookmaker_name,
  o.home_win,
  o.draw,
  o.away_win,
  o.updated_at
FROM public.odds o
WHERE o.fixture_id IN (SELECT fixture_id FROM espanyol_sevilla)
ORDER BY o.bookmaker_name;

-- 5. Statistiques générales sur les odds d'aujourd'hui
SELECT '=== 5. Statistiques odds aujourd''hui ===' as step;
SELECT
  'fb_odds (staging)' as table_name,
  COUNT(*) as total_odds,
  COUNT(DISTINCT fbo.fixture_id) as fixtures_with_odds,
  COUNT(DISTINCT fbo.bookmaker_name) as bookmaker_count
FROM public.fb_odds fbo
JOIN public.fb_fixtures ff ON fbo.fixture_id = ff.id
WHERE ff.date::date = CURRENT_DATE

UNION ALL

SELECT
  'odds (production)' as table_name,
  COUNT(*) as total_odds,
  COUNT(DISTINCT o.fixture_id) as fixtures_with_odds,
  COUNT(DISTINCT o.bookmaker_name) as bookmaker_count
FROM public.odds o
JOIN public.fixtures f ON o.fixture_id = f.id
WHERE f.date::date = CURRENT_DATE;

-- 6. Bookmakers disponibles dans fb_odds aujourd'hui
SELECT '=== 6. Bookmakers dans fb_odds aujourd''hui ===' as step;
SELECT
  fbo.bookmaker_name,
  COUNT(*) as odds_count
FROM public.fb_odds fbo
JOIN public.fb_fixtures ff ON fbo.fixture_id = ff.id
WHERE ff.date::date = CURRENT_DATE
GROUP BY fbo.bookmaker_name
ORDER BY odds_count DESC;

-- 7. Bookmaker configuré
SELECT '=== 7. Bookmaker préféré configuré ===' as step;
SELECT key, value, description FROM public.app_config WHERE key = 'preferred_bookmaker';

-- 8. Tous les matchs d'aujourd'hui avec comptage d'odds
SELECT '=== 8. Tous les matchs aujourd''hui avec odds ===' as step;
SELECT
  f.api_id,
  ht.name as home_team,
  at.name as away_team,
  f.date,
  f.status,
  COUNT(o.id) as odds_count_production
FROM public.fixtures f
JOIN public.teams ht ON f.home_team_id = ht.id
JOIN public.teams at ON f.away_team_id = at.id
LEFT JOIN public.odds o ON o.fixture_id = f.id
WHERE f.date::date = CURRENT_DATE
GROUP BY f.id, f.api_id, ht.name, at.name, f.date, f.status
ORDER BY f.date;

-- 9. Vérifier si le trigger est actif
SELECT '=== 9. Trigger de synchronisation ===' as step;
SELECT
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'fb_odds'
  AND trigger_schema = 'public'
ORDER BY trigger_name;
