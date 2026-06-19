-- Allow admins to write the API-Football staging tables (the admin sync was blocked by RLS).
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['fb_leagues','fb_teams','fb_players','fb_fixtures','fb_team_league_participation','fb_player_team_association'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS %1$s_admin_write ON public.%1$I;', t);
    EXECUTE format('CREATE POLICY %1$s_admin_write ON public.%1$I FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());', t);
    EXECUTE format('GRANT INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
  END LOOP;
END $$;
