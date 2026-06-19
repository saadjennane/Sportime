/*
  Fix Challenge Leagues Foreign Key to Leagues

  This migration adds the missing foreign key constraint from challenge_leagues
  to leagues table. This foreign key was supposed to be created in migration 11
  but was not successfully applied.

  Required for Supabase PostgREST to follow the relationship:
  challenges -> challenge_leagues -> leagues
*/

-- Add the missing foreign key to leagues table
-- First, drop the constraint if it exists (to make this migration idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'challenge_leagues_league_id_fkey'
    AND table_name = 'challenge_leagues'
  ) THEN
    ALTER TABLE public.challenge_leagues
    DROP CONSTRAINT challenge_leagues_league_id_fkey;
  END IF;
END $$;

-- Now add the constraint
ALTER TABLE public.challenge_leagues
ADD CONSTRAINT challenge_leagues_league_id_fkey
FOREIGN KEY (league_id)
REFERENCES public.leagues(id)
ON DELETE CASCADE;

-- Verify the constraint was created
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.table_name = 'challenge_leagues'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.constraint_name;
