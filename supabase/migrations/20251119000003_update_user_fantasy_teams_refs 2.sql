-- Update user_fantasy_teams to reference players table instead of fantasy_players
-- This migration updates the captain_id foreign key constraint

-- Drop old captain_id foreign key constraint
ALTER TABLE user_fantasy_teams
DROP CONSTRAINT IF EXISTS user_fantasy_teams_captain_id_fkey;

-- Add new captain_id foreign key pointing to players table
ALTER TABLE user_fantasy_teams
ADD CONSTRAINT user_fantasy_teams_captain_id_fkey
  FOREIGN KEY (captain_id)
  REFERENCES players(id)
  ON DELETE SET NULL;

-- Update comment to reflect that starters/substitutes now reference players.id
COMMENT ON COLUMN user_fantasy_teams.starters IS
  'Array of 7 player UUIDs from players table. Must follow composition: 1 GK, 2-3 DEF, 2-3 MID, 1-2 ATT';

COMMENT ON COLUMN user_fantasy_teams.substitutes IS
  'Array of up to 2 substitute player UUIDs from players table';

COMMENT ON COLUMN user_fantasy_teams.captain_id IS
  'Captain player UUID from players table. Captain gets +10% points (or x2.2 with Double Impact booster)';

COMMENT ON COLUMN user_fantasy_teams.fatigue_state IS
  'JSON object storing per-user fatigue percentages for each player: {"player_uuid_1": 85, "player_uuid_2": 100, ...}. Fatigue is user-specific and managed independently per user.';
