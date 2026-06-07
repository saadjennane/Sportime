-- HOTFIX: the previous anon-execute revoke broke the pre-session guest signup
-- (createGuestAccount calls these RPCs as anon before signInWithPassword), causing
-- a black screen for users without a valid session. Re-grant anon EXECUTE on the
-- functions that MUST run before authentication.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('complete_guest_registration', 'set_user_role')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO anon', r.proname, r.args);
  END LOOP;
END $$;
