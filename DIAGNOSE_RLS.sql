-- ============================================================================
-- DIAGNOSTIC RLS POUR CHALLENGES
-- ============================================================================
-- Exécute ce script pour voir toutes les politiques actives

-- 1. Voir toutes les politiques sur la table challenges
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'challenges'
ORDER BY policyname;

-- 2. Vérifier si RLS est activé
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('challenges', 'challenge_configs', 'challenge_leagues', 'challenge_matches');

-- 3. Vérifier ton utilisateur actuel
SELECT
  auth.uid() as current_user_id,
  auth.role() as current_role;

-- 4. Vérifier si tu es authentifié
SELECT
  CASE
    WHEN auth.uid() IS NULL THEN 'NOT AUTHENTICATED'
    ELSE 'AUTHENTICATED'
  END as auth_status;
