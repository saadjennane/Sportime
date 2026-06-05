-- Script de diagnostic complet du système de synchronisation

-- ============================================
-- 1. VÉRIFIER LA TABLE fixture_sync_log
-- ============================================

-- Est-ce que la table existe ?
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'fixture_sync_log'
) as table_exists;

-- Structure de la table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'fixture_sync_log'
ORDER BY ordinal_position;

-- Compter les lignes
SELECT COUNT(*) as total_logs FROM fixture_sync_log;

-- ============================================
-- 2. VÉRIFIER LA FONCTION get_recent_fixture_changes
-- ============================================

-- Est-ce que la fonction existe ?
SELECT EXISTS (
  SELECT FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
  AND p.proname = 'get_recent_fixture_changes'
) as function_exists;

-- ============================================
-- 3. VÉRIFIER LA FONCTION trigger_fixture_sync
-- ============================================

-- Est-ce que la fonction existe ?
SELECT EXISTS (
  SELECT FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
  AND p.proname = 'trigger_fixture_sync'
) as function_exists;

-- ============================================
-- 4. VÉRIFIER LES JOBS CRON
-- ============================================

SELECT
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job
WHERE command LIKE '%fixture%';

-- ============================================
-- 5. VÉRIFIER LES REQUÊTES HTTP (pg_net)
-- ============================================

-- Dernières requêtes HTTP
SELECT *
FROM net.http_request_queue
ORDER BY id DESC
LIMIT 10;

-- ============================================
-- 6. TESTER LA FONCTION trigger_fixture_sync
-- ============================================

-- Lancer une synchronisation manuelle
SELECT public.trigger_fixture_sync(14, 'manual');

-- Attendre 5 secondes, puis vérifier les requêtes HTTP
-- SELECT * FROM net.http_request_queue ORDER BY id DESC LIMIT 5;

-- ============================================
-- 7. VÉRIFIER LES EXTENSIONS
-- ============================================

SELECT
  extname,
  extversion
FROM pg_extension
WHERE extname IN ('pg_cron', 'pg_net', 'http');
