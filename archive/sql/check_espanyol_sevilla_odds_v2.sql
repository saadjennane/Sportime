-- Vérification des cotes pour Espanyol vs Séville
-- Date: 2025-11-24 (Version 2 - Corrigée)

-- 1. Trouver le match Espanyol vs Séville aujourd'hui dans fixtures (production)
SELECT '1. Match Espanyol vs Séville dans fixtures (production)' as check_name;
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

-- 2. Vérifier si ce match existe dans fb_fixtures (staging) par api_id
SELECT '2. Match dans fb_fixtures (staging)' as check_name;
SELECT
  ff.id,
  ff.api_id,
  ff.date,
  ff.status
FROM public.fb_fixtures ff
WHERE ff.date::date = CURRENT_DATE
ORDER BY ff.date;

-- 3. Compter les odds dans fb_odds pour aujourd'hui
SELECT '3. Nombre d''odds dans fb_odds pour aujourd''hui' as check_name;
SELECT
  COUNT(DISTINCT fbo.fixture_id) as fixtures_with_odds,
  COUNT(*) as total_odds,
  COUNT(DISTINCT fbo.bookmaker_name) as bookmaker_count
FROM public.fb_odds fbo
JOIN public.fb_fixtures ff ON fbo.fixture_id = ff.id
WHERE ff.date::date = CURRENT_DATE;

-- 4. Lister les bookmakers disponibles pour aujourd'hui
SELECT '4. Bookmakers disponibles pour aujourd''hui' as check_name;
SELECT
  fbo.bookmaker_name,
  COUNT(*) as odds_count
FROM public.fb_odds fbo
JOIN public.fb_fixtures ff ON fbo.fixture_id = ff.id
WHERE ff.date::date = CURRENT_DATE
GROUP BY fbo.bookmaker_name
ORDER BY odds_count DESC;

-- 5. Vérifier les odds dans odds (production) pour aujourd'hui
SELECT '5. Odds dans odds (production) pour aujourd''hui' as check_name;
SELECT
  COUNT(*) as total_odds,
  COUNT(DISTINCT o.fixture_id) as fixtures_with_odds,
  o.bookmaker_name
FROM public.odds o
JOIN public.fixtures f ON o.fixture_id = f.id
WHERE f.date::date = CURRENT_DATE
GROUP BY o.bookmaker_name;

-- 6. Tous les matchs d'aujourd'hui avec leurs odds
SELECT '6. Tous les matchs d''aujourd''hui avec comptage odds' as check_name;
SELECT
  f.api_id,
  ht.name as home_team,
  at.name as away_team,
  f.date,
  f.status,
  COUNT(o.id) as odds_count
FROM public.fixtures f
JOIN public.teams ht ON f.home_team_id = ht.id
JOIN public.teams at ON f.away_team_id = at.id
LEFT JOIN public.odds o ON o.fixture_id = f.id
WHERE f.date::date = CURRENT_DATE
GROUP BY f.id, f.api_id, ht.name, at.name, f.date, f.status
ORDER BY f.date;

-- 7. Vérifier le bookmaker configuré
SELECT '7. Bookmaker préféré configuré' as check_name;
SELECT * FROM public.app_config WHERE key = 'preferred_bookmaker';

-- 8. Vérifier si le trigger est actif
SELECT '8. Trigger de synchronisation' as check_name;
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'fb_odds'
  AND trigger_schema = 'public'
ORDER BY trigger_name;
