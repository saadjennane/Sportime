-- =====================================================
-- Universal premium ticket: the 3 join RPCs now accept a 'premium' ticket for ANY
-- tier (in addition to the tier-specific ticket). The only change vs the previous
-- definitions is the two ticket predicates (validation + auto-pick); a tier-specific
-- ticket is preferred so the universal one is spent only as a fallback.
-- Also: premium_daily_claim now grants the daily premium ticket(s).
-- =====================================================

-- ── join_betting_challenge ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.join_betting_challenge(
  p_challenge_id UUID,
  p_user_id UUID,
  p_method TEXT,
  p_ticket_id UUID DEFAULT NULL
) RETURNS TABLE(already_joined BOOLEAN, coins_balance INTEGER) AS $$
DECLARE
  v_entry_cost INTEGER;
  v_rows BIGINT;
  v_balance INTEGER;
  v_deduct_result RECORD;
  v_cfg JSONB;
  v_min_level TEXT;
  v_req_badges JSONB;
  v_req_sub BOOLEAN;
  v_tier TEXT;
  v_level TEXT;
  v_is_sub BOOLEAN;
  v_badges JSONB;
  v_req TEXT;
  v_ticket RECORD;
  v_resolved_ticket UUID := NULL;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_method NOT IN ('coins', 'ticket') THEN
    RAISE EXCEPTION 'Invalid entry method %', p_method;
  END IF;

  SELECT c.entry_cost INTO v_entry_cost FROM public.challenges c WHERE c.id = p_challenge_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge not found';
  END IF;

  SELECT cc.config_data INTO v_cfg
  FROM public.challenge_configs cc
  WHERE cc.challenge_id = p_challenge_id
  LIMIT 1;

  v_min_level := COALESCE(v_cfg->>'minimum_level', 'Rookie');
  v_req_badges := COALESCE(v_cfg->'required_badges', '[]'::jsonb);
  v_req_sub := COALESCE((v_cfg->>'requires_subscription')::boolean, false);
  v_tier := lower(COALESCE(v_cfg->>'tier', 'amateur'));

  SELECT p.level, p.is_subscriber, to_jsonb(p.badges)
    INTO v_level, v_is_sub, v_badges
  FROM public.profiles p WHERE p.id = p_user_id;
  v_badges := COALESCE(v_badges, '[]'::jsonb);

  INSERT INTO public.challenge_participants (challenge_id, user_id)
  VALUES (p_challenge_id, p_user_id)
  ON CONFLICT (challenge_id, user_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  already_joined := v_rows = 0;

  IF NOT already_joined THEN
    IF public.user_level_rank(v_level) < public.user_level_rank(v_min_level) THEN
      RAISE EXCEPTION 'level_too_low';
    END IF;
    IF v_req_sub AND NOT COALESCE(v_is_sub, false) THEN
      RAISE EXCEPTION 'subscription_required';
    END IF;
    FOR v_req IN SELECT jsonb_array_elements_text(v_req_badges) LOOP
      IF NOT (v_badges ? v_req) THEN
        RAISE EXCEPTION 'missing_badge';
      END IF;
    END LOOP;

    IF p_method = 'ticket' THEN
      IF p_ticket_id IS NOT NULL THEN
        SELECT * INTO v_ticket FROM public.user_tickets t
        WHERE t.id = p_ticket_id AND t.user_id = p_user_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'ticket_invalid'; END IF;
        IF v_ticket.is_used THEN RAISE EXCEPTION 'ticket_used'; END IF;
        IF v_ticket.expires_at IS NOT NULL AND v_ticket.expires_at < now() THEN
          RAISE EXCEPTION 'ticket_expired';
        END IF;
        IF lower(v_ticket.ticket_type) NOT IN (v_tier, 'premium') THEN
          RAISE EXCEPTION 'ticket_wrong_tier';
        END IF;
      ELSE
        -- Auto-pick a valid ticket: tier-specific first, then the universal 'premium' one.
        SELECT * INTO v_ticket FROM public.user_tickets t
        WHERE t.user_id = p_user_id
          AND lower(t.ticket_type) IN (v_tier, 'premium')
          AND t.is_used = false
          AND (t.expires_at IS NULL OR t.expires_at >= now())
        ORDER BY (lower(t.ticket_type) = 'premium'), t.expires_at ASC NULLS LAST
        LIMIT 1;
        IF NOT FOUND THEN RAISE EXCEPTION 'ticket_invalid'; END IF;
      END IF;

      UPDATE public.user_tickets SET is_used = true, used_at = now() WHERE id = v_ticket.id;
      v_resolved_ticket := v_ticket.id;
      SELECT u.coins_balance INTO v_balance FROM public.users u WHERE u.id = p_user_id;
    ELSE
      SELECT * INTO v_deduct_result
      FROM public.deduct_coins(
        p_user_id, v_entry_cost, 'challenge_entry',
        jsonb_build_object('challenge_id', p_challenge_id)
      );
      v_balance := v_deduct_result.new_balance;
    END IF;
  ELSE
    SELECT u.coins_balance INTO v_balance FROM public.users u WHERE u.id = p_user_id;
  END IF;

  INSERT INTO public.challenge_entries (challenge_id, user_id, entry_method, ticket_id)
  VALUES (p_challenge_id, p_user_id, p_method, v_resolved_ticket)
  ON CONFLICT (challenge_id, user_id) DO UPDATE
  SET entry_method = EXCLUDED.entry_method,
      ticket_id = COALESCE(EXCLUDED.ticket_id, public.challenge_entries.ticket_id),
      updated_at = now();

  coins_balance := v_balance;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- ── join_fantasy_game ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.join_fantasy_game(
  p_game_id UUID,
  p_user_id UUID,
  p_method TEXT,
  p_ticket_id UUID DEFAULT NULL
) RETURNS TABLE(already_joined BOOLEAN, coins_balance INTEGER) AS $$
DECLARE
  v_entry_cost INTEGER;
  v_min_level TEXT;
  v_req_badges JSONB;
  v_req_sub BOOLEAN;
  v_tier TEXT;
  v_rows BIGINT;
  v_balance INTEGER;
  v_deduct RECORD;
  v_level TEXT;
  v_is_sub BOOLEAN;
  v_badges JSONB;
  v_req TEXT;
  v_ticket RECORD;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_method NOT IN ('coins', 'ticket') THEN RAISE EXCEPTION 'Invalid entry method %', p_method; END IF;

  SELECT COALESCE(fg.entry_cost, 0), COALESCE(fg.minimum_level, 'Rookie'),
         COALESCE(to_jsonb(fg.required_badges), '[]'::jsonb),
         COALESCE(fg.requires_subscription, false), lower(COALESCE(fg.tier, 'amateur'))
    INTO v_entry_cost, v_min_level, v_req_badges, v_req_sub, v_tier
  FROM public.fantasy_games fg WHERE fg.id = p_game_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fantasy game not found'; END IF;

  SELECT p.level, p.is_subscriber, to_jsonb(p.badges)
    INTO v_level, v_is_sub, v_badges
  FROM public.profiles p WHERE p.id = p_user_id;
  v_badges := COALESCE(v_badges, '[]'::jsonb);

  INSERT INTO public.challenge_participants (challenge_id, user_id)
  VALUES (p_game_id, p_user_id)
  ON CONFLICT (challenge_id, user_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  already_joined := v_rows = 0;

  IF NOT already_joined THEN
    IF public.user_level_rank(v_level) < public.user_level_rank(v_min_level) THEN
      RAISE EXCEPTION 'level_too_low';
    END IF;
    IF v_req_sub AND NOT COALESCE(v_is_sub, false) THEN
      RAISE EXCEPTION 'subscription_required';
    END IF;
    FOR v_req IN SELECT jsonb_array_elements_text(v_req_badges) LOOP
      IF NOT (v_badges ? v_req) THEN RAISE EXCEPTION 'missing_badge'; END IF;
    END LOOP;

    IF p_method = 'ticket' THEN
      IF p_ticket_id IS NOT NULL THEN
        SELECT * INTO v_ticket FROM public.user_tickets t
        WHERE t.id = p_ticket_id AND t.user_id = p_user_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'ticket_invalid'; END IF;
        IF v_ticket.is_used THEN RAISE EXCEPTION 'ticket_used'; END IF;
        IF v_ticket.expires_at IS NOT NULL AND v_ticket.expires_at < now() THEN RAISE EXCEPTION 'ticket_expired'; END IF;
        IF lower(v_ticket.ticket_type) NOT IN (v_tier, 'premium') THEN RAISE EXCEPTION 'ticket_wrong_tier'; END IF;
      ELSE
        SELECT * INTO v_ticket FROM public.user_tickets t
        WHERE t.user_id = p_user_id AND lower(t.ticket_type) IN (v_tier, 'premium')
          AND t.is_used = false AND (t.expires_at IS NULL OR t.expires_at >= now())
        ORDER BY (lower(t.ticket_type) = 'premium'), t.expires_at ASC NULLS LAST LIMIT 1;
        IF NOT FOUND THEN RAISE EXCEPTION 'ticket_invalid'; END IF;
      END IF;
      UPDATE public.user_tickets SET is_used = true, used_at = now() WHERE id = v_ticket.id;
      SELECT u.coins_balance INTO v_balance FROM public.users u WHERE u.id = p_user_id;
    ELSE
      SELECT * INTO v_deduct
      FROM public.deduct_coins(p_user_id, v_entry_cost, 'fantasy_entry',
        jsonb_build_object('game_id', p_game_id));
      v_balance := v_deduct.new_balance;
    END IF;
  ELSE
    SELECT u.coins_balance INTO v_balance FROM public.users u WHERE u.id = p_user_id;
  END IF;

  coins_balance := v_balance;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.join_fantasy_game(UUID, UUID, TEXT, UUID)
  TO authenticated, anon, service_role;

-- ── join_swipe_challenge ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.join_swipe_challenge(
  p_challenge_id UUID,
  p_user_id UUID,
  p_method TEXT,
  p_ticket_id UUID DEFAULT NULL
) RETURNS TABLE(already_joined BOOLEAN, coins_balance INTEGER) AS $$
DECLARE
  v_entry_cost INTEGER;
  v_rows BIGINT;
  v_balance INTEGER;
  v_deduct_result RECORD;
  v_cfg JSONB;
  v_min_level TEXT;
  v_req_badges JSONB;
  v_req_sub BOOLEAN;
  v_tier TEXT;
  v_level TEXT;
  v_is_sub BOOLEAN;
  v_badges JSONB;
  v_req TEXT;
  v_ticket RECORD;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_method NOT IN ('coins', 'ticket') THEN
    RAISE EXCEPTION 'Invalid entry method %', p_method;
  END IF;

  SELECT c.entry_cost INTO v_entry_cost FROM public.challenges c WHERE c.id = p_challenge_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Challenge not found'; END IF;

  SELECT cc.config_data INTO v_cfg
  FROM public.challenge_configs cc WHERE cc.challenge_id = p_challenge_id LIMIT 1;
  v_min_level := COALESCE(v_cfg->>'minimum_level', 'Rookie');
  v_req_badges := COALESCE(v_cfg->'required_badges', '[]'::jsonb);
  v_req_sub := COALESCE((v_cfg->>'requires_subscription')::boolean, false);
  v_tier := lower(COALESCE(v_cfg->>'tier', 'amateur'));

  SELECT p.level, p.is_subscriber, to_jsonb(p.badges)
    INTO v_level, v_is_sub, v_badges
  FROM public.profiles p WHERE p.id = p_user_id;
  v_badges := COALESCE(v_badges, '[]'::jsonb);

  INSERT INTO public.challenge_participants (challenge_id, user_id)
  VALUES (p_challenge_id, p_user_id)
  ON CONFLICT (challenge_id, user_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  already_joined := v_rows = 0;

  IF NOT already_joined THEN
    IF public.user_level_rank(v_level) < public.user_level_rank(v_min_level) THEN
      RAISE EXCEPTION 'level_too_low';
    END IF;
    IF v_req_sub AND NOT COALESCE(v_is_sub, false) THEN
      RAISE EXCEPTION 'subscription_required';
    END IF;
    FOR v_req IN SELECT jsonb_array_elements_text(v_req_badges) LOOP
      IF NOT (v_badges ? v_req) THEN RAISE EXCEPTION 'missing_badge'; END IF;
    END LOOP;

    IF p_method = 'ticket' THEN
      IF p_ticket_id IS NOT NULL THEN
        SELECT * INTO v_ticket FROM public.user_tickets t
        WHERE t.id = p_ticket_id AND t.user_id = p_user_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'ticket_invalid'; END IF;
        IF v_ticket.is_used THEN RAISE EXCEPTION 'ticket_used'; END IF;
        IF v_ticket.expires_at IS NOT NULL AND v_ticket.expires_at < now() THEN
          RAISE EXCEPTION 'ticket_expired';
        END IF;
        IF lower(v_ticket.ticket_type) NOT IN (v_tier, 'premium') THEN RAISE EXCEPTION 'ticket_wrong_tier'; END IF;
      ELSE
        SELECT * INTO v_ticket FROM public.user_tickets t
        WHERE t.user_id = p_user_id AND lower(t.ticket_type) IN (v_tier, 'premium')
          AND t.is_used = false AND (t.expires_at IS NULL OR t.expires_at >= now())
        ORDER BY (lower(t.ticket_type) = 'premium'), t.expires_at ASC NULLS LAST LIMIT 1;
        IF NOT FOUND THEN RAISE EXCEPTION 'ticket_invalid'; END IF;
      END IF;
      UPDATE public.user_tickets SET is_used = true, used_at = now() WHERE id = v_ticket.id;
      SELECT u.coins_balance INTO v_balance FROM public.users u WHERE u.id = p_user_id;
    ELSE
      SELECT * INTO v_deduct_result
      FROM public.deduct_coins(
        p_user_id, v_entry_cost, 'challenge_entry',
        jsonb_build_object('challenge_id', p_challenge_id)
      );
      v_balance := v_deduct_result.new_balance;
    END IF;
  ELSE
    SELECT u.coins_balance INTO v_balance FROM public.users u WHERE u.id = p_user_id;
  END IF;

  coins_balance := v_balance;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION public.join_swipe_challenge(UUID, UUID, TEXT, UUID)
  TO authenticated, anon, service_role;

-- ── premium_daily_claim: now also grants the daily universal premium ticket ──
CREATE OR REPLACE FUNCTION public.premium_daily_claim()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user     UUID := auth.uid();
  v_is_sub   BOOLEAN;
  v_coins    INT;
  v_spins    INT;
  v_tickets  INT;
  v_exp_days INT;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;

  SELECT is_subscriber INTO v_is_sub FROM public.profiles WHERE id = v_user;
  IF NOT COALESCE(v_is_sub, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_premium');
  END IF;

  v_coins    := public.premium_cfg_int('daily_stipend_coins', 200);
  v_spins    := public.premium_cfg_int('daily_spins', 1);
  v_tickets  := public.premium_cfg_int('daily_tickets', 1);
  v_exp_days := public.premium_cfg_int('ticket_expiry_days', 14);

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
  IF v_tickets > 0 THEN
    INSERT INTO public.user_tickets (user_id, ticket_type, expires_at)
    SELECT v_user, 'premium'::public.ticket_type, now() + (v_exp_days || ' days')::interval
    FROM generate_series(1, v_tickets);
  END IF;

  RETURN jsonb_build_object('ok', true, 'already', false,
    'coins', v_coins, 'spins', v_spins, 'tickets', v_tickets);
END $$;

GRANT EXECUTE ON FUNCTION public.premium_daily_claim() TO authenticated;
