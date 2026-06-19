-- Live games linked to a squad (squad_games.game_type='live') with fixture/team
-- info, so every member can see them. Returns JSONB array.
CREATE OR REPLACE FUNCTION public.get_squad_live_games(p_squad_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', lg.id,
    'status', lg.status,
    'home_team', COALESCE(ht.name, 'TBD'),
    'away_team', COALESCE(at.name, 'TBD'),
    'players', COALESCE(pc.cnt, 0)
  ) ORDER BY lg.created_at DESC), '[]'::jsonb)
  FROM public.squad_games sg
  JOIN public.live_games lg ON lg.id = sg.game_id
  LEFT JOIN public.fb_fixtures f ON f.id = lg.fixture_id
  LEFT JOIN public.fb_teams ht ON ht.id = f.home_team_id
  LEFT JOIN public.fb_teams at ON at.id = f.away_team_id
  LEFT JOIN (
    SELECT live_game_id, count(*) AS cnt FROM public.live_game_entries GROUP BY live_game_id
  ) pc ON pc.live_game_id = lg.id
  WHERE sg.squad_id = p_squad_id AND sg.game_type = 'live';
$$;

GRANT EXECUTE ON FUNCTION public.get_squad_live_games(UUID) TO authenticated, service_role;
