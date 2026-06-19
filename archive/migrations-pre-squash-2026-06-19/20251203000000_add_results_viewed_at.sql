/*
  Add results_viewed_at column to challenge_participants table

  This column tracks when a user has viewed the final results of a game.
  A game moves to "Past Games" only when:
  1. end_date has passed
  2. AND results_viewed_at is not null (user clicked "View Results")

  This replaces the localStorage-based tracking for persistence across sessions/devices.
*/

ALTER TABLE public.challenge_participants
ADD COLUMN IF NOT EXISTS results_viewed_at TIMESTAMPTZ DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.challenge_participants.results_viewed_at IS
  'Timestamp when user viewed final results. Used to move game to Past Games section.';
