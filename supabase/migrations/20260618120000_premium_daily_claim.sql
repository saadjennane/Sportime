-- =====================================================
-- premium_daily_claim — grants a subscriber their daily perks (once per day):
-- coin stipend + premium spin(s). Amounts come from game_config (category 'premium').
-- Idempotent per (user, day) via premium_daily_claims.
-- (Daily premium ticket is added in the universal-ticket migration.)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.premium_daily_claims (
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  claim_date DATE NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  coins      INT,
  spins      INT,
  PRIMARY KEY (user_id, claim_date)
);
ALTER TABLE public.premium_daily_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS premium_daily_claims_own ON public.premium_daily_claims;
CREATE POLICY premium_daily_claims_own ON public.premium_daily_claims
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.premium_daily_claim()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user  UUID := auth.uid();
  v_is_sub BOOLEAN;
  v_coins INT;
  v_spins INT;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;

  SELECT is_subscriber INTO v_is_sub FROM public.profiles WHERE id = v_user;
  IF NOT COALESCE(v_is_sub, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_premium');
  END IF;

  v_coins := public.premium_cfg_int('daily_stipend_coins', 200);
  v_spins := public.premium_cfg_int('daily_spins', 1);

  -- Idempotency: one claim per user per day.
  INSERT INTO public.premium_daily_claims (user_id, claim_date, coins, spins)
  VALUES (v_user, current_date, v_coins, v_spins)
  ON CONFLICT (user_id, claim_date) DO NOTHING;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  IF v_coins > 0 THEN
    PERFORM public.add_coins(v_user, v_coins, 'premium_bonus',
      jsonb_build_object('kind', 'daily_stipend', 'date', current_date::text));
  END IF;
  IF v_spins > 0 THEN
    PERFORM public.update_available_spins(v_user, 'premium'::public.spin_tier, v_spins);
  END IF;

  RETURN jsonb_build_object('ok', true, 'already', false, 'coins', v_coins, 'spins', v_spins);
END $$;

GRANT EXECUTE ON FUNCTION public.premium_daily_claim() TO authenticated;
