-- Broaden the autocomplete pool to ALL players (was limited to those with season stats).
CREATE OR REPLACE FUNCTION public.puzzle_player_index()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH club_noto AS (
    SELECT t.player_id, max(COALESCE(tp.popularity,30)) noto
    FROM (SELECT player_id, team_in_api api FROM public.fb_transfers WHERE team_in_api IS NOT NULL
          UNION ALL SELECT player_id, team_out_api FROM public.fb_transfers WHERE team_out_api IS NOT NULL) t
    LEFT JOIN public.team_popularity tp ON tp.team_api_id = t.api GROUP BY t.player_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', p.api_id, 'n', p.name, 'p', p.photo, 'r', COALESCE(cn.noto,30))), '[]'::jsonb)
  FROM public.fb_players p
  LEFT JOIN club_noto cn ON cn.player_id = p.api_id
  WHERE p.api_id IS NOT NULL AND p.name IS NOT NULL;
$$;
