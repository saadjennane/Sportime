-- Per-player stats for the fantasy "player stats" modal: recent form (last 10
-- matches: rating/position/goals/assists/minutes) + aggregated totals.
CREATE OR REPLACE FUNCTION public.get_fantasy_player_stats(p_player_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH recent AS (
    SELECT pms.minutes_played, pms.rating, pms.position, pms.goals, pms.assists,
           pms.clean_sheet, pms.tackles_total, pms.passes_key, pms.dribbles_success,
           pms.shots_on_target, pms.yellow_card, pms.red_card, f.date AS fixture_date
    FROM public.player_match_stats pms
    JOIN public.fixtures f ON f.id = pms.fixture_id
    WHERE pms.player_id = p_player_id
    ORDER BY f.date DESC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'recent', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'date', fixture_date, 'rating', rating,
        'position', CASE upper(position)
          WHEN 'G' THEN 'GK' WHEN 'D' THEN 'DEF' WHEN 'M' THEN 'MID' WHEN 'F' THEN 'ATT' ELSE position END,
        'goals', goals, 'assists', assists, 'minutes', minutes_played
      ) ORDER BY fixture_date DESC) FROM recent), '[]'::jsonb),
    'totals', (SELECT jsonb_build_object(
        'matches', count(*),
        'minutes', COALESCE(sum(minutes_played), 0),
        'goals', COALESCE(sum(goals), 0),
        'assists', COALESCE(sum(assists), 0),
        'clean_sheets', COALESCE(sum(CASE WHEN clean_sheet THEN 1 ELSE 0 END), 0),
        'tackles', COALESCE(sum(tackles_total), 0),
        'key_passes', COALESCE(sum(passes_key), 0),
        'dribbles', COALESCE(sum(dribbles_success), 0),
        'shots_on_target', COALESCE(sum(shots_on_target), 0),
        'yellow', COALESCE(sum(CASE WHEN yellow_card THEN 1 ELSE 0 END), 0),
        'red', COALESCE(sum(CASE WHEN red_card THEN 1 ELSE 0 END), 0),
        'avg_rating', ROUND(AVG(NULLIF(rating, 0))::numeric, 2)
      ) FROM recent)
  );
$$;
GRANT EXECUTE ON FUNCTION public.get_fantasy_player_stats(UUID) TO authenticated, service_role;
