-- Security: pin search_path on every public function that doesn't set it
-- (fixes the function_search_path_mutable linter warnings). search_path=public
-- is correct for these functions (they operate on public-schema objects; any
-- extension calls are schema-qualified e.g. net./cron.).
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) cfg
        WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public', r.proname, r.args);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'skip %(%): %', r.proname, r.args, SQLERRM;
    END;
  END LOOP;
END $$;
