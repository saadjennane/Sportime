-- Migration: Setup Fixture Sync Cron Jobs
-- Description: Configure automated fixture schedule synchronization
-- Author: Claude
-- Date: 2025-11-24

-- ============================================
-- 1. CRÉER LA TABLE DE LOG
-- ============================================

CREATE TABLE IF NOT EXISTS public.fixture_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL CHECK (sync_type IN ('upcoming', 'today', 'manual', 'scheduled')),
  checked INTEGER DEFAULT 0,
  updated INTEGER DEFAULT 0,
  schedule_changes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les recherches par date
CREATE INDEX IF NOT EXISTS idx_fixture_sync_log_created_at
  ON public.fixture_sync_log(created_at DESC);

-- Activer RLS
ALTER TABLE public.fixture_sync_log ENABLE ROW LEVEL SECURITY;

-- Politique: lecture publique
CREATE POLICY "Allow public read access to sync log"
  ON public.fixture_sync_log FOR SELECT
  USING (true);

-- Permissions
GRANT SELECT ON public.fixture_sync_log TO authenticated, anon;
GRANT ALL ON public.fixture_sync_log TO service_role;

-- Commentaire
COMMENT ON TABLE public.fixture_sync_log IS 'Logs des synchronisations de fixtures et des changements de calendrier';
COMMENT ON COLUMN public.fixture_sync_log.sync_type IS 'Type de sync: upcoming (14j), today (jour même), manual (admin), scheduled (cron)';
COMMENT ON COLUMN public.fixture_sync_log.checked IS 'Nombre de fixtures vérifiées';
COMMENT ON COLUMN public.fixture_sync_log.updated IS 'Nombre de fixtures mises à jour';
COMMENT ON COLUMN public.fixture_sync_log.schedule_changes IS 'JSON des changements de date/heure détectés';

-- ============================================
-- 2. FONCTION HELPER POUR APPELER L'EDGE FUNCTION
-- ============================================

-- Note: pg_cron et pg_net doivent être activés par un super-utilisateur
-- Ceci peut nécessiter l'intervention du support Supabase pour certains plans

-- Activer pg_net si disponible
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net') THEN
    CREATE EXTENSION IF NOT EXISTS pg_net;
    RAISE NOTICE 'pg_net extension enabled';
  ELSE
    RAISE NOTICE 'pg_net extension not available';
  END IF;
END $$;

-- Créer la fonction d'appel si pg_net est disponible
DO $$
BEGIN
  -- Vérifier si l'extension pg_net est INSTALLÉE (pas juste disponible)
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    -- Créer la fonction d'appel
    CREATE OR REPLACE FUNCTION public.trigger_fixture_sync(
      p_days_ahead INTEGER DEFAULT 14,
      p_mode TEXT DEFAULT 'scheduled'
    )
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $func$
    DECLARE
      v_url TEXT;
      v_response JSONB;
    BEGIN
      -- Construire l'URL (remplacer par votre URL Supabase réelle)
      v_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/sync-fixture-schedules';

      -- Appeler l'Edge Function via pg_net
      SELECT net.http_post(
        url := v_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key', true)
        ),
        body := jsonb_build_object(
          'days_ahead', p_days_ahead,
          'update_mode', p_mode
        )
      ) INTO v_response;

      RETURN v_response;
    END;
    $func$;

    COMMENT ON FUNCTION public.trigger_fixture_sync IS 'Déclenche la synchronisation des fixtures via Edge Function';
  ELSE
    RAISE NOTICE '====================================================================';
    RAISE NOTICE 'pg_net extension is NOT installed';
    RAISE NOTICE 'The trigger_fixture_sync function will NOT be created';
    RAISE NOTICE 'You can still use the admin panel or GitHub Actions for syncing';
    RAISE NOTICE '====================================================================';
  END IF;
END $$;

-- ============================================
-- 3. CONFIGURER pg_cron (SI DISPONIBLE)
-- ============================================

-- Note: pg_cron n'est pas disponible sur tous les plans Supabase
-- Si cette extension n'est pas disponible, utilisez GitHub Actions à la place

DO $$
BEGIN
  -- Vérifier si pg_cron est disponible
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN

    -- Activer l'extension
    CREATE EXTENSION IF NOT EXISTS pg_cron;

    RAISE NOTICE 'pg_cron extension enabled';

    -- Désactiver les jobs existants s'ils existent (ignorer si n'existent pas)
    BEGIN
      PERFORM cron.unschedule('daily-fixture-schedule-sync');
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Ignorer si le job n'existe pas
    END;

    BEGIN
      PERFORM cron.unschedule('today-fixture-refresh');
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Ignorer si le job n'existe pas
    END;

    -- Job 1: Sync quotidien à 3h UTC (pour les 14 prochains jours)
    -- Capture les reprogrammations, annulations, changements d'horaire
    PERFORM cron.schedule(
      'daily-fixture-schedule-sync',
      '0 3 * * *',  -- Tous les jours à 3h UTC
      $cron$SELECT public.trigger_fixture_sync(14, 'scheduled')$cron$
    );

    -- Job 2: Refresh fréquent pour les matchs du jour (toutes les 2h de 6h à 23h UTC)
    -- Capture les changements de dernière minute
    PERFORM cron.schedule(
      'today-fixture-refresh',
      '0 6-23/2 * * *',  -- Toutes les 2h de 6h à 23h
      $cron$SELECT public.trigger_fixture_sync(1, 'today')$cron$
    );

    RAISE NOTICE 'pg_cron jobs scheduled successfully';
    RAISE NOTICE '  - daily-fixture-schedule-sync: Every day at 3 AM UTC';
    RAISE NOTICE '  - today-fixture-refresh: Every 2 hours from 6 AM to 11 PM UTC';

  ELSE
    RAISE NOTICE '====================================================================';
    RAISE NOTICE 'pg_cron extension is NOT available on this Supabase plan';
    RAISE NOTICE 'Please use one of these alternatives:';
    RAISE NOTICE '  1. GitHub Actions workflow (.github/workflows/sync-fixtures.yml)';
    RAISE NOTICE '  2. External cron service (cron-job.org, EasyCron, etc.)';
    RAISE NOTICE '  3. Upgrade Supabase plan to enable pg_cron';
    RAISE NOTICE '====================================================================';
  END IF;
END $$;

-- ============================================
-- 4. VUE POUR MONITORER LES SYNCS
-- ============================================

CREATE OR REPLACE VIEW public.fixture_sync_summary AS
SELECT
  DATE(created_at) as sync_date,
  sync_type,
  COUNT(*) as total_runs,
  SUM(checked) as total_checked,
  SUM(updated) as total_updated,
  COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE(schedule_changes, '[]'::jsonb)) > 0) as runs_with_changes
FROM public.fixture_sync_log
GROUP BY DATE(created_at), sync_type
ORDER BY sync_date DESC, sync_type;

GRANT SELECT ON public.fixture_sync_summary TO authenticated, anon;

COMMENT ON VIEW public.fixture_sync_summary IS 'Vue résumée des synchronisations de fixtures par jour et type';

-- ============================================
-- 5. FONCTION POUR RÉCUPÉRER LES DERNIERS CHANGEMENTS
-- ============================================

CREATE OR REPLACE FUNCTION public.get_recent_fixture_changes(
  p_days_back INTEGER DEFAULT 7
)
RETURNS TABLE (
  sync_date TIMESTAMPTZ,
  sync_type TEXT,
  fixture_id TEXT,
  old_date TEXT,
  new_date TEXT,
  home_team TEXT,
  away_team TEXT,
  league TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.created_at as sync_date,
    l.sync_type,
    (change->>'fixture_id')::TEXT,
    (change->>'old_date')::TEXT,
    (change->>'new_date')::TEXT,
    (change->>'home_team')::TEXT,
    (change->>'away_team')::TEXT,
    (change->>'league')::TEXT
  FROM public.fixture_sync_log l,
       jsonb_array_elements(COALESCE(l.schedule_changes, '[]'::jsonb)) AS change
  WHERE l.created_at >= NOW() - (p_days_back || ' days')::INTERVAL
  ORDER BY l.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_recent_fixture_changes TO authenticated, anon;

COMMENT ON FUNCTION public.get_recent_fixture_changes IS 'Récupère tous les changements de calendrier des N derniers jours';

-- ============================================
-- NOTES DE MIGRATION
-- ============================================

-- Cette migration configure:
-- 1. ✅ Table fixture_sync_log pour tracker les synchronisations
-- 2. ✅ Fonction trigger_fixture_sync pour appeler l'Edge Function
-- 3. ⚠️  Jobs pg_cron (SI l'extension est disponible)
-- 4. ✅ Vue fixture_sync_summary pour monitorer les syncs
-- 5. ✅ Fonction get_recent_fixture_changes pour voir l'historique

-- Si pg_cron n'est PAS disponible:
-- → Utilisez le workflow GitHub Actions fourni (.github/workflows/sync-fixtures.yml)
-- → OU configurez un service de cron externe pour appeler l'Edge Function

-- Pour vérifier si pg_cron est actif:
-- SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Pour voir les jobs planifiés:
-- SELECT * FROM cron.job;

-- Pour tester manuellement la sync:
-- SELECT public.trigger_fixture_sync(14, 'manual');
