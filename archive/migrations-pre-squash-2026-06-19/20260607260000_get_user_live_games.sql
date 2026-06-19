-- The user's active live games (for the ⚡ quick-access list). SECURITY DEFINER
-- so it reads reliably regardless of RLS, and returns team logos (logo_url).
CREATE OR REPLACE FUNCTION public.get_user_live_games(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT COALESCE(jsonb_agg(g ORDER BY (g->'fixture'->>'date')), '[]'::jsonb) INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id', lg.id,
      'mode', lg.mode,
      'status', lg.status,
      'fixture_id', lg.fixture_id,
      'predicted_score', e.predicted_score,
      'total_points', e.total_points,
      'fixture', jsonb_build_object(
        'date', f.date,
        'status', f.status,
        'goals_home', f.goals_home,
        'goals_away', f.goals_away,
        'home', jsonb_build_object('name', ht.name, 'logo', ht.logo_url),
        'away', jsonb_build_object('name', at.name, 'logo', at.logo_url)
      )
    ) AS g
    FROM public.live_game_entries e
    JOIN public.live_games lg ON lg.id = e.live_game_id
    JOIN public.fb_fixtures f ON f.id = lg.fixture_id
    LEFT JOIN public.fb_teams ht ON ht.id = f.home_team_id
    LEFT JOIN public.fb_teams at ON at.id = f.away_team_id
    WHERE e.user_id = p_user_id AND lg.status IN ('upcoming', 'live')
  ) s;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_live_games(UUID) TO authenticated, anon, service_role;
