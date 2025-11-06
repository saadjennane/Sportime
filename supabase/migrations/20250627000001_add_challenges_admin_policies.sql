/*
  Add RLS policies for challenge management by admins

  Currently only SELECT is allowed (public read).
  This adds INSERT, UPDATE, DELETE policies for admins.
*/

-- Allow admins to create challenges
CREATE POLICY "Allow admin to create challenges"
  ON public.challenges
  FOR INSERT
  WITH CHECK (public.is_admin());

-- Allow admins to update challenges
CREATE POLICY "Allow admin to update challenges"
  ON public.challenges
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Allow admins to delete challenges
CREATE POLICY "Allow admin to delete challenges"
  ON public.challenges
  FOR DELETE
  USING (public.is_admin());

-- Same for challenge_configs
CREATE POLICY "Allow admin to manage challenge_configs"
  ON public.challenge_configs
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Same for challenge_leagues
CREATE POLICY "Allow admin to manage challenge_leagues"
  ON public.challenge_leagues
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Same for challenge_matches
CREATE POLICY "Allow admin to manage challenge_matches"
  ON public.challenge_matches
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
