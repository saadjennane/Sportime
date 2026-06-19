/*
  Fantasy Game Seed Data

  Inserts initial data for testing and development:
  1. Fantasy boosters (3 boosters for classic mode)
  2. Test Fantasy game with game weeks
  3. Test Fantasy players (13 players from mockFantasy.tsx)
*/

-- ============================================================================
-- Insert Fantasy Boosters (Classic mode only)
-- ============================================================================

INSERT INTO fantasy_boosters (id, name, description, icon, type) VALUES
(1, 'Double Impact', 'Multiplies your captain''s score by 2.2 instead of 1.1.', 'Flame', 'regular'),
(2, 'Golden Game', 'Get +20% on your entire team''s total score.', 'Zap', 'regular'),
(3, 'Recovery Boost', 'Restore one player to 100% fatigue.', 'ShieldCheck', 'regular')
ON CONFLICT (name) DO NOTHING;

-- Reset sequence for boosters
SELECT setval('fantasy_boosters_id_seq', (SELECT MAX(id) FROM fantasy_boosters));

-- ============================================================================
-- Insert Test Fantasy Game
-- ============================================================================

INSERT INTO fantasy_games (id, name, status, start_date, end_date, entry_cost, is_linkable, total_players) VALUES
('fantasy-test-1', 'Sportime Fantasy Season 1', 'Ongoing', NOW() - INTERVAL '60 days', NOW() + INTERVAL '30 days', 1500, true, 0)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Insert Test Game Weeks
-- ============================================================================

INSERT INTO fantasy_game_weeks (id, fantasy_game_id, name, start_date, end_date, leagues, status, conditions) VALUES
-- Past game weeks (finished)
('gw-past-4', 'fantasy-test-1', 'MatchDay 1', NOW() - INTERVAL '35 days', NOW() - INTERVAL '33 days', ARRAY['LaLiga'], 'finished', '[]'::jsonb),
('gw-past-3', 'fantasy-test-1', 'MatchDay 2', NOW() - INTERVAL '28 days', NOW() - INTERVAL '26 days', ARRAY['Premier League'], 'finished', '[]'::jsonb),
('gw-past-2', 'fantasy-test-1', 'MatchDay 3', NOW() - INTERVAL '21 days', NOW() - INTERVAL '19 days', ARRAY['Bundesliga'], 'finished', '[]'::jsonb),
('gw-past-1', 'fantasy-test-1', 'MatchDay 4', NOW() - INTERVAL '14 days', NOW() - INTERVAL '12 days', ARRAY['Serie A'], 'finished', '[]'::jsonb),
('gw0', 'fantasy-test-1', 'MatchDay 5', NOW() - INTERVAL '7 days', NOW() - INTERVAL '5 days', ARRAY['LaLiga'], 'finished', '[]'::jsonb),

-- Current game week (live)
('gw1', 'fantasy-test-1', 'MatchDay 6', NOW() - INTERVAL '2 days', NOW() + INTERVAL '2 days', ARRAY['LaLiga', 'Premier League'], 'live',
  '[
    {"key": "max_club_players", "text": "Max. 2 players from same club", "value": 2},
    {"key": "max_star_players", "text": "Max. 2 Star players", "value": 2}
  ]'::jsonb)

ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Insert Test Fantasy Players (from mockFantasy.tsx)
-- ============================================================================

-- Goalkeepers
INSERT INTO fantasy_players (id, api_player_id, name, photo, position, status, fatigue, team_name, team_logo, birthdate, pgs) VALUES
('p4', 304, 'Alisson', 'https://media.api-sports.io/football/players/304.png', 'Goalkeeper', 'Key', 100, 'Liverpool', 'https://media.api-sports.io/football/teams/40.png', '1992-10-02', 7.0),
('p12', 1101, 'M. ter Stegen', 'https://media.api-sports.io/football/players/1101.png', 'Goalkeeper', 'Key', 98, 'Barcelona', 'https://media.api-sports.io/football/teams/529.png', '1992-04-30', 6.9)
ON CONFLICT (id) DO NOTHING;

-- Defenders
INSERT INTO fantasy_players (id, api_player_id, name, photo, position, status, fatigue, team_name, team_logo, birthdate, pgs) VALUES
('p3', 306, 'V. van Dijk', 'https://media.api-sports.io/football/players/306.png', 'Defender', 'Key', 92, 'Liverpool', 'https://media.api-sports.io/football/teams/40.png', '1991-07-08', 7.2),
('p7', 1102, 'A. Davies', 'https://media.api-sports.io/football/players/1102.png', 'Defender', 'Key', 98, 'Bayern Munich', 'https://media.api-sports.io/football/teams/157.png', '2000-11-02', 7.1),
('p9', 163, 'J. Koundé', 'https://media.api-sports.io/football/players/163.png', 'Defender', 'Key', 94, 'Barcelona', 'https://media.api-sports.io/football/teams/529.png', '1998-11-12', 6.9),
('p13', 18888, 'R. James', 'https://media.api-sports.io/football/players/18888.png', 'Defender', 'Wild', 100, 'Chelsea', 'https://media.api-sports.io/football/teams/49.png', '1999-12-08', 5.9)
ON CONFLICT (id) DO NOTHING;

-- Midfielders
INSERT INTO fantasy_players (id, api_player_id, name, photo, position, status, fatigue, team_name, team_logo, birthdate, pgs) VALUES
('p2', 62, 'K. De Bruyne', 'https://media.api-sports.io/football/players/62.png', 'Midfielder', 'Star', 88, 'Man City', 'https://media.api-sports.io/football/teams/50.png', '1991-06-28', 7.8),
('p5', 874, 'J. Bellingham', 'https://media.api-sports.io/football/players/874.png', 'Midfielder', 'Star', 85, 'Real Madrid', 'https://media.api-sports.io/football/teams/541.png', '2003-06-29', 7.9),
('p8', 1456, 'Pedri', 'https://media.api-sports.io/football/players/1456.png', 'Midfielder', 'Key', 80, 'Barcelona', 'https://media.api-sports.io/football/teams/529.png', '2002-11-25', 6.8),
('p10', 2289, 'F. Wirtz', 'https://media.api-sports.io/football/players/2289.png', 'Midfielder', 'Wild', 100, 'Leverkusen', 'https://media.api-sports.io/football/teams/168.png', '2003-05-03', 5.8)
ON CONFLICT (id) DO NOTHING;

-- Attackers
INSERT INTO fantasy_players (id, api_player_id, name, photo, position, status, fatigue, team_name, team_logo, birthdate, pgs) VALUES
('p1', 154, 'L. Messi', 'https://media.api-sports.io/football/players/154.png', 'Attacker', 'Star', 95, 'Inter Miami', 'https://media.api-sports.io/football/teams/10101.png', '1987-06-24', 8.1),
('p6', 969, 'E. Haaland', 'https://media.api-sports.io/football/players/969.png', 'Attacker', 'Star', 90, 'Man City', 'https://media.api-sports.io/football/teams/50.png', '2000-07-21', 8.3),
('p11', 241, 'Rafael Leão', 'https://media.api-sports.io/football/players/241.png', 'Attacker', 'Key', 85, 'AC Milan', 'https://media.api-sports.io/football/teams/489.png', '1999-06-10', 7.3)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Verification
-- ============================================================================

-- Verify boosters
DO $$
DECLARE
  v_booster_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_booster_count FROM fantasy_boosters;
  RAISE NOTICE 'Inserted % Fantasy boosters', v_booster_count;
END $$;

-- Verify game and game weeks
DO $$
DECLARE
  v_game_week_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_game_week_count FROM fantasy_game_weeks WHERE fantasy_game_id = 'fantasy-test-1';
  RAISE NOTICE 'Inserted Fantasy game with % game weeks', v_game_week_count;
END $$;

-- Verify players
DO $$
DECLARE
  v_player_count INTEGER;
  v_star_count INTEGER;
  v_key_count INTEGER;
  v_wild_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_player_count FROM fantasy_players;
  SELECT COUNT(*) INTO v_star_count FROM fantasy_players WHERE status = 'Star';
  SELECT COUNT(*) INTO v_key_count FROM fantasy_players WHERE status = 'Key';
  SELECT COUNT(*) INTO v_wild_count FROM fantasy_players WHERE status = 'Wild';

  RAISE NOTICE 'Inserted % Fantasy players: % Star, % Key, % Wild',
    v_player_count, v_star_count, v_key_count, v_wild_count;
END $$;
