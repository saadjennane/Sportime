-- =====================================================
-- Fix: restore EXECUTE grants on the Live Score Prediction RPCs.
--
-- The deployed DB lost the grants these functions' migrations specify (prod drift):
-- calling them returns 42501 "permission denied for function ...". With the
-- `authenticated` role denied, players can't join/submit, so predictions never persist.
--
-- This re-grants EVERY overload of each function by name (signature-agnostic, idempotent),
-- so it works regardless of the exact deployed signatures.
-- =====================================================

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT 'public.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'join_live_game',
        'submit_live_prediction',
        'edit_live_prediction',
        'get_live_game_state',
        'get_user_live_game_limits',
        'settle_live_game_score'
      )
  LOOP
    EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.sig || ' TO authenticated, anon, service_role';
    RAISE NOTICE 'granted: %', r.sig;
  END LOOP;
END $$;

-- Verify after running:
--   SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, p.proacl
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname='public' AND p.proname IN
--     ('join_live_game','submit_live_prediction','edit_live_prediction','get_live_game_state');
