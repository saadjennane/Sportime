-- ============================================================================
-- Connect any game type (betting / swipe / fantasy / live) to squads.
-- squad_games.game_id had a FK to challenges only -> make it polymorphic with a
-- game_type column. Link/unlink go through SECURITY DEFINER RPCs (RLS-safe).
-- ============================================================================
ALTER TABLE public.squad_games DROP CONSTRAINT IF EXISTS squad_games_game_id_fkey;
ALTER TABLE public.squad_games ADD COLUMN IF NOT EXISTS game_type TEXT NOT NULL DEFAULT 'betting';

-- Link a game to one or more squads the user belongs to. Returns rows inserted.
CREATE OR REPLACE FUNCTION public.link_game_to_squads(
  p_user_id UUID, p_game_id UUID, p_game_type TEXT, p_squad_ids UUID[]
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_squad UUID; v_count INTEGER := 0;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  FOREACH v_squad IN ARRAY p_squad_ids LOOP
    IF EXISTS (SELECT 1 FROM public.squad_members m WHERE m.squad_id = v_squad AND m.user_id = p_user_id) THEN
      INSERT INTO public.squad_games (squad_id, game_id, game_type, linked_by)
      VALUES (v_squad, p_game_id, COALESCE(p_game_type, 'betting'), p_user_id)
      ON CONFLICT (squad_id, game_id) DO NOTHING;
      IF FOUND THEN v_count := v_count + 1; END IF;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.unlink_squad_game(
  p_user_id UUID, p_squad_id UUID, p_game_id UUID
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.squad_members m WHERE m.squad_id = p_squad_id AND m.user_id = p_user_id) THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;
  DELETE FROM public.squad_games WHERE squad_id = p_squad_id AND game_id = p_game_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_game_to_squads(UUID, UUID, TEXT, UUID[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unlink_squad_game(UUID, UUID, UUID) TO authenticated, service_role;
