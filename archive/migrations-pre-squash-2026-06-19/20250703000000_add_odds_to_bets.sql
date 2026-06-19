/*
  Add Odds Snapshot to Challenge Bets

  This migration adds odds storage to challenge bets to capture the odds
  at the time the bet was placed, ensuring accuracy even if odds change later.

  Tables affected:
  - challenge_bets (add odds_snapshot column)

  Purpose:
  - Store odds as JSONB: { teamA: number, draw: number, teamB: number }
  - Capture odds at bet placement time
  - Enable accurate points calculation regardless of odds changes
*/

-- Add odds_snapshot column to challenge_bets
ALTER TABLE public.challenge_bets
ADD COLUMN IF NOT EXISTS odds_snapshot JSONB;

-- Add comment explaining the column
COMMENT ON COLUMN public.challenge_bets.odds_snapshot IS
  'Snapshot of odds at the time the bet was placed. Format: { "teamA": 2.0, "draw": 3.2, "teamB": 2.4 }. Ensures accurate point calculation even if odds change later.';

-- Create index for faster JSON queries (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_challenge_bets_odds_snapshot
  ON public.challenge_bets USING GIN (odds_snapshot);

-- Verification: Show updated schema
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'challenge_bets'
  AND column_name = 'odds_snapshot';
