-- Script pour identifier et supprimer les triggers défectueux

-- ============================================
-- 1. LISTER TOUS LES TRIGGERS SUR fb_leagues
-- ============================================

SELECT
  t.trigger_name,
  t.event_manipulation,
  t.action_timing,
  t.action_statement
FROM information_schema.triggers t
WHERE t.event_object_table = 'fb_leagues'
  AND t.trigger_schema = 'public';

-- ============================================
-- 2. LISTER TOUS LES TRIGGERS SUR fb_teams
-- ============================================

SELECT
  t.trigger_name,
  t.event_manipulation,
  t.action_timing,
  t.action_statement
FROM information_schema.triggers t
WHERE t.event_object_table = 'fb_teams'
  AND t.trigger_schema = 'public';

-- ============================================
-- 3. SUPPRIMER LES TRIGGERS DÉFECTUEUX
-- ============================================

-- Pour fb_leagues - essayer tous les noms possibles
DO $$
BEGIN
  -- Liste de tous les triggers possibles à supprimer
  EXECUTE 'DROP TRIGGER IF EXISTS handle_updated_at ON public.fb_leagues';
  EXECUTE 'DROP TRIGGER IF EXISTS set_updated_at ON public.fb_leagues';
  EXECUTE 'DROP TRIGGER IF EXISTS update_updated_at_column ON public.fb_leagues';
  EXECUTE 'DROP TRIGGER IF EXISTS set_timestamp ON public.fb_leagues';

  RAISE NOTICE 'Triggers supprimés de fb_leagues';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Erreur lors de la suppression: %', SQLERRM;
END $$;

-- Pour fb_teams
DO $$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS handle_updated_at ON public.fb_teams';
  EXECUTE 'DROP TRIGGER IF EXISTS set_updated_at ON public.fb_teams';
  EXECUTE 'DROP TRIGGER IF EXISTS update_updated_at_column ON public.fb_teams';
  EXECUTE 'DROP TRIGGER IF EXISTS set_timestamp ON public.fb_teams';

  RAISE NOTICE 'Triggers supprimés de fb_teams';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Erreur lors de la suppression: %', SQLERRM;
END $$;

-- ============================================
-- 4. VÉRIFIER QUE LES TRIGGERS SONT SUPPRIMÉS
-- ============================================

SELECT
  t.trigger_name,
  t.event_object_table
FROM information_schema.triggers t
WHERE t.event_object_table IN ('fb_leagues', 'fb_teams')
  AND t.trigger_schema = 'public'
  AND t.trigger_name LIKE '%updated_at%';
