-- challenge_participants now tracks participation for challenges (betting/swipe)
-- AND fantasy games (separate fantasy_games table). The FK to challenges blocked
-- fantasy joins ('challenge_id' violates ..._challenge_id_fkey). Drop it so the
-- column is polymorphic across challenges + fantasy_games.
ALTER TABLE public.challenge_participants
  DROP CONSTRAINT IF EXISTS challenge_participants_challenge_id_fkey;
