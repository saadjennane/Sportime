-- Script de test pour la synchronisation des fixtures
-- Exécutez ce script dans l'éditeur SQL de Supabase

-- 1. Vérifier que les extensions sont installées
SELECT extname, extversion
FROM pg_extension
WHERE extname IN ('pg_cron', 'pg_net');

-- 2. Vérifier que la fonction existe
SELECT proname, pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'trigger_fixture_sync';

-- 3. Vérifier les jobs cron planifiés
SELECT jobid, jobname, schedule, command, active
FROM cron.job;

-- 4. Tester la fonction manuellement
-- IMPORTANT: Avant d'exécuter ceci, assurez-vous que l'Edge Function
-- 'sync-fixture-schedules' est déployée sur Supabase !
SELECT public.trigger_fixture_sync(14, 'manual');

-- 5. Vérifier que la requête a été créée dans pg_net
SELECT id, url, status, created
FROM net.http_request_queue
ORDER BY created DESC
LIMIT 5;

-- 6. Après quelques secondes, vérifier les logs de sync
SELECT *
FROM public.fixture_sync_log
ORDER BY created_at DESC
LIMIT 5;

-- 7. Voir le résumé des syncs
SELECT *
FROM public.fixture_sync_summary
ORDER BY sync_date DESC;

-- 8. Voir les changements récents de calendrier
SELECT *
FROM public.get_recent_fixture_changes(7);
