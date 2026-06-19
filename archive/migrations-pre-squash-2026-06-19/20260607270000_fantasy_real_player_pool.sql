-- ============================================================================
-- Fantasy 1a — unify the player pool on the REAL data:
-- players (581) + fantasy_league_players (580, status + pgs) instead of the
-- 13-row demo fantasy_players. Returned `id` is players.id so team starters
-- match what process-fantasy-gameweek reads from `players`. Same RETURNS shape.
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_available_fantasy_players(UUID);

CREATE FUNCTION public.get_available_fantasy_players(p_game_week_id UUID DEFAULT NULL)
RETURNS TABLE(
  id UUID,
  api_player_id INTEGER,
  name TEXT,
  photo TEXT,
  "position" TEXT,
  status TEXT,
  fatigue INTEGER,
  team_name TEXT,
  team_logo TEXT,
  birthdate DATE,
  pgs DECIMAL
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH lg AS (
    SELECT COALESCE(
      (SELECT fg.league_id
         FROM public.fantasy_game_weeks gw
         JOIN public.fantasy_games fg ON fg.id = gw.fantasy_game_id
        WHERE gw.id = p_game_week_id),
      (SELECT flp2.league_id
         FROM public.fantasy_league_players flp2
        GROUP BY flp2.league_id ORDER BY count(*) DESC LIMIT 1)
    ) AS league_id
  )
  SELECT
    p.id,
    p.api_id,
    NULLIF(trim(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')), ''),
    p.photo_url,
    CASE upper(substr(COALESCE(p."position", 'M'), 1, 1))
      WHEN 'G' THEN 'Goalkeeper' WHEN 'D' THEN 'Defender' WHEN 'M' THEN 'Midfielder' ELSE 'Attacker' END,
    flp.status,
    100,
    tm.name,
    tm.logo_url,
    p.birthdate,
    flp.pgs
  FROM public.fantasy_league_players flp
  JOIN public.players p ON p.id = flp.player_id
  CROSS JOIN lg
  LEFT JOIN LATERAL (
    SELECT t.name, t.logo_url
    FROM public.player_match_stats pms
    JOIN public.fb_teams t ON t.id = pms.team_id
    WHERE pms.player_id = p.id
    GROUP BY t.name, t.logo_url
    ORDER BY count(*) DESC
    LIMIT 1
  ) tm ON true
  WHERE flp.league_id = lg.league_id
    AND COALESCE(flp.is_available, true) = true
  ORDER BY flp.pgs DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_fantasy_players(UUID) TO authenticated, anon, service_role;
