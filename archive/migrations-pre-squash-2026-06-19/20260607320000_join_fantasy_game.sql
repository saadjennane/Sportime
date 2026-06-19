-- ============================================================================
-- Secure join for fantasy games: eligibility + server-side coin deduction /
-- ticket consumption (entry was free before). Config read from fantasy_games.
-- Mirrors join_swipe_challenge; participation tracked in challenge_participants
-- keyed by the fantasy game id.
-- ============================================================================
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
        IF lower(v_ticket.ticket_type) <> v_tier THEN RAISE EXCEPTION 'ticket_wrong_tier'; END IF;
      ELSE
        SELECT * INTO v_ticket FROM public.user_tickets t
        WHERE t.user_id = p_user_id AND lower(t.ticket_type) = v_tier
          AND t.is_used = false AND (t.expires_at IS NULL OR t.expires_at >= now())
        ORDER BY t.expires_at ASC NULLS LAST LIMIT 1;
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
