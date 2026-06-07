-- Real per-player stats for a fantasy game week (same field mapping as the
-- scoring engine), so the mobile can show REAL points instead of mock ones.
-- Resolves the league's legacy fixtures in the week window, one row per player.
CREATE OR REPLACE FUNCTION public.get_fantasy_gameweek_player_stats(p_game_week_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_league UUID;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  SELECT fg.league_id, gw.start_date, gw.end_date
    INTO v_league, v_start, v_end
  FROM public.fantasy_game_weeks gw
  JOIN public.fantasy_games fg ON fg.id = gw.fantasy_game_id
  WHERE gw.id = p_game_week_id;

  IF v_league IS NULL THEN RETURN '{}'::jsonb; END IF;

  SELECT jsonb_object_agg(player_id, stats) INTO v_result FROM (
    SELECT DISTINCT ON (pms.player_id)
      pms.player_id,
      jsonb_build_object(
        'minutes_played', COALESCE(pms.minutes_played, 0),
        'goals', COALESCE(pms.goals, 0),
        'assists', COALESCE(pms.assists, 0),
        'clean_sheet', COALESCE(pms.clean_sheet, false),
        'shots_on_target', COALESCE(pms.shots_on_target, 0),
        'saves', COALESCE(pms.saves, 0),
        'penalties_scored', 0,
        'penalties_missed', COALESCE(pms.penalties_missed, 0),
        'yellow_cards', CASE WHEN pms.yellow_card THEN 1 ELSE 0 END,
        'red_cards', CASE WHEN pms.red_card THEN 1 ELSE 0 END,
        'goals_conceded', COALESCE(pms.goals_conceded, 0),
        'interceptions', COALESCE(pms.interceptions, 0),
        'tackles', COALESCE(pms.tackles_total, 0),
        'duels_won', COALESCE(pms.duels_won, 0),
        'duels_lost', GREATEST(0, COALESCE(pms.duels_total, 0) - COALESCE(pms.duels_won, 0)),
        'dribbles_succeeded', COALESCE(pms.dribbles_success, 0),
        'fouls_committed', COALESCE(pms.fouls_committed, 0),
        'fouls_suffered', COALESCE(pms.fouls_drawn, 0),
        'penalties_saved', COALESCE(pms.penalties_saved, 0),
        'rating', COALESCE(pms.rating, 0)
      ) AS stats
    FROM public.player_match_stats pms
    JOIN public.fixtures f ON f.id = pms.fixture_id
    WHERE f.league_id = v_league
      AND f.date >= v_start AND f.date <= v_end
    ORDER BY pms.player_id, f.date DESC
  ) s;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_fantasy_gameweek_player_stats(UUID) TO authenticated, anon, service_role;
