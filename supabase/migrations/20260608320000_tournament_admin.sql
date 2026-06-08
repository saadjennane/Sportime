-- ============================================================================
-- TOURNAMENT QUEST — admin back-office access (anon-key admin, guarded by is_admin).
-- Admin write policies on the catalog tables + admin-only action wrappers.
-- ============================================================================

-- Admin write policies (read stays public; admins may write everything).
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['tq_competitions','tq_teams','tq_groups','tq_group_teams','tq_matches','tq_phase_windows','tq_players'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %1$s_admin ON public.%1$I;', t);
    EXECUTE format('CREATE POLICY %1$s_admin ON public.%1$I FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());', t);
  END LOOP;
END $$;

GRANT INSERT, UPDATE, DELETE ON
  public.tq_competitions, public.tq_teams, public.tq_groups, public.tq_group_teams,
  public.tq_matches, public.tq_phase_windows, public.tq_players
  TO authenticated;

-- Admin action wrappers (is_admin guard, callable by authenticated admins).
CREATE OR REPLACE FUNCTION public.tq_admin_resolve(p_comp UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  RETURN public.tq_resolve(p_comp);
END; $$;
GRANT EXECUTE ON FUNCTION public.tq_admin_resolve(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tq_admin_generate_bracket(p_comp UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  RETURN public.tq_generate_bracket(p_comp);
END; $$;
GRANT EXECUTE ON FUNCTION public.tq_admin_generate_bracket(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tq_admin_advance_round(p_comp UUID, p_from TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  RETURN public.tq_advance_round(p_comp, p_from);
END; $$;
GRANT EXECUTE ON FUNCTION public.tq_admin_advance_round(UUID, TEXT) TO authenticated, service_role;

-- Bulk-create groups + teams from a compact spec (one entry per group):
-- p_spec = [{ "name":"Group A", "qualified":2, "teams":[{"name":"Morocco","short":"MAR","flag":"..."}, ...] }, ...]
CREATE OR REPLACE FUNCTION public.tq_admin_import_groups(p_comp UUID, p_spec JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g JSONB; tm JSONB; v_grp UUID; v_team UUID; gi INT := 0; ti INT; n_groups INT := 0; n_teams INT := 0;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  FOR g IN SELECT * FROM jsonb_array_elements(p_spec) LOOP
    v_grp := gen_random_uuid();
    INSERT INTO public.tq_groups (id, competition_id, name, sort_order, qualified_count)
    VALUES (v_grp, p_comp, COALESCE(g->>'name','Group ' || chr(65+gi)), gi, COALESCE((g->>'qualified')::int, 2));
    n_groups := n_groups + 1; ti := 0;
    FOR tm IN SELECT * FROM jsonb_array_elements(COALESCE(g->'teams','[]'::jsonb)) LOOP
      ti := ti + 1;
      INSERT INTO public.tq_teams (id, competition_id, name, short_name, flag_url)
      VALUES (gen_random_uuid(), p_comp, tm->>'name', tm->>'short', tm->>'flag')
      RETURNING id INTO v_team;
      INSERT INTO public.tq_group_teams (group_id, team_id, seed_order) VALUES (v_grp, v_team, ti);
      n_teams := n_teams + 1;
    END LOOP;
    gi := gi + 1;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'groups', n_groups, 'teams', n_teams);
END; $$;
GRANT EXECUTE ON FUNCTION public.tq_admin_import_groups(UUID, JSONB) TO authenticated, service_role;
