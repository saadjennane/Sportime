-- ============================================================================
-- Fantasy Player Season Stats Aggregation
-- Aggregates player_match_stats into player_season_stats for a given league/season
-- The trigger update_player_season_stats() will automatically calculate:
--   - impact_score (from goals, assists, key passes, etc.)
--   - consistency_score (from rating variance across matches)
--   - pgs (Player Game Score formula)
--   - pgs_category ('Star' >= 7.5, 'Key' >= 6.0, 'Wild' < 6.0)
-- ============================================================================

CREATE OR REPLACE FUNCTION aggregate_player_season_stats(
  p_league_id UUID,
  p_season INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
)
RETURNS TABLE (
  players_processed INTEGER,
  message TEXT
) AS $$
DECLARE
  v_players_processed INTEGER := 0;
BEGIN
  -- Aggregate player_match_stats into player_season_stats
  -- Group by player, season, team, league
  INSERT INTO player_season_stats (
    player_id,
    season,
    team_id,
    league_id,
    -- Appearance Stats
    appearances,
    minutes_played,
    starting_xi,
    substitute_in,
    substitute_out,
    -- Performance Stats (rating is averaged, others are summed)
    rating,
    goals,
    assists,
    -- Detailed Stats
    shots_total,
    shots_on_target,
    passes_total,
    passes_key,
    passes_accuracy,
    tackles_total,
    tackles_interceptions,
    duels_total,
    duels_won,
    dribbles_attempts,
    dribbles_success,
    fouls_drawn,
    fouls_committed,
    -- Discipline
    yellow_cards,
    red_cards,
    -- Goalkeeper Stats
    saves,
    goals_conceded,
    clean_sheets,
    penalties_saved,
    penalties_missed
  )
  SELECT
    pms.player_id,
    p_season,
    pms.team_id,
    f.league_id,
    -- Appearance Stats
    COUNT(*) AS appearances,
    SUM(pms.minutes_played),
    COUNT(*) FILTER (WHERE pms.started = true),
    COUNT(*) FILTER (WHERE pms.substitute_in = true),
    COUNT(*) FILTER (WHERE pms.substitute_out = true),
    -- Performance Stats
    AVG(pms.rating) FILTER (WHERE pms.rating IS NOT NULL),
    SUM(pms.goals),
    SUM(pms.assists),
    -- Detailed Stats
    SUM(pms.shots_total),
    SUM(pms.shots_on_target),
    SUM(pms.passes_total),
    SUM(pms.passes_key),
    AVG(pms.passes_accuracy) FILTER (WHERE pms.passes_accuracy IS NOT NULL),
    SUM(pms.tackles_total),
    SUM(pms.tackles_interceptions),
    SUM(pms.duels_total),
    SUM(pms.duels_won),
    SUM(pms.dribbles_attempts),
    SUM(pms.dribbles_success),
    SUM(pms.fouls_drawn),
    SUM(pms.fouls_committed),
    -- Discipline
    COUNT(*) FILTER (WHERE pms.yellow_card = true),
    COUNT(*) FILTER (WHERE pms.red_card = true),
    -- Goalkeeper Stats
    SUM(pms.saves),
    SUM(pms.goals_conceded),
    COUNT(*) FILTER (WHERE pms.clean_sheet = true),
    SUM(COALESCE(pms.penalties_saved, 0)),
    SUM(COALESCE(pms.penalties_missed, 0))
  FROM player_match_stats pms
  JOIN fixtures f ON f.id = pms.fixture_id
  WHERE f.league_id = p_league_id
    AND EXTRACT(YEAR FROM f.date)::INTEGER = p_season
  GROUP BY pms.player_id, pms.team_id, f.league_id
  ON CONFLICT (player_id, season, team_id) DO UPDATE SET
    -- Update all aggregated fields
    appearances = EXCLUDED.appearances,
    minutes_played = EXCLUDED.minutes_played,
    starting_xi = EXCLUDED.starting_xi,
    substitute_in = EXCLUDED.substitute_in,
    substitute_out = EXCLUDED.substitute_out,
    rating = EXCLUDED.rating,
    goals = EXCLUDED.goals,
    assists = EXCLUDED.assists,
    shots_total = EXCLUDED.shots_total,
    shots_on_target = EXCLUDED.shots_on_target,
    passes_total = EXCLUDED.passes_total,
    passes_key = EXCLUDED.passes_key,
    passes_accuracy = EXCLUDED.passes_accuracy,
    tackles_total = EXCLUDED.tackles_total,
    tackles_interceptions = EXCLUDED.tackles_interceptions,
    duels_total = EXCLUDED.duels_total,
    duels_won = EXCLUDED.duels_won,
    dribbles_attempts = EXCLUDED.dribbles_attempts,
    dribbles_success = EXCLUDED.dribbles_success,
    fouls_drawn = EXCLUDED.fouls_drawn,
    fouls_committed = EXCLUDED.fouls_committed,
    yellow_cards = EXCLUDED.yellow_cards,
    red_cards = EXCLUDED.red_cards,
    saves = EXCLUDED.saves,
    goals_conceded = EXCLUDED.goals_conceded,
    clean_sheets = EXCLUDED.clean_sheets,
    penalties_saved = EXCLUDED.penalties_saved,
    penalties_missed = EXCLUDED.penalties_missed,
    updated_at = NOW();
  -- Note: The trigger update_player_season_stats() will automatically calculate:
  -- - impact_score
  -- - consistency_score
  -- - pgs
  -- - pgs_category

  GET DIAGNOSTICS v_players_processed = ROW_COUNT;

  RETURN QUERY SELECT
    v_players_processed,
    'Successfully aggregated stats for ' || v_players_processed || ' players in season ' || p_season;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION aggregate_player_season_stats TO authenticated, service_role;

-- Add comment
COMMENT ON FUNCTION aggregate_player_season_stats IS
'Aggregates player_match_stats into player_season_stats for a given league and season.
The trigger update_player_season_stats() automatically calculates impact_score, consistency_score, pgs, and pgs_category.';

-- Verification
SELECT 'Fantasy season stats aggregation function created successfully!' as status;
