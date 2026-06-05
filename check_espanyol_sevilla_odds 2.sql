-- Vérification des cotes pour Espanyol vs Séville
-- Date: 2025-11-24

-- 1. Trouver le match Espanyol vs Séville aujourd'hui
SELECT '1. Recherche du match Espanyol vs Séville' as check_name;
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

-- 2. Vérifier si ce match existe dans fb_fixtures (staging)
SELECT '2. Match dans fb_fixtures (staging)' as check_name;
SELECT
  ff.id,
  ff.api_id,
  ff.date,
  ff.status,
  ff.home_team_name,
  ff.away_team_name
FROM public.fb_fixtures ff
WHERE
  (ff.home_team_name ILIKE '%espanyol%' OR ff.away_team_name ILIKE '%espanyol%')
  AND (ff.home_team_name ILIKE '%sevilla%' OR ff.away_team_name ILIKE '%sevilla%' OR ff.home_team_name ILIKE '%seville%' OR ff.away_team_name ILIKE '%seville%')
  AND ff.date::date = CURRENT_DATE
ORDER BY ff.date;

-- 3. Vérifier les odds dans fb_odds (staging)
SELECT '3. Odds dans fb_odds (staging)' as check_name;
SELECT
  fbo.id,
  fbo.fixture_id,
  fbo.bookmaker_name,
  fbo.home_win,
  fbo.draw,
  fbo.away_win,
  fbo.updated_at,
  ff.home_team_name,
  ff.away_team_name
FROM public.fb_odds fbo
JOIN public.fb_fixtures ff ON fbo.fixture_id = ff.id
WHERE
  (ff.home_team_name ILIKE '%espanyol%' OR ff.away_team_name ILIKE '%espanyol%')
  AND (ff.home_team_name ILIKE '%sevilla%' OR ff.away_team_name ILIKE '%sevilla%' OR ff.home_team_name ILIKE '%seville%' OR ff.away_team_name ILIKE '%seville%')
  AND ff.date::date = CURRENT_DATE
ORDER BY fbo.bookmaker_name;

-- 4. Vérifier les odds dans odds (production)
SELECT '4. Odds dans odds (production)' as check_name;
SELECT
  o.id,
  o.fixture_id,
  o.bookmaker_name,
  o.home_win,
  o.draw,
  o.away_win,
  o.updated_at,
  f.api_id,
  ht.name as home_team,
  at.name as away_team
FROM public.odds o
JOIN public.fixtures f ON o.fixture_id = f.id
JOIN public.teams ht ON f.home_team_id = ht.id
JOIN public.teams at ON f.away_team_id = at.id
WHERE
  (ht.name ILIKE '%espanyol%' OR at.name ILIKE '%espanyol%')
  AND (ht.name ILIKE '%sevilla%' OR at.name ILIKE '%sevilla%' OR ht.name ILIKE '%seville%' OR at.name ILIKE '%seville%')
  AND f.date::date = CURRENT_DATE
ORDER BY o.bookmaker_name;

-- 5. Vérifier tous les matchs d'aujourd'hui avec odds
SELECT '5. Tous les matchs d''aujourd''hui avec odds' as check_name;
SELECT
  f.api_id,
  ht.name as home_team,
  at.name as away_team,
  f.date,
  COUNT(o.id) as odds_count
FROM public.fixtures f
JOIN public.teams ht ON f.home_team_id = ht.id
JOIN public.teams at ON f.away_team_id = at.id
LEFT JOIN public.odds o ON o.fixture_id = f.id
WHERE f.date::date = CURRENT_DATE
GROUP BY f.id, f.api_id, ht.name, at.name, f.date
ORDER BY f.date;

-- 6. Vérifier le bookmaker configuré
SELECT '6. Bookmaker préféré configuré' as check_name;
SELECT * FROM public.app_config WHERE key = 'preferred_bookmaker';
