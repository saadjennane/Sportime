-- ============================================================================
-- Squad member administration (admin-only, server-authoritative):
--   make/remove admin, remove member, block member (+ block list so they can't
--   rejoin). All via SECURITY DEFINER RPCs that verify the actor is an admin.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.squad_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id UUID NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blocked_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (squad_id, user_id)
);
ALTER TABLE public.squad_blocks ENABLE ROW LEVEL SECURITY;

-- Guard helper: actor must be the caller AND an admin of the squad; target must
-- not be the squad creator.
CREATE OR REPLACE FUNCTION public._squad_admin_guard(p_actor UUID, p_squad_id UUID, p_target UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_creator UUID;
BEGIN
  IF p_actor IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.squad_members WHERE squad_id = p_squad_id AND user_id = p_actor AND role = 'admin') THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  SELECT created_by INTO v_creator FROM public.squads WHERE id = p_squad_id;
  IF p_target = v_creator THEN RAISE EXCEPTION 'cannot_target_creator'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.squad_set_member_role(p_actor UUID, p_squad_id UUID, p_target UUID, p_role TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_role NOT IN ('admin', 'member') THEN RAISE EXCEPTION 'invalid_role'; END IF;
  PERFORM public._squad_admin_guard(p_actor, p_squad_id, p_target);
  UPDATE public.squad_members SET role = p_role WHERE squad_id = p_squad_id AND user_id = p_target;
END;
$$;

CREATE OR REPLACE FUNCTION public.squad_remove_member(p_actor UUID, p_squad_id UUID, p_target UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._squad_admin_guard(p_actor, p_squad_id, p_target);
  DELETE FROM public.squad_members WHERE squad_id = p_squad_id AND user_id = p_target;
END;
$$;

CREATE OR REPLACE FUNCTION public.squad_block_member(p_actor UUID, p_squad_id UUID, p_target UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._squad_admin_guard(p_actor, p_squad_id, p_target);
  DELETE FROM public.squad_members WHERE squad_id = p_squad_id AND user_id = p_target;
  INSERT INTO public.squad_blocks (squad_id, user_id, blocked_by)
  VALUES (p_squad_id, p_target, p_actor)
  ON CONFLICT (squad_id, user_id) DO NOTHING;
END;
$$;

-- join_squad now rejects blocked users.
CREATE OR REPLACE FUNCTION public.join_squad(p_user_id UUID, p_invite_code TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_squad_id UUID;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT id INTO v_squad_id FROM public.squads WHERE invite_code = upper(trim(p_invite_code));
  IF v_squad_id IS NULL THEN RAISE EXCEPTION 'invalid_code'; END IF;
  IF EXISTS (SELECT 1 FROM public.squad_blocks WHERE squad_id = v_squad_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'blocked';
  END IF;
  INSERT INTO public.squad_members (squad_id, user_id, role)
  VALUES (v_squad_id, p_user_id, 'member')
  ON CONFLICT (squad_id, user_id) DO NOTHING;
  RETURN v_squad_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._squad_admin_guard(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.squad_set_member_role(UUID, UUID, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.squad_remove_member(UUID, UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.squad_block_member(UUID, UUID, UUID) TO authenticated, service_role;
