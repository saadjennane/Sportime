-- ============================================================================
-- Security linter fixes + allow 2-letter squad names.
-- ============================================================================

-- 1) Squad names: allow 2 chars (was 3).
ALTER TABLE public.squads DROP CONSTRAINT IF EXISTS squads_name_check;
ALTER TABLE public.squads ADD CONSTRAINT squads_name_check
  CHECK (char_length(name) >= 2 AND char_length(name) <= 50);

CREATE OR REPLACE FUNCTION public.create_squad(
  p_user_id UUID, p_name TEXT, p_description TEXT DEFAULT NULL, p_image_url TEXT DEFAULT NULL
) RETURNS public.squads
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_squad public.squads;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF length(trim(COALESCE(p_name, ''))) < 2 THEN RAISE EXCEPTION 'name_too_short'; END IF;
  INSERT INTO public.squads (name, description, image_url, created_by)
  VALUES (trim(p_name), NULLIF(trim(COALESCE(p_description, '')), ''), NULLIF(p_image_url, ''), p_user_id)
  RETURNING * INTO v_squad;
  RETURN v_squad;
END;
$$;

-- 2) Enable RLS on public tables that lack it. Add a guaranteed permissive SELECT
--    policy FIRST so existing reads never break (writes go through SECURITY DEFINER
--    RPCs that bypass RLS). These are public reference / game-state tables.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'badges', 'challenge_matches', 'challenge_participants',
    'fantasy_games', 'fb_fixtures', 'players', 'teams'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='lint_public_read') THEN
        EXECUTE format('CREATE POLICY lint_public_read ON public.%I FOR SELECT TO anon, authenticated USING (true)', t);
      END IF;
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- 3) Views: enforce the querying user's RLS (security_invoker) instead of the
--    view creator's (security_definer). The underlying tables now have public
--    read policies, so these read-only aggregations keep working.
ALTER VIEW IF EXISTS public.user_profile_stats SET (security_invoker = on);
ALTER VIEW IF EXISTS public.fixture_sync_summary SET (security_invoker = on);
ALTER VIEW IF EXISTS public.player_season_stats_combined SET (security_invoker = on);
