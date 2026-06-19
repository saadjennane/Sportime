-- Admins can fully manage challenges + fantasy_games directly (mirrors tq_competitions_admin).
-- These tables only had SELECT policies, so admin status toggles / deletes were blocked by RLS.
DROP POLICY IF EXISTS challenges_admin ON public.challenges;
CREATE POLICY challenges_admin ON public.challenges FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS fantasy_games_admin ON public.fantasy_games;
CREATE POLICY fantasy_games_admin ON public.fantasy_games FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
