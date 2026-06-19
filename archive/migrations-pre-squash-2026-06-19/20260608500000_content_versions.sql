-- ─────────────────────────────────────────────────────────────────────────────
-- Lightweight change signal: the app fetches a tiny version number per content
-- key and only re-downloads the full content when that number changed.
-- A trigger bumps the version on any edit of the underlying table.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.content_versions (
  key        TEXT PRIMARY KEY,
  version    BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.content_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS content_versions_read ON public.content_versions;
CREATE POLICY content_versions_read ON public.content_versions FOR SELECT USING (true);
GRANT SELECT ON public.content_versions TO anon, authenticated;

INSERT INTO public.content_versions (key) VALUES
  ('spin_segments'), ('levels_config'), ('badges'), ('xp_formula_config'), ('reward_packs')
ON CONFLICT (key) DO NOTHING;

-- Generic bump: trigger passes the content key via TG_ARGV[0].
CREATE OR REPLACE FUNCTION public.bump_content_version()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.content_versions (key, version, updated_at)
  VALUES (TG_ARGV[0], 1, now())
  ON CONFLICT (key) DO UPDATE SET version = public.content_versions.version + 1, updated_at = now();
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_version_spin_segments ON public.spin_segments;
CREATE TRIGGER trg_version_spin_segments AFTER INSERT OR UPDATE OR DELETE ON public.spin_segments
  FOR EACH STATEMENT EXECUTE FUNCTION public.bump_content_version('spin_segments');

DROP TRIGGER IF EXISTS trg_version_levels ON public.levels_config;
CREATE TRIGGER trg_version_levels AFTER INSERT OR UPDATE OR DELETE ON public.levels_config
  FOR EACH STATEMENT EXECUTE FUNCTION public.bump_content_version('levels_config');

DROP TRIGGER IF EXISTS trg_version_badges ON public.badges;
CREATE TRIGGER trg_version_badges AFTER INSERT OR UPDATE OR DELETE ON public.badges
  FOR EACH STATEMENT EXECUTE FUNCTION public.bump_content_version('badges');

DROP TRIGGER IF EXISTS trg_version_xp ON public.xp_formula_config;
CREATE TRIGGER trg_version_xp AFTER INSERT OR UPDATE OR DELETE ON public.xp_formula_config
  FOR EACH STATEMENT EXECUTE FUNCTION public.bump_content_version('xp_formula_config');

DROP TRIGGER IF EXISTS trg_version_reward_packs ON public.reward_packs;
CREATE TRIGGER trg_version_reward_packs AFTER INSERT OR UPDATE OR DELETE ON public.reward_packs
  FOR EACH STATEMENT EXECUTE FUNCTION public.bump_content_version('reward_packs');
