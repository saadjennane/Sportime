-- Fix: use a valid coin_transactions transaction_type ('challenge_reward').
CREATE OR REPLACE FUNCTION public.distribute_reward_to_user(
  p_user_id UUID, p_reward JSONB, p_game_type TEXT DEFAULT NULL, p_game_id UUID DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_type  TEXT := p_reward->>'type';
  v_value INT  := COALESCE((p_reward->>'value')::INT, 0);
  v_tier  TEXT := COALESCE(NULLIF(p_reward->>'tier',''), 'amateur');
  v_qty   INT  := GREATEST(1, COALESCE((p_reward->>'quantity')::INT, 1));
  v_status TEXT := 'fulfilled';
  v_days  INT;
  i INT;
BEGIN
  CASE v_type
    WHEN 'coins' THEN
      PERFORM public.add_coins(p_user_id, v_value * v_qty, 'challenge_reward',
        jsonb_build_object('game_type', p_game_type, 'game_id', p_game_id));
    WHEN 'xp' THEN
      BEGIN
        INSERT INTO public.activity_log (user_id, action_type, xp_gained, metadata)
        VALUES (p_user_id, 'challenge_reward', v_value * v_qty, jsonb_build_object('game_id', p_game_id));
      EXCEPTION WHEN OTHERS THEN NULL; -- XP ledger optional; never block other rewards
      END;
    WHEN 'ticket' THEN
      FOR i IN 1..v_qty LOOP PERFORM public.grant_ticket(p_user_id, v_tier::public.ticket_type, 'game_reward'); END LOOP;
    WHEN 'spin' THEN
      PERFORM public.grant_spin(p_user_id, v_tier, v_qty);
    WHEN 'premium_3d', 'premium_7d' THEN
      v_days := (CASE v_type WHEN 'premium_3d' THEN 3 ELSE 7 END) * v_qty;
      UPDATE public.users
      SET premium_expires_at = GREATEST(COALESCE(premium_expires_at, now()), now()) + (v_days || ' days')::INTERVAL
      WHERE id = p_user_id;
    ELSE
      v_status := 'pending';
  END CASE;

  INSERT INTO public.reward_fulfillments (user_id, game_type, game_id, reward_type, value, name, tier, quantity, status)
  VALUES (p_user_id, p_game_type, p_game_id, v_type, v_value, p_reward->>'name', v_tier, v_qty, v_status);
END;
$$;
