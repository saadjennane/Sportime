-- ============================================================================
-- FIX CHALLENGE BETS FOREIGN KEY FOR BETTING GAMES WITH MATCHDAYS
-- ============================================================================
-- Problem: challenge_bets.challenge_match_id references challenge_matches(id)
-- but betting games with matchdays use fb_fixtures.id directly.
--
-- Solution: Remove the FK constraint so betting games can store fb_fixtures.id
-- ============================================================================

-- Drop the existing foreign key constraint
ALTER TABLE public.challenge_bets
DROP CONSTRAINT IF EXISTS challenge_bets_challenge_match_id_fkey;

-- Also drop the FK on challenge_daily_entries for booster_match_id
ALTER TABLE public.challenge_daily_entries
DROP CONSTRAINT IF EXISTS challenge_daily_entries_booster_match_id_fkey;

-- Add a comment to explain the change
COMMENT ON COLUMN public.challenge_bets.challenge_match_id IS
'Match ID - can be either challenge_matches.id (for old-style challenges) or fb_fixtures.id (for betting games with matchdays)';

COMMENT ON COLUMN public.challenge_daily_entries.booster_match_id IS
'Match ID for booster - can be either challenge_matches.id or fb_fixtures.id';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- The challenge_match_id column now accepts any UUID:
-- - For old-style betting challenges: challenge_matches.id
-- - For matchday-based betting games: fb_fixtures.id
--
-- The application code is responsible for validating the match exists.
-- ============================================================================
