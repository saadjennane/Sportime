-- ─────────────────────────────────────────────────────────────────────────────
-- Server-side spin engine: all 5 wheels draw from the admin-editable
-- spin_segments table. Eligibility (free 24h cooldown / paid consumes an
-- available spin), weighted draw, reward grant, history — all server-side.
-- ─────────────────────────────────────────────────────────────────────────────

-- Reward tier for ticket/spin/masterpass segments (the prize's tier).
ALTER TABLE public.spin_segments ADD COLUMN IF NOT EXISTS reward_tier TEXT;
UPDATE public.spin_segments SET reward_tier = 'amateur' WHERE reward_tier IS NULL AND label ILIKE '%amateur%';
UPDATE public.spin_segments SET reward_tier = 'master'  WHERE reward_tier IS NULL AND label ILIKE '%master%';
UPDATE public.spin_segments SET reward_tier = 'apex'    WHERE reward_tier IS NULL AND label ILIKE '%apex%';
-- "Extra Spin" inherits the wheel's tier; "Extra Premium Spin" -> premium
UPDATE public.spin_segments SET reward_tier = tier WHERE reward_tier IS NULL AND category = 'spin';

-- Seed the FREE wheel (was hard-coded in mockFunZone.ts).
INSERT INTO public.spin_segments (tier, segment_key, label, base_chance, category, value, sort_order)
SELECT * FROM (VALUES
  ('free','free_coins_10','+10 Coins',0.20,'coins',10,0),
  ('free','free_xp_25','XP +25',0.20,'xp',25,1),
  ('free','free_coins_25','+25 Coins',0.15,'coins',25,2),
  ('free','free_xp_50','XP +50',0.12,'xp',50,3),
  ('free','free_coins_50','+50 Coins',0.08,'coins',50,4),
  ('free','free_ticket','Amateur Ticket',0.05,'ticket',NULL,5),
  ('free','free_xp_100','XP +100',0.05,'xp',100,6),
  ('free','free_noluck','No luck',0.15,'none',NULL,7)
) AS v(tier,segment_key,label,base_chance,category,value,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.spin_segments WHERE tier = 'free');
UPDATE public.spin_segments SET reward_tier = 'amateur' WHERE tier = 'free' AND category = 'ticket' AND reward_tier IS NULL;

-- Extend the reward granter with a generic 'premium' (value = days).
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
      PERFORM public.add_coins(p_user_id, v_value * v_qty, 'challenge_reward', jsonb_build_object('game_type', p_game_type, 'game_id', p_game_id));
    WHEN 'xp' THEN
      BEGIN INSERT INTO public.activity_log (user_id, action_type, xp_gained, metadata)
            VALUES (p_user_id, 'challenge_reward', v_value * v_qty, jsonb_build_object('game_id', p_game_id));
      EXCEPTION WHEN OTHERS THEN NULL; END;
    WHEN 'ticket' THEN
      FOR i IN 1..v_qty LOOP PERFORM public.grant_ticket(p_user_id, v_tier::public.ticket_type, 'game_reward'); END LOOP;
    WHEN 'spin' THEN
      PERFORM public.grant_spin(p_user_id, v_tier, v_qty);
    WHEN 'premium_3d', 'premium_7d', 'premium' THEN
      v_days := (CASE v_type WHEN 'premium_3d' THEN 3 WHEN 'premium_7d' THEN 7 ELSE GREATEST(1, v_value) END) * v_qty;
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

-- Spin a wheel: eligibility -> weighted draw from spin_segments -> grant -> history.
-- Returns the winning segment so the client can animate to it.
CREATE OR REPLACE FUNCTION public.spin_wheel(p_tier TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_last TIMESTAMPTZ;
  v_avail INT;
  v_total NUMERIC;
  v_rand NUMERIC;
  v_cum NUMERIC := 0;
  v_seg RECORD;
  v_win RECORD;
  v_idx INT := 0;
  v_reward JSONB;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not authenticated'); END IF;
  IF p_tier NOT IN ('free','amateur','master','apex','premium') THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid tier'); END IF;

  -- Ensure a spin state row exists.
  INSERT INTO public.user_spin_states (user_id) VALUES (v_user) ON CONFLICT (user_id) DO NOTHING;

  -- Eligibility
  IF p_tier = 'free' THEN
    SELECT last_free_spin_at INTO v_last FROM public.user_spin_states WHERE user_id = v_user;
    IF v_last IS NOT NULL AND (now() - v_last) < INTERVAL '24 hours' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'cooldown', 'next_at', v_last + INTERVAL '24 hours');
    END IF;
    UPDATE public.user_spin_states SET last_free_spin_at = now(), updated_at = now() WHERE user_id = v_user;
  ELSE
    SELECT COALESCE((available_spins->>p_tier)::INT, 0) INTO v_avail FROM public.user_spin_states WHERE user_id = v_user;
    IF v_avail < 1 THEN RETURN jsonb_build_object('ok', false, 'error', 'no_spins'); END IF;
    UPDATE public.user_spin_states
    SET available_spins = jsonb_set(available_spins, ARRAY[p_tier], to_jsonb(v_avail - 1)), updated_at = now()
    WHERE user_id = v_user;
  END IF;

  -- Weighted draw
  SELECT COALESCE(sum(base_chance), 0) INTO v_total FROM public.spin_segments WHERE tier = p_tier AND is_active;
  IF v_total <= 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'no segments for tier'); END IF;
  v_rand := random() * v_total;
  FOR v_seg IN SELECT * FROM public.spin_segments WHERE tier = p_tier AND is_active ORDER BY sort_order LOOP
    v_cum := v_cum + v_seg.base_chance;
    IF v_rand <= v_cum THEN v_win := v_seg; EXIT; END IF;
    v_idx := v_idx + 1;
  END LOOP;
  IF v_win IS NULL THEN SELECT * INTO v_win FROM public.spin_segments WHERE tier = p_tier AND is_active ORDER BY sort_order LIMIT 1; v_idx := 0; END IF;

  -- Build reward + grant
  v_reward := CASE v_win.category
    WHEN 'coins'      THEN jsonb_build_object('type','coins','value',v_win.value,'quantity',1)
    WHEN 'xp'         THEN jsonb_build_object('type','xp','value',v_win.value,'quantity',1)
    WHEN 'ticket'     THEN jsonb_build_object('type','ticket','tier',COALESCE(v_win.reward_tier,'amateur'),'quantity',1)
    WHEN 'spin'       THEN jsonb_build_object('type','spin','tier',COALESCE(v_win.reward_tier,p_tier),'quantity',1)
    WHEN 'masterpass' THEN jsonb_build_object('type','masterpass','tier',COALESCE(v_win.reward_tier,p_tier),'name',v_win.label,'quantity',1)
    WHEN 'premium'    THEN jsonb_build_object('type','premium','value',COALESCE(v_win.value,7),'quantity',1)
    WHEN 'gift_card'  THEN jsonb_build_object('type','giftcard','value',v_win.value,'name',v_win.label,'quantity',1)
    ELSE NULL END;
  IF v_reward IS NOT NULL THEN
    BEGIN PERFORM public.distribute_reward_to_user(v_user, v_reward, 'spin', NULL);
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'spin grant failed: %', SQLERRM; END;
  END IF;

  -- History (best-effort)
  BEGIN PERFORM public.record_spin(v_user, p_tier, v_win.label, v_win.category);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('ok', true, 'segment_id', v_win.id, 'index', v_idx,
    'label', v_win.label, 'category', v_win.category, 'value', v_win.value, 'reward_tier', v_win.reward_tier);
END;
$$;
GRANT EXECUTE ON FUNCTION public.spin_wheel(TEXT) TO authenticated;
