-- ─────────────────────────────────────────────────────────────────────────────
-- Reward fulfillment: grant a game's reward pack to its winners.
-- Reuses canonical primitives (add_coins / grant_ticket / grant_spin / premium).
-- Fixes a latent bug: the previous distribute_reward_to_user wrote coin_balance
-- (the real column is coins_balance) so coins were silently never credited.
-- ─────────────────────────────────────────────────────────────────────────────

-- Distribution flags + manual-fulfillment queue / audit.
ALTER TABLE public.tq_competitions ADD COLUMN IF NOT EXISTS rewards_distributed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.fantasy_games    ADD COLUMN IF NOT EXISTS rewards_distributed BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.reward_fulfillments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL,
  game_type    TEXT,
  game_id      UUID,
  reward_type  TEXT NOT NULL,
  value        INTEGER,
  name         TEXT,
  tier         TEXT,
  quantity     INTEGER NOT NULL DEFAULT 1,
  status       TEXT NOT NULL DEFAULT 'fulfilled',  -- fulfilled | pending (manual) | failed
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reward_fulfillments_user ON public.reward_fulfillments(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_fulfillments_status ON public.reward_fulfillments(status);
ALTER TABLE public.reward_fulfillments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reward_fulfillments_admin ON public.reward_fulfillments;
CREATE POLICY reward_fulfillments_admin ON public.reward_fulfillments FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS reward_fulfillments_own ON public.reward_fulfillments;
CREATE POLICY reward_fulfillments_own ON public.reward_fulfillments FOR SELECT USING (user_id = auth.uid());
GRANT SELECT ON public.reward_fulfillments TO authenticated;

-- Grant a single reward item to a user (handles quantity). Records an audit row.
DROP FUNCTION IF EXISTS public.distribute_reward_to_user(UUID, JSONB);
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
      PERFORM public.add_coins(p_user_id, v_value * v_qty, 'game_reward',
        jsonb_build_object('game_type', p_game_type, 'game_id', p_game_id));
    WHEN 'xp' THEN
      INSERT INTO public.activity_log (user_id, action_type, xp_gained, metadata)
      VALUES (p_user_id, 'game_reward', v_value * v_qty, jsonb_build_object('game_id', p_game_id));
    WHEN 'ticket' THEN
      FOR i IN 1..v_qty LOOP PERFORM public.grant_ticket(p_user_id, v_tier::public.ticket_type, 'game_reward'); END LOOP;
    WHEN 'spin' THEN
      PERFORM public.grant_spin(p_user_id, v_tier, v_qty);
    WHEN 'premium_3d', 'premium_7d' THEN
      v_days := (CASE v_type WHEN 'premium_3d' THEN 3 ELSE 7 END) * v_qty;
      UPDATE public.users
      SET premium_expires_at = GREATEST(COALESCE(premium_expires_at, now()), now()) + (v_days || ' days')::INTERVAL
      WHERE id = p_user_id;
    ELSE -- giftcard, masterpass, custom → manual fulfillment
      v_status := 'pending';
  END CASE;

  INSERT INTO public.reward_fulfillments (user_id, game_type, game_id, reward_type, value, name, tier, quantity, status)
  VALUES (p_user_id, p_game_type, p_game_id, v_type, v_value, p_reward->>'name', v_tier, v_qty, v_status);
END;
$$;
GRANT EXECUTE ON FUNCTION public.distribute_reward_to_user(UUID, JSONB, TEXT, UUID) TO authenticated, anon, service_role;

-- Distribute a game's reward pack to its winners. Idempotent (per-game flag).
-- p_type: 'tq' | 'betting' | 'prediction' | 'fantasy'
CREATE OR REPLACE FUNCTION public.gb_distribute_rewards(p_type TEXT, p_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rewards JSONB;
  v_done    BOOLEAN;
  v_total   INT;
  v_tier    JSONB;
  v_reward  JSONB;
  v_ptype   TEXT; v_start NUMERIC; v_end NUMERIC; v_lo INT; v_hi INT;
  v_user    UUID;
  v_granted INT := 0;
BEGIN
  -- 1) Resolve rewards + the already-distributed flag.
  IF p_type = 'tq' THEN
    SELECT rewards_json, rewards_distributed INTO v_rewards, v_done FROM public.tq_competitions WHERE id = p_id;
  ELSIF p_type IN ('betting','prediction') THEN
    SELECT prizes, prizes_distributed INTO v_rewards, v_done FROM public.challenges WHERE id = p_id;
  ELSIF p_type = 'fantasy' THEN
    SELECT prizes, rewards_distributed INTO v_rewards, v_done FROM public.fantasy_games WHERE id = p_id;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'unknown game type');
  END IF;

  IF v_done THEN RETURN jsonb_build_object('ok', true, 'skipped', 'already distributed'); END IF;
  IF v_rewards IS NULL OR jsonb_typeof(v_rewards) <> 'array' OR jsonb_array_length(v_rewards) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no reward pack assigned');
  END IF;

  -- 2) Build the ranked winner set into a temp table (user_id, rank).
  CREATE TEMP TABLE _ranked (user_id UUID, rank INT) ON COMMIT DROP;
  IF p_type = 'tq' THEN
    INSERT INTO _ranked SELECT user_id, rank FROM public.tq_leaderboard WHERE competition_id = p_id AND rank IS NOT NULL;
  ELSIF p_type IN ('betting','prediction') THEN
    INSERT INTO _ranked SELECT user_id, rank FROM public.challenge_participants WHERE challenge_id = p_id AND rank IS NOT NULL;
  ELSE -- fantasy: aggregate points across the game's gameweeks
    INSERT INTO _ranked
      SELECT user_id, RANK() OVER (ORDER BY SUM(total_points) DESC)::INT
      FROM public.fantasy_leaderboard WHERE game_id = p_id GROUP BY user_id;
  END IF;
  SELECT count(*) INTO v_total FROM _ranked;
  IF v_total = 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'no ranked players'); END IF;

  -- 3) Apply each bracket → winners → grant each reward.
  FOR v_tier IN SELECT * FROM jsonb_array_elements(v_rewards) LOOP
    v_ptype := COALESCE(v_tier->>'positionType', 'rank');
    v_start := COALESCE((v_tier->>'start')::NUMERIC, 1);
    v_end   := COALESCE((v_tier->>'end')::NUMERIC, v_start);
    IF v_ptype = 'participation' THEN
      v_lo := 1; v_hi := v_total;
    ELSIF v_ptype = 'percent' THEN
      v_lo := GREATEST(1, CEIL(v_start / 100.0 * v_total)::INT);
      v_hi := GREATEST(v_lo, CEIL(v_end / 100.0 * v_total)::INT);
    ELSE -- rank | range
      v_lo := GREATEST(1, v_start::INT);
      v_hi := GREATEST(v_lo, v_end::INT);
    END IF;

    FOR v_user IN SELECT user_id FROM _ranked WHERE rank BETWEEN v_lo AND v_hi LOOP
      IF jsonb_typeof(v_tier->'rewards') = 'array' THEN
        FOR v_reward IN SELECT * FROM jsonb_array_elements(v_tier->'rewards') LOOP
          BEGIN
            PERFORM public.distribute_reward_to_user(v_user, v_reward, p_type, p_id);
            v_granted := v_granted + 1;
          EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'grant failed for % : %', v_user, SQLERRM;
          END;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;

  -- 4) Mark distributed.
  IF p_type = 'tq' THEN
    UPDATE public.tq_competitions SET rewards_distributed = true, status = 'resolved' WHERE id = p_id;
  ELSIF p_type IN ('betting','prediction') THEN
    UPDATE public.challenges SET prizes_distributed = true, status = 'finished' WHERE id = p_id;
  ELSE
    UPDATE public.fantasy_games SET rewards_distributed = true, status = 'Finished' WHERE id = p_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'players', v_total, 'grants', v_granted);
END;
$$;
GRANT EXECUTE ON FUNCTION public.gb_distribute_rewards(TEXT, UUID) TO authenticated, service_role;
