-- Use ONLY transfer club names (consistent source) -> avoids "Atlético" vs "Atlético de Madrid".
CREATE OR REPLACE FUNCTION public.puzzle_grid_index()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH pool AS (SELECT DISTINCT player_id FROM public.tm_transfers)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.player_id, 'n', p.name, 'p', p.photo_url, 'nat', p.nationality,
    'by', EXTRACT(YEAR FROM p.date_of_birth)::int,
    'cl', (SELECT array_agg(DISTINCT c) FROM (
              SELECT from_club_name c FROM public.tm_transfers t WHERE t.player_id=p.player_id AND from_club_name IS NOT NULL
              UNION SELECT to_club_name FROM public.tm_transfers t WHERE t.player_id=p.player_id AND to_club_name IS NOT NULL
           ) z WHERE c !~* '(U1[5-9]|U2[0-3]|youth|yth|giov|reserve|castilla|madrileñ|without club|retired|career break|unknown| B$| II$| C$)'),
    'tr', (SELECT array_agg(DISTINCT trophy) FROM public.tm_trophies WHERE player_id=p.player_id)
  )), '[]'::jsonb)
  FROM public.tm_players p JOIN pool ON pool.player_id = p.player_id
  WHERE p.name IS NOT NULL;
$$;
