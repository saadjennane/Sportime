-- Vérifier l'état de pg_net et les requêtes HTTP

-- ============================================
-- 1. VÉRIFIER LES REQUÊTES HTTP RÉCENTES
-- ============================================

-- Voir toutes les colonnes disponibles
SELECT *
FROM net.http_request_queue
ORDER BY id DESC
LIMIT 10;

-- ============================================
-- 2. VÉRIFIER SI pg_net._http_response EXISTE
-- ============================================

-- Historique des réponses HTTP (si la table existe)
SELECT *
FROM net._http_response
ORDER BY id DESC
LIMIT 10;

-- ============================================
-- 3. APPELER DIRECTEMENT L'EDGE FUNCTION VIA pg_net
-- ============================================

-- Créer une requête HTTP manuelle
SELECT net.http_post(
  url := 'https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/sync-fixture-schedules',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyeXB1emR1cGxiemJtdmVmdnpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MjA1NjgsImV4cCI6MjA3NTM5NjU2OH0.jsUTKfIjsLF2wlbBPeJDlFPj2ICozE6VaqYA7egKrsQ'
  ),
  body := jsonb_build_object(
    'days_ahead', 14,
    'update_mode', 'manual_test'
  )
) as request_id;

-- ATTENDRE 5 SECONDES

-- ============================================
-- 4. VÉRIFIER LE RÉSULTAT APRÈS 5 SECONDES
-- ============================================

-- La date devrait être corrigée
SELECT
  api_id,
  date,
  status,
  updated_at
FROM fb_fixtures
WHERE api_id = 1390943;

-- Vérifier les logs
SELECT *
FROM fixture_sync_log
ORDER BY created_at DESC
LIMIT 3;
