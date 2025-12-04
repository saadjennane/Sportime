-- ============================================================================
-- DÉSACTIVER COMPLÈTEMENT RLS POUR LES TESTS
-- ============================================================================
-- ⚠️ ATTENTION: Ceci désactive toute la sécurité RLS
-- À utiliser UNIQUEMENT pour les tests en développement
-- NE JAMAIS utiliser en production!

-- Désactiver RLS sur toutes les tables de challenges
ALTER TABLE public.challenges DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_leagues DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_matches DISABLE ROW LEVEL SECURITY;

-- Si ces tables existent, les désactiver aussi
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'swipe_challenge_matchdays') THEN
    ALTER TABLE public.swipe_challenge_matchdays DISABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'swipe_matchday_fixtures') THEN
    ALTER TABLE public.swipe_matchday_fixtures DISABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'challenge_participants') THEN
    ALTER TABLE public.challenge_participants DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Vérifier que RLS est bien désactivé
SELECT
  schemaname,
  tablename,
  rowsecurity,
  CASE
    WHEN rowsecurity THEN '❌ RLS ACTIVÉ'
    ELSE '✅ RLS DÉSACTIVÉ'
  END as status
FROM pg_tables
WHERE tablename IN ('challenges', 'challenge_configs', 'challenge_leagues', 'challenge_matches',
                    'swipe_challenge_matchdays', 'swipe_matchday_fixtures', 'challenge_participants')
ORDER BY tablename;
