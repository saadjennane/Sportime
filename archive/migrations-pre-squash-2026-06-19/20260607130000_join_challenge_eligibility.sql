-- ============================================================================
-- Server-side eligibility for joining a betting challenge.
-- Validates level / badges / subscription / ticket (and consumes the ticket).
-- Mirrors the canonical level taxonomy (Rookie..GOAT) used by the client.
-- ============================================================================

-- Canonical level rank (Rookie=0 … GOAT=6), with legacy aliases.
CREATE OR REPLACE FUNCTION public.user_level_rank(p_level TEXT)
RETURNS INTEGER LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE lower(trim(coalesce(p_level, '')))
    WHEN 'rookie' THEN 0
    WHEN 'amateur' THEN 0          -- legacy alias
    WHEN 'rising star' THEN 1
    WHEN 'rising_star' THEN 1
    WHEN 'pro' THEN 2
    WHEN 'elite' THEN 3
    WHEN 'expert' THEN 3           -- legacy alias
    WHEN 'legend' THEN 4
    WHEN 'master' THEN 5
    WHEN 'goat' THEN 6
    ELSE 0
  END;
$$;

GRANT EXECUTE ON FUNCTION public.user_level_rank(TEXT) TO authenticated, anon, service_role;

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

  -- Eligibility requirements (from challenge_configs.config_data)
  SELECT cc.config_data INTO v_cfg
  FROM public.challenge_configs cc
  WHERE cc.challenge_id = p_challenge_id
  LIMIT 1;

  v_min_level := COALESCE(v_cfg->>'minimum_level', 'Rookie');
  v_req_badges := COALESCE(v_cfg->'required_badges', '[]'::jsonb);
  v_req_sub := COALESCE((v_cfg->>'requires_subscription')::boolean, false);
  v_tier := lower(COALESCE(v_cfg->>'tier', 'amateur'));

  -- Player profile (level / badges / subscription)
  SELECT p.level, p.is_subscriber, to_jsonb(p.badges)
    INTO v_level, v_is_sub, v_badges
  FROM public.profiles p WHERE p.id = p_user_id;
  v_badges := COALESCE(v_badges, '[]'::jsonb);

  -- Register participation (used to detect a fresh join)
  INSERT INTO public.challenge_participants (challenge_id, user_id)
  VALUES (p_challenge_id, p_user_id)
  ON CONFLICT (challenge_id, user_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  already_joined := v_rows = 0;

  IF NOT already_joined THEN
    -- Enforce eligibility only on a genuine first join (raises roll back the insert)
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
      UPDATE public.user_tickets SET is_used = true, used_at = now() WHERE id = p_ticket_id;
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
  VALUES (p_challenge_id, p_user_id, p_method, p_ticket_id)
  ON CONFLICT (challenge_id, user_id) DO UPDATE
  SET entry_method = EXCLUDED.entry_method, ticket_id = EXCLUDED.ticket_id, updated_at = now();

  coins_balance := v_balance;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
