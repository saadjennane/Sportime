-- ============================================
-- VÉRIFICATION DU SYSTÈME BOOKMAKER
-- ============================================

-- 1. Vérifier la table app_config
SELECT '1. Configuration du bookmaker préféré' as check_name;
SELECT * FROM public.app_config WHERE key = 'preferred_bookmaker';

-- 2. Vérifier les bookmakers disponibles
SELECT '2. Bookmakers disponibles' as check_name;
SELECT * FROM public.get_available_bookmakers();

-- 3. Vérifier les odds synchronisées
SELECT '3. Nombre d''odds par bookmaker' as check_name;
SELECT
  bookmaker_name,
  COUNT(*) as total_odds,
  MIN(updated_at) as oldest_update,
  MAX(updated_at) as newest_update
FROM public.odds
GROUP BY bookmaker_name
ORDER BY total_odds DESC;

-- 4. Vérifier quelques exemples d'odds
SELECT '4. Exemples d''odds synchronisées' as check_name;
SELECT
  o.id,
  f.api_id as fixture_api_id,
  o.bookmaker_name,
  o.home_win,
  o.draw,
  o.away_win,
  o.updated_at
FROM public.odds o
JOIN public.fixtures f ON o.fixture_id = f.id
ORDER BY o.updated_at DESC
LIMIT 10;

-- 5. Vérifier que le trigger fonctionne
SELECT '5. Vérifier la fonction trigger' as check_name;
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (routine_name LIKE '%bookmaker%' OR routine_name LIKE '%sync_fb_odds%')
ORDER BY routine_name;

-- 6. Vérifier la contrainte unique
SELECT '6. Contrainte unique sur odds' as check_name;
SELECT
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.odds'::regclass
  AND conname = 'unique_fixture_bookmaker';
