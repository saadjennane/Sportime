-- Script de test pour la synchronisation des cotes

-- ============================================
-- 1. ÉTAT AVANT LA MIGRATION
-- ============================================

-- Compter les odds dans chaque table
SELECT 'fb_odds (staging)' as table_name, COUNT(*) as count FROM public.fb_odds
UNION ALL
SELECT 'odds (production)' as table_name, COUNT(*) as count FROM public.odds;

-- Voir quelques exemples de fb_odds
SELECT
  fbo.id,
  fbo.fixture_id as fb_fixture_id,
  ff.api_id as api_fixture_id,
  fbo.bookmaker_name,
  fbo.home_win,
  fbo.draw,
  fbo.away_win,
  fbo.updated_at
FROM public.fb_odds fbo
JOIN public.fb_fixtures ff ON fbo.fixture_id = ff.id
ORDER BY fbo.updated_at DESC
LIMIT 5;

-- ============================================
-- 2. APPLIQUER LA MIGRATION
-- ============================================

-- Copiez et exécutez le contenu de:
-- /Users/sj/Desktop/Sportime/supabase/migrations/20251124100000_sync_odds_staging_to_production.sql

-- ============================================
-- 3. VÉRIFIER APRÈS LA MIGRATION
-- ============================================

-- Compter à nouveau
SELECT 'fb_odds (staging)' as table_name, COUNT(*) as count FROM public.fb_odds
UNION ALL
SELECT 'odds (production)' as table_name, COUNT(*) as count FROM public.odds;

-- Vérifier que les odds sont bien mappées avec les UUIDs
SELECT
  o.id as odds_id,
  o.fixture_id as fixture_uuid,
  f.api_id as api_fixture_id,
  o.bookmaker_name,
  o.home_win,
  o.draw,
  o.away_win,
  o.updated_at
FROM public.odds o
JOIN public.fixtures f ON o.fixture_id = f.id
ORDER BY o.updated_at DESC
LIMIT 10;

-- Vérifier qu'une fixture spécifique a des odds
-- Remplacez 'FIXTURE_API_ID' par un vrai ID de l'API-Football
SELECT
  f.id as fixture_uuid,
  f.api_id,
  f.date,
  o.bookmaker_name,
  o.home_win,
  o.draw,
  o.away_win
FROM public.fixtures f
LEFT JOIN public.odds o ON o.fixture_id = f.id
WHERE f.api_id = 'FIXTURE_API_ID'  -- À remplacer
ORDER BY o.bookmaker_name;

-- ============================================
-- 4. TESTER LE TRIGGER EN TEMPS RÉEL
-- ============================================

-- Récupérer un fixture_id de fb_odds pour test
SELECT
  fbo.id as fb_odds_id,
  fbo.fixture_id as fb_fixture_id,
  ff.api_id as api_fixture_id,
  fbo.bookmaker_name,
  fbo.home_win
FROM public.fb_odds fbo
JOIN public.fb_fixtures ff ON fbo.fixture_id = ff.id
LIMIT 1;

-- Mettre à jour une odd dans fb_odds (changez les valeurs selon votre test)
-- UPDATE public.fb_odds
-- SET home_win = 2.5, draw = 3.0, away_win = 2.8
-- WHERE id = 'VOTRE_FB_ODDS_ID';

-- Vérifier que la mise à jour s'est propagée dans odds
-- SELECT
--   o.home_win,
--   o.draw,
--   o.away_win,
--   o.updated_at
-- FROM public.odds o
-- JOIN public.fixtures f ON o.fixture_id = f.id
-- WHERE f.api_id = 'API_FIXTURE_ID'
--   AND o.bookmaker_name = 'BOOKMAKER_NAME';

-- ============================================
-- 5. TESTER LA FONCTION fetchMultipleFixtureOdds
-- ============================================

-- Récupérer les UUIDs de fixtures qui ont des odds
SELECT
  f.id as fixture_uuid,
  f.api_id,
  COUNT(o.id) as odds_count
FROM public.fixtures f
LEFT JOIN public.odds o ON o.fixture_id = f.id
WHERE o.id IS NOT NULL
GROUP BY f.id, f.api_id
LIMIT 5;

-- Pour l'une de ces fixtures, vérifier toutes les odds disponibles
SELECT
  o.fixture_id,
  o.bookmaker_name,
  o.home_win,
  o.draw,
  o.away_win,
  o.updated_at
FROM public.odds o
WHERE o.fixture_id = 'FIXTURE_UUID_FROM_ABOVE'  -- À remplacer
ORDER BY o.bookmaker_name;

-- ============================================
-- 6. VÉRIFIER LES LOGS DU TRIGGER
-- ============================================

-- Si vous avez accès aux logs PostgreSQL, cherchez:
-- "sync_fb_odds_to_odds: Inserted odds for fixture"
-- "sync_fb_odds_to_odds: Updated odds for fixture"

-- ============================================
-- 7. FORCER UNE RE-SYNCHRONISATION (SI BESOIN)
-- ============================================

-- ATTENTION: Ceci supprime et recrée toutes les odds
-- SELECT * FROM public.force_resync_odds();

-- Vérifier après resync
-- SELECT COUNT(*) FROM public.odds;
