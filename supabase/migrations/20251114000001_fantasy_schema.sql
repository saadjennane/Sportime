/*
  Fantasy Game Schema

  Creates all tables required for the Fantasy game mode:
  - fantasy_players: Pool of players available for Fantasy teams
  - fantasy_games: Fantasy game seasons/competitions
  - fantasy_game_weeks: Individual game weeks within a Fantasy game
  - user_fantasy_teams: User teams for each game week
  - fantasy_boosters: Available boosters (Double Impact, Golden Game, Recovery)
  - fantasy_leaderboard: Rankings for each game week

  Team Composition Rules:
  - 7 starters: 1 GK, 2-3 DEF, 2-3 MID, 1-2 ATT
  - 2 substitutes

  Player Categories (based on PGS - Points per Game Score):
  - Star: PGS ≥ 7.5
  - Key: PGS 6.0-7.5
  - Wild: PGS < 6.0
*/

-- ============================================================================
-- TABLE: fantasy_players
-- ============================================================================

CREATE TABLE fantasy_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_player_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  photo TEXT,
  position TEXT NOT NULL CHECK (position IN ('Goalkeeper', 'Defender', 'Midfielder', 'Attacker')),
  status TEXT NOT NULL CHECK (status IN ('Star', 'Key', 'Wild')),
  fatigue INTEGER DEFAULT 100 CHECK (fatigue >= 0 AND fatigue <= 100),
  team_name TEXT NOT NULL,
  team_logo TEXT,
  birthdate DATE,
  pgs DECIMAL(3,1) DEFAULT 0.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fantasy_players_status ON fantasy_players(status);
CREATE INDEX idx_fantasy_players_position ON fantasy_players(position);
CREATE INDEX idx_fantasy_players_api_id ON fantasy_players(api_player_id);
CREATE INDEX idx_fantasy_players_fatigue ON fantasy_players(fatigue) WHERE fatigue > 0;

COMMENT ON TABLE fantasy_players IS
  'Pool of players available for Fantasy teams with PGS and fatigue tracking';

COMMENT ON COLUMN fantasy_players.api_player_id IS
  'Unique player ID from API-Sports';

COMMENT ON COLUMN fantasy_players.pgs IS
  'Points per Game Score - average points earned per match. Determines player tier: Star (≥7.5), Key (6.0-7.5), Wild (<6.0)';

COMMENT ON COLUMN fantasy_players.status IS
  'Player tier based on PGS: Star (≥7.5), Key (6.0-7.5), Wild (<6.0). Affects fatigue decay rate';

COMMENT ON COLUMN fantasy_players.fatigue IS
  'Player fatigue percentage (0-100%). Affects points multiplier. Decays based on status: Star -20%, Key -10%, Rest +10%';

-- ============================================================================
-- TABLE: fantasy_games
-- ============================================================================

CREATE TABLE fantasy_games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Upcoming', 'Ongoing', 'Finished', 'Cancelled')),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  entry_cost INTEGER DEFAULT 0,
  total_players INTEGER DEFAULT 0,
  is_linkable BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fantasy_games_status ON fantasy_games(status);
CREATE INDEX idx_fantasy_games_dates ON fantasy_games(start_date, end_date);

COMMENT ON TABLE fantasy_games IS
  'Fantasy game seasons/competitions. A game contains multiple game weeks';

COMMENT ON COLUMN fantasy_games.entry_cost IS
  'Cost in coins to join this Fantasy game';

COMMENT ON COLUMN fantasy_games.is_linkable IS
  'Whether this game can be linked to leagues';

-- ============================================================================
-- TABLE: fantasy_game_weeks
-- ============================================================================

CREATE TABLE fantasy_game_weeks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fantasy_game_id UUID NOT NULL REFERENCES fantasy_games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  leagues TEXT[] DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('upcoming', 'live', 'finished')),
  conditions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fantasy_game_weeks_game ON fantasy_game_weeks(fantasy_game_id);
CREATE INDEX idx_fantasy_game_weeks_status ON fantasy_game_weeks(status);
CREATE INDEX idx_fantasy_game_weeks_dates ON fantasy_game_weeks(start_date, end_date);

COMMENT ON TABLE fantasy_game_weeks IS
  'Individual game weeks within a Fantasy game. Users create teams for each game week';

COMMENT ON COLUMN fantasy_game_weeks.leagues IS
  'Array of league names whose matches are included in this game week (e.g., [''LaLiga'', ''Premier League''])';

COMMENT ON COLUMN fantasy_game_weeks.conditions IS
  'Game week constraints in JSON format. Example: [{"key": "max_club_players", "text": "Max. 2 players from same club", "value": 2}]';

-- ============================================================================
-- TABLE: user_fantasy_teams
-- ============================================================================

CREATE TABLE user_fantasy_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES fantasy_games(id) ON DELETE CASCADE,
  game_week_id UUID NOT NULL REFERENCES fantasy_game_weeks(id) ON DELETE CASCADE,
  starters UUID[] NOT NULL,
  substitutes UUID[] DEFAULT '{}',
  captain_id UUID REFERENCES fantasy_players(id),
  booster_used INTEGER CHECK (booster_used IN (1, 2, 3)),
  fatigue_state JSONB DEFAULT '{}',
  total_points DECIMAL(5,1) DEFAULT 0.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_id, game_week_id),
  CONSTRAINT check_starters_length CHECK (array_length(starters, 1) = 7),
  CONSTRAINT check_substitutes_length CHECK (array_length(substitutes, 1) <= 2)
);

CREATE INDEX idx_user_fantasy_teams_user ON user_fantasy_teams(user_id);
CREATE INDEX idx_user_fantasy_teams_gw ON user_fantasy_teams(game_week_id);
CREATE INDEX idx_user_fantasy_teams_game ON user_fantasy_teams(game_id);

COMMENT ON TABLE user_fantasy_teams IS
  'User Fantasy teams for each game week. Contains 7 starters + up to 2 substitutes';

COMMENT ON COLUMN user_fantasy_teams.starters IS
  'Array of 7 player UUIDs. Must follow composition: 1 GK, 2-3 DEF, 2-3 MID, 1-2 ATT';

COMMENT ON COLUMN user_fantasy_teams.substitutes IS
  'Array of up to 2 substitute player UUIDs';

COMMENT ON COLUMN user_fantasy_teams.captain_id IS
  'Captain player UUID. Captain gets +10% points (or x2.2 with Double Impact booster)';

COMMENT ON COLUMN user_fantasy_teams.booster_used IS
  'Booster ID used for this game week: 1=Double Impact (captain x2.2), 2=Golden Game (team +20%), 3=Recovery Boost (restore fatigue)';

COMMENT ON COLUMN user_fantasy_teams.fatigue_state IS
  'JSON object storing fatigue percentages for each player: {"player_id": 85.5, ...}';

COMMENT ON COLUMN user_fantasy_teams.total_points IS
  'Total points earned by this team in this game week';

-- ============================================================================
-- TABLE: fantasy_boosters
-- ============================================================================

CREATE TABLE fantasy_boosters (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon TEXT,
  type TEXT CHECK (type IN ('regular', 'live')) DEFAULT 'regular',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE fantasy_boosters IS
  'Available Fantasy boosters. Type ''regular'' for Fantasy classic, ''live'' for Fantasy Live mode';

COMMENT ON COLUMN fantasy_boosters.icon IS
  'Icon name from lucide-react (e.g., ''Flame'', ''Zap'', ''ShieldCheck'')';

COMMENT ON COLUMN fantasy_boosters.type IS
  'Booster type: ''regular'' for Fantasy classic mode, ''live'' for Fantasy Live mode (to be implemented)';

-- ============================================================================
-- TABLE: fantasy_leaderboard
-- ============================================================================

CREATE TABLE fantasy_leaderboard (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES fantasy_games(id) ON DELETE CASCADE,
  game_week_id UUID NOT NULL REFERENCES fantasy_game_weeks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  avatar TEXT,
  total_points DECIMAL(5,1) DEFAULT 0.0,
  booster_used INTEGER,
  rank INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, game_week_id, user_id)
);

CREATE INDEX idx_fantasy_leaderboard_gw ON fantasy_leaderboard(game_week_id);
CREATE INDEX idx_fantasy_leaderboard_rank ON fantasy_leaderboard(game_week_id, rank);
CREATE INDEX idx_fantasy_leaderboard_points ON fantasy_leaderboard(game_week_id, total_points DESC);

COMMENT ON TABLE fantasy_leaderboard IS
  'Rankings for each game week. Updated after game week completion';

COMMENT ON COLUMN fantasy_leaderboard.rank IS
  'User rank for this game week. Calculated using RANK() to handle ties';
