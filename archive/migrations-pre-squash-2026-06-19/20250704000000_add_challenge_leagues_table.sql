/*
  Add challenge_leagues Junction Table

  This migration creates the challenge_leagues table which is a junction table
  between challenges and leagues. This allows challenges to be associated with
  multiple leagues.

  Required by challengeService.fetchChallengeCatalog() which tries to join
  challenges -> challenge_leagues -> leagues.
*/

-- Create challenge_leagues table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.challenge_leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(challenge_id, league_id)
);

-- Enable RLS
ALTER TABLE public.challenge_leagues ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow public read access to challenge_leagues" ON public.challenge_leagues;

-- Create read policy for all users
CREATE POLICY "Allow public read access to challenge_leagues"
  ON public.challenge_leagues
  FOR SELECT
  USING (true);

-- Create admin insert policy
DROP POLICY IF EXISTS "Allow admin to manage challenge_leagues" ON public.challenge_leagues;
CREATE POLICY "Allow admin to manage challenge_leagues"
  ON public.challenge_leagues
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Add comment
COMMENT ON TABLE public.challenge_leagues IS
  'Junction table linking challenges to leagues. Allows a challenge to be associated with multiple leagues.';

-- Verify table was created
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'challenge_leagues'
  AND tc.constraint_type = 'FOREIGN KEY';
