-- Secure squad create/join via SECURITY DEFINER RPCs (the direct table inserts
-- were blocked by RLS in the app context). auth.uid() is still verified.
CREATE OR REPLACE FUNCTION public.create_squad(
  p_user_id UUID, p_name TEXT, p_description TEXT DEFAULT NULL, p_image_url TEXT DEFAULT NULL
) RETURNS public.squads
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_squad public.squads;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF length(trim(COALESCE(p_name, ''))) < 3 THEN RAISE EXCEPTION 'name_too_short'; END IF;

  INSERT INTO public.squads (name, description, image_url, created_by)
  VALUES (trim(p_name), NULLIF(trim(COALESCE(p_description, '')), ''), NULLIF(p_image_url, ''), p_user_id)
  RETURNING * INTO v_squad;
  -- trigger auto_add_squad_creator_as_admin adds the creator to squad_members.
  RETURN v_squad;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_squad(p_user_id UUID, p_invite_code TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_squad_id UUID;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT id INTO v_squad_id FROM public.squads WHERE invite_code = upper(trim(p_invite_code));
  IF v_squad_id IS NULL THEN RAISE EXCEPTION 'invalid_code'; END IF;

  INSERT INTO public.squad_members (squad_id, user_id, role)
  VALUES (v_squad_id, p_user_id, 'member')
  ON CONFLICT (squad_id, user_id) DO NOTHING;

  RETURN v_squad_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_squad(UUID, TEXT, TEXT, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.join_squad(UUID, TEXT) TO authenticated, anon, service_role;
