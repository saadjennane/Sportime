-- ============================================================================
-- XP v2 — immediate, server-authoritative, skill-based. Foundation:
--  - xp_events: idempotency + audit (one row per awarded action).
--  - award_xp(): the only way XP is granted (idempotent; never client-callable).
--  - recalibrated level thresholds (GOAT achievable in ~8 months of engaged play).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  source_type TEXT NOT NULL,            -- match_bet | swipe | live | fantasy | placement
  source_id TEXT NOT NULL,              -- the bet/prediction/game id (unique per user+type)
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_type, source_id)
);
CREATE INDEX IF NOT EXISTS idx_xp_events_user ON public.xp_events(user_id, created_at DESC);

ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS xp_events_self_read ON public.xp_events;
CREATE POLICY xp_events_self_read ON public.xp_events FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Idempotent XP grant. Internal settle functions PERFORM this as owner; the fantasy
-- edge function calls it via service_role. NOT granted to anon/authenticated.
CREATE OR REPLACE FUNCTION public.award_xp(
  p_user_id UUID, p_amount INT, p_source_type TEXT, p_source_id TEXT, p_reason TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows INT;
BEGIN
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN RETURN; END IF;
  INSERT INTO public.xp_events (user_id, amount, source_type, source_id, reason)
  VALUES (p_user_id, p_amount, p_source_type, p_source_id, p_reason)
  ON CONFLICT (user_id, source_type, source_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RETURN; END IF;          -- already awarded for this action
  PERFORM public.add_xp_to_user(p_user_id, p_amount);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_xp(UUID, INT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_xp(UUID, INT, TEXT, TEXT, TEXT) TO service_role;

-- Recalibrated thresholds (smooth curve; fast early levels, meritful GOAT).
UPDATE public.levels_config SET xp_required = 0      WHERE level = 1; -- Rookie
UPDATE public.levels_config SET xp_required = 2000   WHERE level = 2; -- Rising Star
UPDATE public.levels_config SET xp_required = 8000   WHERE level = 3; -- Pro
UPDATE public.levels_config SET xp_required = 20000  WHERE level = 4; -- Elite
UPDATE public.levels_config SET xp_required = 38000  WHERE level = 5; -- Legend
UPDATE public.levels_config SET xp_required = 60000  WHERE level = 6; -- GOAT

-- Recompute every user's level/name against the new thresholds.
UPDATE public.users u
SET current_level = lc.level,
    level_name    = lc.name
FROM public.levels_config lc
WHERE lc.level = (
  SELECT l2.level FROM public.levels_config l2
  WHERE l2.xp_required <= COALESCE(u.xp_total, 0)
  ORDER BY l2.xp_required DESC LIMIT 1
);
