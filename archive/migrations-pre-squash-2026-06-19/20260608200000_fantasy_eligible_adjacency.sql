-- ============================================================================
-- Harden eligible positions with a POSITIONAL ADJACENCY constraint:
--   GK ↔ (none) · DEF ↔ MID · MID ↔ ATT  (never DEF ↔ ATT).
-- Keeps the same threshold (>= max(2 matches, 20%)) but only WITHIN positions
-- adjacent to the player's primary, so a real striker can't be disguised as a
-- defender. Yamal (primary MID) stays eligible [MID, ATT]; a striker with fluke
-- defender appearances is NOT eligible as a defender.
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_available_fantasy_players(UUID);

CREATE FUNCTION public.get_available_fantasy_players(p_game_week_id UUID DEFAULT NULL)
RETURNS TABLE(
  id UUID, api_player_id INTEGER, name TEXT, photo TEXT, "position" TEXT,
  eligible_positions TEXT[], status TEXT, fatigue INTEGER, team_name TEXT,
  team_logo TEXT, birthdate DATE, pgs DECIMAL
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH lg AS (
    SELECT COALESCE(
      (SELECT fg.league_id FROM public.fantasy_game_weeks gw
         JOIN public.fantasy_games fg ON fg.id = gw.fantasy_game_id WHERE gw.id = p_game_week_id),
      (SELECT flp2.league_id FROM public.fantasy_league_players flp2
        GROUP BY flp2.league_id ORDER BY count(*) DESC LIMIT 1)
    ) AS league_id
  ),
  pos_counts AS (
    SELECT pms.player_id,
      CASE upper(pms.position)
        WHEN 'G' THEN 'Goalkeeper' WHEN 'D' THEN 'Defender'
        WHEN 'M' THEN 'Midfielder' WHEN 'F' THEN 'Attacker' END AS pos_full,
      count(*) AS cnt
    FROM public.player_match_stats pms
    WHERE upper(pms.position) IN ('G', 'D', 'M', 'F')
      AND COALESCE(pms.minutes_played, 0) > 0
    GROUP BY pms.player_id, 2
  ),
  pos_total AS (
    SELECT player_id, sum(cnt) AS total,
           (array_agg(pos_full ORDER BY cnt DESC))[1] AS primary_pos
    FROM pos_counts GROUP BY player_id
  ),
  pos_final AS (
    SELECT pt.player_id, pt.primary_pos,
      (SELECT array_agg(pc.pos_full ORDER BY pc.cnt DESC)
         FROM pos_counts pc
        WHERE pc.player_id = pt.player_id
          AND pc.cnt >= GREATEST(2, ceil(0.20 * pt.total))
          AND pc.pos_full = ANY(
            CASE pt.primary_pos
              WHEN 'Goalkeeper' THEN ARRAY['Goalkeeper']
              WHEN 'Defender'   THEN ARRAY['Defender', 'Midfielder']
              WHEN 'Midfielder' THEN ARRAY['Defender', 'Midfielder', 'Attacker']
              WHEN 'Attacker'   THEN ARRAY['Midfielder', 'Attacker']
              ELSE ARRAY[pt.primary_pos]
            END
          )) AS eligible
    FROM pos_total pt
  )
  SELECT
    p.id, p.api_id,
    NULLIF(trim(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''),
    p.photo_url,
    COALESCE(pf.primary_pos,
      CASE upper(substr(COALESCE(p."position", 'M'), 1, 1))
        WHEN 'G' THEN 'Goalkeeper' WHEN 'D' THEN 'Defender'
        WHEN 'M' THEN 'Midfielder' ELSE 'Attacker' END) AS position,
    COALESCE(pf.eligible, ARRAY[
      CASE upper(substr(COALESCE(p."position", 'M'), 1, 1))
        WHEN 'G' THEN 'Goalkeeper' WHEN 'D' THEN 'Defender'
        WHEN 'M' THEN 'Midfielder' ELSE 'Attacker' END]) AS eligible_positions,
    flp.status, 100, tm.name, tm.logo_url, p.birthdate, flp.pgs
  FROM public.fantasy_league_players flp
  JOIN public.players p ON p.id = flp.player_id
  CROSS JOIN lg
  LEFT JOIN pos_final pf ON pf.player_id = p.id
  LEFT JOIN LATERAL (
    SELECT t.name, t.logo_url
    FROM public.player_match_stats pms
    JOIN public.fb_teams t ON t.id = pms.team_id
    WHERE pms.player_id = p.id
    GROUP BY t.name, t.logo_url ORDER BY count(*) DESC LIMIT 1
  ) tm ON true
  WHERE flp.league_id = lg.league_id
    AND COALESCE(flp.is_available, true) = true
  ORDER BY flp.pgs DESC NULLS LAST;
$$;
GRANT EXECUTE ON FUNCTION public.get_available_fantasy_players(UUID) TO authenticated, anon, service_role;
