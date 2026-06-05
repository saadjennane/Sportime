-- ============================================================================
-- ADD UNIQUE CONSTRAINT TO PLAYER_TEAM_ASSOCIATION
-- ============================================================================

-- This will ensure that a player can only be associated with a team once
-- It will also allow the upsert operation to work correctly with onConflict

-- First, remove any duplicate entries (if they exist)
DELETE FROM player_team_association a
USING player_team_association b
WHERE a.id > b.id
  AND a.player_id = b.player_id
  AND a.team_id = b.team_id;

-- Add the unique constraint
ALTER TABLE player_team_association
ADD CONSTRAINT player_team_association_player_team_unique
UNIQUE (player_id, team_id);

-- Verify the constraint was created
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'player_team_association'
  AND tc.constraint_type = 'UNIQUE'
ORDER BY kcu.ordinal_position;
