/*
  Fix RLS policies for challenge participation

  The join_betting_challenge function uses SECURITY DEFINER but may fail
  if RLS policies are not properly configured for all involved tables.
*/

-- Ensure challenge_participants has proper RLS policies
DROP POLICY IF EXISTS "Allow users to see their own participation" ON public.challenge_participants;
DROP POLICY IF EXISTS "Allow users to join challenges" ON public.challenge_participants;
DROP POLICY IF EXISTS "Allow users to update their participation" ON public.challenge_participants;

-- Public can see all participants (for counting, leaderboards, etc.)
CREATE POLICY "Allow public read access to challenge participants"
  ON public.challenge_participants
  FOR SELECT
  USING (true);

-- Authenticated users can insert themselves as participants
CREATE POLICY "Allow authenticated users to join challenges"
  ON public.challenge_participants
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own participation
CREATE POLICY "Allow users to update own participation"
  ON public.challenge_participants
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can manage all participants
CREATE POLICY "Allow admin to manage challenge participants"
  ON public.challenge_participants
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
