-- ============================================================================
-- SEED — "SWIPE ME — Match Day": a prediction (swipe) game wired to TODAY's
-- upcoming fixtures, for testing join -> swipe predictions -> live settle.
-- No pre-join (so the JOIN flow can be tested). Idempotent.
-- ============================================================================
DO $$
DECLARE
  v_c  UUID := '44444444-4444-4444-8444-444444444444';
  v_md UUID;
BEGIN
  INSERT INTO public.challenges (id, name, game_type, format, sport, status, entry_cost, start_date, end_date, rules, prizes)
  VALUES (v_c, 'SWIPE ME — Match Day', 'prediction', 'leaderboard', 'football', 'active', 2000,
          '2026-06-07T00:00:00Z', '2026-06-07T23:59:59Z',
          '{"tier":"amateur","period_type":"matchdays","duration_type":"flash"}'::jsonb,
          '[{"positionType":"rank","start":1,"end":1,"rewards":[{"type":"coins","value":3000}]}]'::jsonb)
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.challenge_configs WHERE challenge_id = v_c) THEN
    INSERT INTO public.challenge_configs (challenge_id, config_type, config_data)
    VALUES (v_c, 'prediction',
      '{"tier":"amateur","entry_cost":2000,"duration_type":"flash","minimum_level":"Rookie","required_badges":[],"requires_subscription":false}'::jsonb);
  END IF;

  INSERT INTO public.challenge_matchdays (challenge_id, date, status, deadline)
  VALUES (v_c, DATE '2026-06-07', 'upcoming', NULL)
  ON CONFLICT (challenge_id, date) DO NOTHING;
  SELECT id INTO v_md FROM public.challenge_matchdays WHERE challenge_id = v_c AND date = DATE '2026-06-07';

  -- All of today's upcoming fixtures
  INSERT INTO public.matchday_fixtures (matchday_id, fixture_id)
  SELECT v_md, f.id
  FROM public.fb_fixtures f
  WHERE f.date::date = DATE '2026-06-07'
    AND f.status = 'NS'
    AND f.date > now()
  ON CONFLICT DO NOTHING;
END $$;
