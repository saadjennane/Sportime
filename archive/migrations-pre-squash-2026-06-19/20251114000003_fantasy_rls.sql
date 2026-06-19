/*
  Fantasy Game Row Level Security (RLS) Policies

  Security policies for Fantasy tables:
  - fantasy_players: Public read (all users can see available players)
  - fantasy_games: Public read
  - fantasy_game_weeks: Public read
  - user_fantasy_teams: Users can only manage their own teams
  - fantasy_boosters: Public read
  - fantasy_leaderboard: Public read
*/

-- ============================================================================
-- Enable RLS on all Fantasy tables
-- ============================================================================

ALTER TABLE fantasy_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_game_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_fantasy_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_boosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_leaderboard ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- fantasy_players: Public read access
-- ============================================================================

CREATE POLICY "fantasy_players_select_public"
  ON fantasy_players
  FOR SELECT
  USING (true);

COMMENT ON POLICY "fantasy_players_select_public" ON fantasy_players IS
  'All users can view available Fantasy players';

-- ============================================================================
-- fantasy_games: Public read access
-- ============================================================================

CREATE POLICY "fantasy_games_select_public"
  ON fantasy_games
  FOR SELECT
  USING (true);

COMMENT ON POLICY "fantasy_games_select_public" ON fantasy_games IS
  'All users can view Fantasy games';

-- ============================================================================
-- fantasy_game_weeks: Public read access
-- ============================================================================

CREATE POLICY "fantasy_game_weeks_select_public"
  ON fantasy_game_weeks
  FOR SELECT
  USING (true);

COMMENT ON POLICY "fantasy_game_weeks_select_public" ON fantasy_game_weeks IS
  'All users can view game weeks';

-- ============================================================================
-- user_fantasy_teams: Users can only manage their own teams
-- ============================================================================

CREATE POLICY "user_fantasy_teams_select_own"
  ON user_fantasy_teams
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_fantasy_teams_insert_own"
  ON user_fantasy_teams
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_fantasy_teams_update_own"
  ON user_fantasy_teams
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_fantasy_teams_delete_own"
  ON user_fantasy_teams
  FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON POLICY "user_fantasy_teams_select_own" ON user_fantasy_teams IS
  'Users can only view their own Fantasy teams';

COMMENT ON POLICY "user_fantasy_teams_insert_own" ON user_fantasy_teams IS
  'Users can only create their own Fantasy teams';

COMMENT ON POLICY "user_fantasy_teams_update_own" ON user_fantasy_teams IS
  'Users can only update their own Fantasy teams';

COMMENT ON POLICY "user_fantasy_teams_delete_own" ON user_fantasy_teams IS
  'Users can only delete their own Fantasy teams';

-- ============================================================================
-- fantasy_boosters: Public read access
-- ============================================================================

CREATE POLICY "fantasy_boosters_select_public"
  ON fantasy_boosters
  FOR SELECT
  USING (true);

COMMENT ON POLICY "fantasy_boosters_select_public" ON fantasy_boosters IS
  'All users can view available boosters';

-- ============================================================================
-- fantasy_leaderboard: Public read access
-- ============================================================================

CREATE POLICY "fantasy_leaderboard_select_public"
  ON fantasy_leaderboard
  FOR SELECT
  USING (true);

COMMENT ON POLICY "fantasy_leaderboard_select_public" ON fantasy_leaderboard IS
  'All users can view Fantasy leaderboards';

-- ============================================================================
-- Admin policies for Fantasy management (future use)
-- ============================================================================

-- Note: Admin-only operations (updating player stats, processing game weeks, etc.)
-- should be handled via service role key, not through RLS policies.
-- These operations will be performed by:
-- 1. Edge Functions (with service role key)
-- 2. Admin panel (with service role key)
-- 3. Cron jobs (with service role key)
