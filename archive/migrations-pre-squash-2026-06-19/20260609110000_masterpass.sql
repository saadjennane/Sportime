-- ─────────────────────────────────────────────────────────────────────────────
-- MasterPass (1+1): a tier pass that lets a player enter a tournament of that
-- tier AND bring one guest for free. The pass is consumed on use; if the guest
-- never joins the slot expires (pass lost — no refund).
-- ─────────────────────────────────────────────────────────────────────────────

-- Holdings: masterpasses a user owns.
CREATE TABLE IF NOT EXISTS public.user_masterpasses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tier       TEXT NOT NULL,                 -- amateur | master | apex
  status     TEXT NOT NULL DEFAULT 'available', -- available | used
  source     TEXT,
  used_at    TIMESTAMPTZ,
  used_competition_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_masterpasses_owner ON public.user_masterpasses(user_id, status, tier);
ALTER TABLE public.user_masterpasses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_masterpasses_own ON public.user_masterpasses;
CREATE POLICY user_masterpasses_own ON public.user_masterpasses FOR SELECT USING (user_id = auth.uid());
GRANT SELECT ON public.user_masterpasses TO authenticated;

-- Invite slots created when a masterpass is used.
CREATE TABLE IF NOT EXISTS public.tq_masterpass_invites (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.tq_competitions(id) ON DELETE CASCADE,
  inviter_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  masterpass_id  UUID REFERENCES public.user_masterpasses(id) ON DELETE SET NULL,
  tier           TEXT NOT NULL,
  token          TEXT NOT NULL UNIQUE,
  invitee_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'pending', -- pending | claimed | expired
  claimed_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_mp_invites_token ON public.tq_masterpass_invites(token);
CREATE INDEX IF NOT EXISTS idx_mp_invites_inviter ON public.tq_masterpass_invites(inviter_id, status);
ALTER TABLE public.tq_masterpass_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mp_invites_read ON public.tq_masterpass_invites;
CREATE POLICY mp_invites_read ON public.tq_masterpass_invites FOR SELECT
  USING (inviter_id = auth.uid() OR invitee_user_id = auth.uid());
GRANT SELECT ON public.tq_masterpass_invites TO authenticated;

-- Grant masterpasses into the holdings table (instead of the pending placeholder).
CREATE OR REPLACE FUNCTION public.distribute_reward_to_user(
  p_user_id UUID, p_reward JSONB, p_game_type TEXT DEFAULT NULL, p_game_id UUID DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_type TEXT := p_reward->>'type';
  v_value INT := COALESCE((p_reward->>'value')::INT, 0);
  v_tier TEXT := COALESCE(NULLIF(p_reward->>'tier',''), 'amateur');
  v_qty INT := GREATEST(1, COALESCE((p_reward->>'quantity')::INT, 1));
  v_status TEXT := 'fulfilled';
  v_days INT; i INT;
BEGIN
  CASE v_type
    WHEN 'coins' THEN PERFORM public.add_coins(p_user_id, v_value*v_qty, 'challenge_reward', jsonb_build_object('game_type',p_game_type,'game_id',p_game_id));
    WHEN 'xp' THEN BEGIN INSERT INTO public.activity_log(user_id,action_type,xp_gained,metadata) VALUES(p_user_id,'challenge_reward',v_value*v_qty,jsonb_build_object('game_id',p_game_id)); EXCEPTION WHEN OTHERS THEN NULL; END;
    WHEN 'ticket' THEN FOR i IN 1..v_qty LOOP PERFORM public.grant_ticket(p_user_id, v_tier::public.ticket_type, 'game_reward'); END LOOP;
    WHEN 'spin' THEN PERFORM public.grant_spin(p_user_id, v_tier, v_qty);
    WHEN 'masterpass' THEN
      FOR i IN 1..v_qty LOOP INSERT INTO public.user_masterpasses(user_id, tier, source) VALUES(p_user_id, v_tier, COALESCE(p_game_type,'reward')); END LOOP;
    WHEN 'premium_3d','premium_7d','premium' THEN
      v_days := (CASE v_type WHEN 'premium_3d' THEN 3 WHEN 'premium_7d' THEN 7 ELSE GREATEST(1,v_value) END)*v_qty;
      UPDATE public.users SET premium_expires_at = GREATEST(COALESCE(premium_expires_at,now()),now()) + (v_days||' days')::INTERVAL WHERE id=p_user_id;
    ELSE v_status := 'pending';
  END CASE;
  INSERT INTO public.reward_fulfillments(user_id,game_type,game_id,reward_type,value,name,tier,quantity,status)
  VALUES(p_user_id,p_game_type,p_game_id,v_type,v_value,p_reward->>'name',v_tier,v_qty,v_status);
END;
$$;

-- Use a masterpass to join a tournament + open a +1 invite slot. Returns the invite token.
CREATE OR REPLACE FUNCTION public.tq_use_masterpass(p_competition_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_tier TEXT; v_mp public.user_masterpasses; v_token TEXT; v_invite_id UUID;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not authenticated'); END IF;
  SELECT tier INTO v_tier FROM public.tq_competitions WHERE id = p_competition_id;
  IF v_tier IS NULL THEN RETURN jsonb_build_object('ok',false,'error','competition not found'); END IF;

  SELECT * INTO v_mp FROM public.user_masterpasses
  WHERE user_id = v_user AND tier = v_tier AND status = 'available' ORDER BY created_at LIMIT 1;
  IF v_mp.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','no_masterpass','tier',v_tier); END IF;

  -- join the owner (free) + consume the pass
  INSERT INTO public.tq_entries(user_id, competition_id) VALUES(v_user, p_competition_id) ON CONFLICT (user_id, competition_id) DO NOTHING;
  UPDATE public.user_masterpasses SET status='used', used_at=now(), used_competition_id=p_competition_id WHERE id=v_mp.id;

  -- open the +1 invite slot
  v_token := replace(gen_random_uuid()::text,'-','');
  INSERT INTO public.tq_masterpass_invites(competition_id, inviter_id, masterpass_id, tier, token)
  VALUES(p_competition_id, v_user, v_mp.id, v_tier, v_token) RETURNING id INTO v_invite_id;

  RETURN jsonb_build_object('ok',true,'invite_id',v_invite_id,'token',v_token,'competition_id',p_competition_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.tq_use_masterpass(UUID) TO authenticated;

-- Claim a +1 invite by token (the friend joins free). Works for any logged-in user.
CREATE OR REPLACE FUNCTION public.tq_claim_masterpass_invite(p_token TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_inv public.tq_masterpass_invites;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not authenticated'); END IF;
  SELECT * INTO v_inv FROM public.tq_masterpass_invites WHERE token = p_token;
  IF v_inv.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','invalid_invite'); END IF;
  IF v_inv.status <> 'pending' THEN RETURN jsonb_build_object('ok',false,'error','already_used'); END IF;
  IF v_inv.inviter_id = v_user THEN RETURN jsonb_build_object('ok',false,'error','cannot_claim_own'); END IF;

  INSERT INTO public.tq_entries(user_id, competition_id) VALUES(v_user, v_inv.competition_id) ON CONFLICT (user_id, competition_id) DO NOTHING;
  UPDATE public.tq_masterpass_invites SET status='claimed', claimed_by=v_user, claimed_at=now() WHERE id=v_inv.id;
  RETURN jsonb_build_object('ok',true,'competition_id',v_inv.competition_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.tq_claim_masterpass_invite(TEXT) TO authenticated;

-- Invite by username: attach the invitee + notify them in-app.
CREATE OR REPLACE FUNCTION public.tq_masterpass_invite_username(p_invite_id UUID, p_username TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid(); v_inv public.tq_masterpass_invites; v_target UUID; v_comp TEXT; v_me TEXT;
BEGIN
  SELECT * INTO v_inv FROM public.tq_masterpass_invites WHERE id = p_invite_id;
  IF v_inv.id IS NULL OR v_inv.inviter_id <> v_user THEN RETURN jsonb_build_object('ok',false,'error','not_your_invite'); END IF;
  IF v_inv.status <> 'pending' THEN RETURN jsonb_build_object('ok',false,'error','already_used'); END IF;
  SELECT id INTO v_target FROM public.users WHERE lower(username) = lower(p_username);
  IF v_target IS NULL THEN RETURN jsonb_build_object('ok',false,'error','user_not_found'); END IF;
  IF v_target = v_user THEN RETURN jsonb_build_object('ok',false,'error','cannot_invite_self'); END IF;

  UPDATE public.tq_masterpass_invites SET invitee_user_id = v_target WHERE id = p_invite_id;
  SELECT name INTO v_comp FROM public.tq_competitions WHERE id = v_inv.competition_id;
  SELECT username INTO v_me FROM public.users WHERE id = v_user;
  INSERT INTO public.notifications(user_id, type, title, message, action_label, action_link, metadata)
  VALUES(v_target, 'gameplay', 'MasterPass invite',
    COALESCE(v_me,'A player')||' invited you to join '||COALESCE(v_comp,'a tournament')||' — free entry!',
    'Join', 'sportime://masterpass/'||v_inv.token,
    jsonb_build_object('kind','masterpass_invite','token',v_inv.token,'competition_id',v_inv.competition_id));
  RETURN jsonb_build_object('ok',true,'invited',p_username);
END;
$$;
GRANT EXECUTE ON FUNCTION public.tq_masterpass_invite_username(UUID, TEXT) TO authenticated;
