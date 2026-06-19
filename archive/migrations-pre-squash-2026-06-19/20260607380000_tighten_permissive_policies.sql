-- ============================================================================
-- Security: tighten overly-permissive RLS policies (rls_policy_always_true).
-- Many tables had INSERT/UPDATE/DELETE/ALL policies with USING/WITH CHECK = true,
-- letting any anon/authenticated user write reference/config/game data. All real
-- writes go through SECURITY DEFINER RPCs or the sync edge functions (service_role),
-- which bypass RLS — so we drop the permissive WRITE policies but KEEP public reads.
-- ============================================================================
DO $$
DECLARE r RECORD;
BEGIN
  -- 1) Before removing any ALL-true policy (which may also serve reads), make sure
  --    a permissive SELECT policy exists so reads keep working.
  FOR r IN
    SELECT DISTINCT tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      AND (COALESCE(qual, '') = 'true' OR COALESCE(with_check, '') = 'true')
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = r.tablename
        AND (cmd = 'SELECT' OR policyname = 'lint_public_read')
    ) THEN
      EXECUTE format('CREATE POLICY lint_public_read ON public.%I FOR SELECT USING (true)', r.tablename);
    END IF;
  END LOOP;

  -- 2) Drop the permissive write/ALL policies.
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      AND (COALESCE(qual, '') = 'true' OR COALESCE(with_check, '') = 'true')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 3) Materialized view exposed to the API (not used by the app) — remove API access.
REVOKE SELECT ON public.user_daily_hpi FROM anon, authenticated;
