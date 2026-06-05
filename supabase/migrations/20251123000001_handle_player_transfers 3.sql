-- ============================================================================
-- Handle Player Transfers in Season Stats
-- Aggregates stats for players who transferred during the season
-- Calculates a single PGS based on combined performance across all teams
-- ============================================================================

-- =============================================================================
-- VIEW: player_season_stats_combined
-- Combines stats for players who transferred, with recalculated PGS
-- This is the SOURCE OF TRUTH for rankings and displays
-- =============================================================================
CREATE OR REPLACE VIEW public.player_season_stats_combined AS
WITH aggregated AS (
  SELECT
    player_id,
    season,
    league_id,
    -- Aggregate all counting stats
    SUM(goals) as total_goals,
    SUM(assists) as total_assists,
    SUM(appearances) as total_appearances,
    SUM(minutes_played) as total_minutes_played,
    SUM(shots_total) as total_shots_total,
    SUM(shots_on_target) as total_shots_on_target,
    SUM(passes_total) as total_passes_total,
    SUM(passes_key) as total_passes_key,
    SUM(tackles_total) as total_tackles_total,
    SUM(tackles_interceptions) as total_tackles_interceptions,
    SUM(duels_total) as total_duels_total,
    SUM(duels_won) as total_duels_won,
    SUM(dribbles_attempts) as total_dribbles_attempts,
    SUM(dribbles_success) as total_dribbles_success,
    SUM(fouls_drawn) as total_fouls_drawn,
    SUM(fouls_committed) as total_fouls_committed,
    SUM(yellow_cards) as total_yellow_cards,
    SUM(red_cards) as total_red_cards,
    SUM(saves) as total_saves,
    SUM(goals_conceded) as total_goals_conceded,
    SUM(clean_sheets) as total_clean_sheets,
    SUM(penalties_saved) as total_penalties_saved,
    SUM(penalties_missed) as total_penalties_missed,
    -- Average for percentage stats
    AVG(rating) as avg_rating,
    AVG(passes_accuracy) as avg_passes_accuracy,
    -- Track team info
    COUNT(DISTINCT team_id) as teams_count,
    -- Get the most recent team (by updated_at)
    (ARRAY_AGG(team_id ORDER BY updated_at DESC))[1] as current_team_id,
    STRING_AGG(DISTINCT team_id::TEXT, ', ' ORDER BY team_id::TEXT) as all_team_ids,
    MAX(updated_at) as updated_at
  FROM player_season_stats
  GROUP BY player_id, season, league_id
)
SELECT
  player_id,
  season,
  league_id,
  current_team_id as team_id,
  total_goals::INTEGER as goals,
  total_assists::INTEGER as assists,
  total_appearances::INTEGER as appearances,
  total_minutes_played::INTEGER as minutes_played,
  avg_rating as rating,
  total_shots_total::INTEGER as shots_total,
  total_shots_on_target::INTEGER as shots_on_target,
  total_passes_total::INTEGER as passes_total,
  total_passes_key::INTEGER as passes_key,
  avg_passes_accuracy as passes_accuracy,
  total_tackles_total::INTEGER as tackles_total,
  total_tackles_interceptions::INTEGER as tackles_interceptions,
  total_duels_total::INTEGER as duels_total,
  total_duels_won::INTEGER as duels_won,
  total_dribbles_attempts::INTEGER as dribbles_attempts,
  total_dribbles_success::INTEGER as dribbles_success,
  total_fouls_drawn::INTEGER as fouls_drawn,
  total_fouls_committed::INTEGER as fouls_committed,
  total_yellow_cards::INTEGER as yellow_cards,
  total_red_cards::INTEGER as red_cards,
  total_saves::INTEGER as saves,
  total_goals_conceded::INTEGER as goals_conceded,
  total_clean_sheets::INTEGER as clean_sheets,
  total_penalties_saved::INTEGER as penalties_saved,
  total_penalties_missed::INTEGER as penalties_missed,
  -- Recalculate impact score with aggregated stats
  public.calculate_impact_score(
    total_goals::INTEGER,
    total_assists::INTEGER,
    total_passes_key::INTEGER,
    total_dribbles_success::INTEGER,
    total_tackles_total::INTEGER,
    total_tackles_interceptions::INTEGER,
    total_shots_on_target::INTEGER,
    total_duels_won::INTEGER,
    total_clean_sheets::INTEGER,
    total_saves::INTEGER,
    total_penalties_saved::INTEGER,
    total_appearances::INTEGER,
    COALESCE(
      (SELECT position FROM player_match_stats WHERE player_id = aggregated.player_id LIMIT 1),
      'Unknown'
    )
  ) as impact_score,
  -- Recalculate consistency score based on all matches
  public.calculate_consistency_score(
    aggregated.player_id,
    aggregated.season
  ) as consistency_score,
  -- Recalculate PGS with aggregated stats
  public.calculate_pgs(
    avg_rating,
    public.calculate_impact_score(
      total_goals::INTEGER,
      total_assists::INTEGER,
      total_passes_key::INTEGER,
      total_dribbles_success::INTEGER,
      total_tackles_total::INTEGER,
      total_tackles_interceptions::INTEGER,
      total_shots_on_target::INTEGER,
      total_duels_won::INTEGER,
      total_clean_sheets::INTEGER,
      total_saves::INTEGER,
      total_penalties_saved::INTEGER,
      total_appearances::INTEGER,
      COALESCE(
        (SELECT position FROM player_match_stats WHERE player_id = aggregated.player_id LIMIT 1),
        'Unknown'
      )
    ),
    public.calculate_consistency_score(aggregated.player_id, aggregated.season),
    total_minutes_played::INTEGER,
    total_appearances::INTEGER
  ) as pgs,
  -- Recalculate category
  public.get_pgs_category(
    public.calculate_pgs(
      avg_rating,
      public.calculate_impact_score(
        total_goals::INTEGER,
        total_assists::INTEGER,
        total_passes_key::INTEGER,
        total_dribbles_success::INTEGER,
        total_tackles_total::INTEGER,
        total_tackles_interceptions::INTEGER,
        total_shots_on_target::INTEGER,
        total_duels_won::INTEGER,
        total_clean_sheets::INTEGER,
        total_saves::INTEGER,
        total_penalties_saved::INTEGER,
        total_appearances::INTEGER,
        COALESCE(
          (SELECT position FROM player_match_stats WHERE player_id = aggregated.player_id LIMIT 1),
          'Unknown'
        )
      ),
      public.calculate_consistency_score(aggregated.player_id, aggregated.season),
      total_minutes_played::INTEGER,
      total_appearances::INTEGER
    )
  ) as pgs_category,
  teams_count::INTEGER,
  teams_count > 1 as is_transferred,
  updated_at
FROM aggregated;

-- =============================================================================
-- FUNCTION: Get Top Players by PGS (with combined stats for transfers)
-- Returns top N players by PGS, using aggregated stats for transferred players
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_top_players_by_pgs(
  p_season INTEGER,
  p_league_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  player_id UUID,
  player_name TEXT,
  team_name TEXT,
  goals INTEGER,
  assists INTEGER,
  appearances INTEGER,
  rating DECIMAL(3,2),
  pgs DECIMAL(5,2),
  pgs_category TEXT,
  impact_score DECIMAL(5,2),
  consistency_score DECIMAL(5,2),
  is_transferred BOOLEAN,
  teams_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    psc.player_id,
    p.first_name || ' ' || p.last_name as player_name,
    t.name as team_name,
    psc.goals,
    psc.assists,
    psc.appearances,
    psc.rating,
    psc.pgs,
    psc.pgs_category,
    psc.impact_score,
    psc.consistency_score,
    psc.is_transferred,
    psc.teams_count
  FROM player_season_stats_combined psc
  JOIN players p ON p.id = psc.player_id
  JOIN teams t ON t.id = psc.team_id
  WHERE psc.season = p_season
    AND (p_league_id IS NULL OR psc.league_id = p_league_id)
  ORDER BY psc.pgs DESC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: Get Player Transfer History
-- Returns detailed breakdown for each team a player played for
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_player_transfer_history(
  p_player_id UUID,
  p_season INTEGER
)
RETURNS TABLE (
  team_id UUID,
  team_name TEXT,
  goals INTEGER,
  assists INTEGER,
  appearances INTEGER,
  minutes_played INTEGER,
  rating DECIMAL(3,2),
  pgs DECIMAL(5,2),
  pgs_category TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pss.team_id,
    t.name as team_name,
    pss.goals,
    pss.assists,
    pss.appearances,
    pss.minutes_played,
    pss.rating,
    pss.pgs,
    pss.pgs_category
  FROM player_season_stats pss
  JOIN teams t ON t.id = pss.team_id
  WHERE pss.player_id = p_player_id
    AND pss.season = p_season
  ORDER BY pss.updated_at ASC;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Show top 10 players (no duplicates, combined stats for transfers)
SELECT
  player_name,
  team_name,
  goals,
  assists,
  appearances,
  ROUND(pgs, 2) as pgs,
  pgs_category,
  is_transferred,
  CASE WHEN is_transferred THEN teams_count || ' teams' ELSE '' END as transfer_info
FROM public.get_top_players_by_pgs(2025, NULL, 10);

-- Compare Etta Eyong: individual teams vs combined
SELECT
  'Individual Stats' as type,
  t.name as team,
  pss.goals,
  pss.assists,
  pss.appearances,
  pss.pgs,
  pss.pgs_category
FROM player_season_stats pss
JOIN players p ON p.id = pss.player_id
JOIN teams t ON t.id = pss.team_id
WHERE p.first_name ILIKE '%Etta%' AND p.last_name ILIKE '%Eyong%'
  AND pss.season = 2025

UNION ALL

SELECT
  'Combined Stats' as type,
  t.name as team,
  psc.goals,
  psc.assists,
  psc.appearances,
  psc.pgs,
  psc.pgs_category
FROM player_season_stats_combined psc
JOIN players p ON p.id = psc.player_id
JOIN teams t ON t.id = psc.team_id
WHERE p.first_name ILIKE '%Etta%' AND p.last_name ILIKE '%Eyong%'
  AND psc.season = 2025
ORDER BY type, team;

-- Show all transferred players with combined stats
SELECT
  p.first_name || ' ' || p.last_name as player_name,
  t.name as current_team,
  psc.teams_count,
  psc.goals,
  psc.assists,
  psc.appearances,
  ROUND(psc.pgs, 2) as pgs,
  psc.pgs_category
FROM player_season_stats_combined psc
JOIN players p ON p.id = psc.player_id
JOIN teams t ON t.id = psc.team_id
WHERE psc.season = 2025 AND psc.is_transferred = true
ORDER BY psc.pgs DESC;

-- Message de confirmation
SELECT 'Player transfer handling implemented with aggregated stats!' as status;
