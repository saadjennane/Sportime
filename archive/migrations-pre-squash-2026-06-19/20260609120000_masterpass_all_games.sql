-- Generalise MasterPass 1+1 to all 4 games (tournament / betting / prediction / fantasy).
-- Entry tables: tournament -> tq_entries ; the others -> challenge_participants.

ALTER TABLE public.tq_masterpass_invites ADD COLUMN IF NOT EXISTS game_type TEXT NOT NULL DEFAULT 'tournament';
ALTER TABLE public.tq_masterpass_invites ADD COLUMN IF NOT EXISTS game_id UUID;
UPDATE public.tq_masterpass_invites SET game_id = competition_id WHERE game_id IS NULL;
ALTER TABLE public.tq_masterpass_invites ALTER COLUMN competition_id DROP NOT NULL;

-- Resolve a game's tier.
CREATE OR REPLACE FUNCTION public._mp_game_tier(p_game_type TEXT, p_game_id UUID)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v TEXT;
BEGIN
  IF p_game_type = 'tournament' THEN SELECT tier INTO v FROM public.tq_competitions WHERE id = p_game_id;
  ELSIF p_game_type = 'fantasy' THEN SELECT tier INTO v FROM public.fantasy_games WHERE id = p_game_id;
  ELSE SELECT rules->>'tier' INTO v FROM public.challenges WHERE id = p_game_id;
  END IF;
  RETURN v;
END; $$;

-- Create a FREE entry for a user in any game type.
CREATE OR REPLACE FUNCTION public._mp_create_entry(p_game_type TEXT, p_game_id UUID, p_user UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_game_type = 'tournament' THEN
    INSERT INTO public.tq_entries(user_id, competition_id) VALUES(p_user, p_game_id) ON CONFLICT (user_id, competition_id) DO NOTHING;
  ELSE
    INSERT INTO public.challenge_participants(challenge_id, user_id) VALUES(p_game_id, p_user) ON CONFLICT DO NOTHING;
  END IF;
END; $$;

-- Use a masterpass on any game: free entry + consume + open a +1 invite. Returns token.
CREATE OR REPLACE FUNCTION public.use_masterpass(p_game_type TEXT, p_game_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_tier TEXT; v_mp public.user_masterpasses; v_token TEXT; v_invite_id UUID;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not authenticated'); END IF;
  IF p_game_type NOT IN ('tournament','betting','prediction','fantasy') THEN RETURN jsonb_build_object('ok',false,'error','bad game type'); END IF;
  v_tier := public._mp_game_tier(p_game_type, p_game_id);
  IF v_tier IS NULL THEN RETURN jsonb_build_object('ok',false,'error','game not found or no tier'); END IF;

  SELECT * INTO v_mp FROM public.user_masterpasses WHERE user_id=v_user AND tier=v_tier AND status='available' ORDER BY created_at LIMIT 1;
  IF v_mp.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','no_masterpass','tier',v_tier); END IF;

  PERFORM public._mp_create_entry(p_game_type, p_game_id, v_user);
  UPDATE public.user_masterpasses SET status='used', used_at=now(), used_competition_id=p_game_id WHERE id=v_mp.id;

  v_token := replace(gen_random_uuid()::text,'-','');
  INSERT INTO public.tq_masterpass_invites(competition_id, game_type, game_id, inviter_id, masterpass_id, tier, token)
  VALUES(CASE WHEN p_game_type='tournament' THEN p_game_id ELSE NULL END, p_game_type, p_game_id, v_user, v_mp.id, v_tier, v_token)
  RETURNING id INTO v_invite_id;

  RETURN jsonb_build_object('ok',true,'invite_id',v_invite_id,'token',v_token,'game_type',p_game_type,'game_id',p_game_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.use_masterpass(TEXT, UUID) TO authenticated;

-- Claim a +1 invite by token (friend joins free) — any game type.
CREATE OR REPLACE FUNCTION public.tq_claim_masterpass_invite(p_token TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_inv public.tq_masterpass_invites;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not authenticated'); END IF;
  SELECT * INTO v_inv FROM public.tq_masterpass_invites WHERE token = p_token;
  IF v_inv.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','invalid_invite'); END IF;
  IF v_inv.status <> 'pending' THEN RETURN jsonb_build_object('ok',false,'error','already_used'); END IF;
  IF v_inv.inviter_id = v_user THEN RETURN jsonb_build_object('ok',false,'error','cannot_claim_own'); END IF;

  PERFORM public._mp_create_entry(v_inv.game_type, v_inv.game_id, v_user);
  UPDATE public.tq_masterpass_invites SET status='claimed', claimed_by=v_user, claimed_at=now() WHERE id=v_inv.id;
  RETURN jsonb_build_object('ok',true,'game_type',v_inv.game_type,'game_id',v_inv.game_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.tq_claim_masterpass_invite(TEXT) TO authenticated;
