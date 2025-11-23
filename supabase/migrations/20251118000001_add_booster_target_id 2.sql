-- Add booster_target_id column to user_fantasy_teams table
-- This field stores which player is targeted by the Recovery Boost

ALTER TABLE user_fantasy_teams
ADD COLUMN IF NOT EXISTS booster_target_id UUID REFERENCES fantasy_players(id);

CREATE INDEX IF NOT EXISTS idx_user_fantasy_teams_booster_target
ON user_fantasy_teams(booster_target_id);

COMMENT ON COLUMN user_fantasy_teams.booster_target_id IS
  'Player UUID targeted by Recovery Boost (booster_used=3). Restores fatigue to 100% if player plays. Refunded if player DNP.';
