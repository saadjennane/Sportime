-- Test de détection de changements par l'Edge Function

-- ============================================
-- ÉTAPE 1 : Mettre une mauvaise date
-- ============================================

-- Sauvegarder la bonne date actuelle
SELECT
  api_id,
  date as current_correct_date,
  '2025-11-24T20:00:00+00:00'::timestamptz as api_date
FROM fb_fixtures
WHERE api_id = 1390943;

-- Mettre temporairement une mauvaise date (celle d'avant)
UPDATE fb_fixtures
SET date = '2025-11-23T22:21:02.261+00:00'::timestamptz
WHERE api_id = 1390943;

-- Vérifier que la mauvaise date est en place
SELECT
  api_id,
  date as wrong_date,
  status
FROM fb_fixtures
WHERE api_id = 1390943;

-- ============================================
-- ÉTAPE 2 : Déclencher la synchronisation
-- ============================================

-- Appeler trigger_fixture_sync
SELECT public.trigger_fixture_sync(14, 'test');

-- ATTENDRE 10-15 SECONDES pour que l'Edge Function s'exécute

-- ============================================
-- ÉTAPE 3 : Vérifier les résultats (après 15 sec)
-- ============================================

-- La date devrait être corrigée automatiquement
SELECT
  api_id,
  date as corrected_date,
  status,
  updated_at
FROM fb_fixtures
WHERE api_id = 1390943;

-- Un log devrait avoir été créé
SELECT
  id,
  sync_type,
  checked,
  updated,
  schedule_changes,
  created_at
FROM fixture_sync_log
ORDER BY created_at DESC
LIMIT 1;

-- Les changements détectés
SELECT * FROM public.get_recent_fixture_changes(7);
