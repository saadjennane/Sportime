-- ============================================================================
-- Security: (a) disable the unused GraphQL API surface, (b) tighten EXECUTE on
-- public functions. The app uses PostgREST (.from/.rpc) + edge functions only —
-- never GraphQL — and authenticates every user, so anon never calls RPCs.
-- ============================================================================

-- (a) Disable GraphQL exposure for anon/authenticated (clears pg_graphql_*_table_exposed).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'graphql_public') THEN
    EXECUTE 'REVOKE USAGE ON SCHEMA graphql_public FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA graphql_public FROM anon, authenticated';
  END IF;
END $$;

-- (b) Function EXECUTE hardening:
--   - trigger functions: no client needs to call them (they fire internally) -> revoke all.
--   - other functions: keep authenticated + service_role, drop PUBLIC + anon
--     (SECURITY DEFINER RPCs still validate auth.uid() internally; internal calls
--     run as the owner so they are unaffected).
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, p.prorettype
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
  LOOP
    BEGIN
      IF r.prorettype = 'pg_catalog.trigger'::regtype THEN
        EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated', r.proname, r.args);
      ELSE
        EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role', r.proname, r.args);
        EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon', r.proname, r.args);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'skip %(%): %', r.proname, r.args, SQLERRM;
    END;
  END LOOP;
END $$;
