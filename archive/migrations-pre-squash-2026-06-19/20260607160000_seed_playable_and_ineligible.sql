-- ============================================================================
-- SEED — two demo betting challenges wired to TODAY's upcoming fixtures:
--   A) "PLAY ME — Match Day"  : Rookie level -> joinable + bettable (test UX)
--   B) "GOAT ONLY — Match Day": GOAT level   -> shows "You're not eligible"
-- No pre-join (so the JOIN flow can be tested). Idempotent.
-- ============================================================================
DO $$
DECLARE
  v_a UUID := '22222222-2222-4222-8222-222222222222';
  v_b UUID := '33333333-3333-4333-8333-333333333333';
  v_md UUID;
BEGIN
  -- ---- A) Joinable (Rookie) ----
  INSERT INTO public.challenges (id, name, game_type, format, sport, status, entry_cost, start_date, end_date, rules, prizes)
  VALUES (v_a, 'PLAY ME — Match Day', 'betting', 'leaderboard', 'football', 'active', 2000,
          '2026-06-07T00:00:00Z', '2026-06-07T23:59:59Z',
          '{"tier":"amateur","period_type":"matchdays","duration_type":"flash","challengeBalance":1000}'::jsonb,
          '[{"positionType":"rank","start":1,"end":1,"rewards":[{"type":"coins","value":3000}]}]'::jsonb)
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.challenge_configs WHERE challenge_id = v_a) THEN
    INSERT INTO public.challenge_configs (challenge_id, config_type, config_data)
    VALUES (v_a, 'betting',
      '{"tier":"amateur","entry_cost":2000,"duration_type":"flash","minimum_level":"Rookie","required_badges":[],"requires_subscription":false}'::jsonb);
  END IF;

  INSERT INTO public.challenge_matchdays (challenge_id, date, status, deadline)
  VALUES (v_a, DATE '2026-06-07', 'upcoming', '2026-06-07T11:00:00Z')
  ON CONFLICT (challenge_id, date) DO NOTHING;
  SELECT id INTO v_md FROM public.challenge_matchdays WHERE challenge_id = v_a AND date = DATE '2026-06-07';

  INSERT INTO public.matchday_fixtures (matchday_id, fixture_id) VALUES
    (v_md, '94deab7e-6698-44fc-984c-8bf3c645393a'),
    (v_md, 'b8bab3bd-1661-4aa1-a753-38dd972e0fb6'),
    (v_md, 'a9d41716-8a5b-49f5-99cf-4ab08940aae4'),
    (v_md, '920ffe03-f97f-4ee4-914b-8e2d2f4ab0b1'),
    (v_md, '3870c348-d0fe-424a-ada0-00626c2bc257')
  ON CONFLICT DO NOTHING;

  -- ---- B) Ineligible (GOAT) ----
  INSERT INTO public.challenges (id, name, game_type, format, sport, status, entry_cost, start_date, end_date, rules, prizes)
  VALUES (v_b, 'GOAT ONLY — Match Day', 'betting', 'leaderboard', 'football', 'active', 2000,
          '2026-06-07T00:00:00Z', '2026-06-07T23:59:59Z',
          '{"tier":"amateur","period_type":"matchdays","duration_type":"flash","challengeBalance":1000}'::jsonb,
          NULL)
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.challenge_configs WHERE challenge_id = v_b) THEN
    INSERT INTO public.challenge_configs (challenge_id, config_type, config_data)
    VALUES (v_b, 'betting',
      '{"tier":"amateur","entry_cost":2000,"duration_type":"flash","minimum_level":"GOAT","required_badges":[],"requires_subscription":false}'::jsonb);
  END IF;

  INSERT INTO public.challenge_matchdays (challenge_id, date, status, deadline)
  VALUES (v_b, DATE '2026-06-07', 'upcoming', '2026-06-07T16:00:00Z')
  ON CONFLICT (challenge_id, date) DO NOTHING;
  SELECT id INTO v_md FROM public.challenge_matchdays WHERE challenge_id = v_b AND date = DATE '2026-06-07';

  INSERT INTO public.matchday_fixtures (matchday_id, fixture_id) VALUES
    (v_md, 'eb5e12e9-ef47-4be5-a678-1eb833801581'),
    (v_md, 'fe784924-0c26-45af-b57c-818a7ecf822f')
  ON CONFLICT DO NOTHING;
END $$;
