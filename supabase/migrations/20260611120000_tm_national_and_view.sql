-- National-team data (for trivia/themes) + a convenience view of every club a player touched.
ALTER TABLE public.tm_players ADD COLUMN IF NOT EXISTS nt_team  TEXT;
ALTER TABLE public.tm_players ADD COLUMN IF NOT EXISTS caps     INTEGER;
ALTER TABLE public.tm_players ADD COLUMN IF NOT EXISTS nt_goals INTEGER;

-- Box2Box / "all clubs of a player": union of squad memberships + transfer endpoints.
CREATE OR REPLACE VIEW public.tm_player_clubs AS
  SELECT DISTINCT sm.player_id, sm.club_id, c.name AS club_name
  FROM public.tm_squad_memberships sm LEFT JOIN public.tm_clubs c ON c.club_id = sm.club_id
  WHERE sm.club_id IS NOT NULL
  UNION
  SELECT t.player_id, t.to_club_id, t.to_club_name FROM public.tm_transfers t WHERE t.to_club_id IS NOT NULL
  UNION
  SELECT t.player_id, t.from_club_id, t.from_club_name FROM public.tm_transfers t WHERE t.from_club_id IS NOT NULL;
GRANT SELECT ON public.tm_player_clubs TO anon, authenticated;
