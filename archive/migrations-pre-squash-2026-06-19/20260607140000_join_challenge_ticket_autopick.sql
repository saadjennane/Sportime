-- ============================================================================
-- join_betting_challenge: auto-pick a valid ticket when method='ticket'.
-- The client always passes p_ticket_id = NULL, so the server resolves a valid
-- ticket (right tier, unused, unexpired), consumes it, and records it.
-- ============================================================================
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
        IF lower(v_ticket.ticket_type) <> v_tier THEN
          RAISE EXCEPTION 'ticket_wrong_tier';
        END IF;
      ELSE
        -- Auto-pick a valid ticket of the right tier (soonest expiry first)
        SELECT * INTO v_ticket FROM public.user_tickets t
        WHERE t.user_id = p_user_id
          AND lower(t.ticket_type) = v_tier
          AND t.is_used = false
          AND (t.expires_at IS NULL OR t.expires_at >= now())
        ORDER BY t.expires_at ASC NULLS LAST
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
