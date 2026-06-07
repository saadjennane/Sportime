-- Add ALL of today's upcoming fixtures to the "PLAY ME — Match Day" matchday
-- (a real Match Day includes every match of the day, not a hand-picked subset).
INSERT INTO public.matchday_fixtures (matchday_id, fixture_id)
SELECT md.id, f.id
FROM public.challenge_matchdays md
JOIN public.fb_fixtures f
  ON f.date::date = DATE '2026-06-07'
 AND f.status = 'NS'
WHERE md.challenge_id = '22222222-2222-4222-8222-222222222222'
  AND md.date = DATE '2026-06-07'
ON CONFLICT DO NOTHING;
