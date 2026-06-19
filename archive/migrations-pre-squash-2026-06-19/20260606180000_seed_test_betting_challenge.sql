-- ============================================================================
-- SEED — TEST betting challenge (Match Day) wired to today's FINISHED fixtures
-- End-to-end demo of: join -> bets -> settle -> ranking -> finalize -> prize.
-- Safe to re-run (guards). Remove later when done testing.
-- ============================================================================
DO $$
DECLARE
  v_user  UUID;
  v_chal  UUID := '11111111-1111-4111-8111-111111111111';
  v_md    UUID;
  v_entry UUID;
  v_daily UUID;
BEGIN
  SELECT id INTO v_user FROM auth.users WHERE email = 'saadjennane@gmail.com' LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Test user not found'; END IF;

  -- Challenge (window already ended so finalize fires; status set by finalize)
  INSERT INTO public.challenges (id, name, game_type, format, sport, status, entry_cost, start_date, end_date, rules, prizes)
  VALUES (
    v_chal, 'TEST Match Day — Settle', 'betting', 'leaderboard', 'football', 'active', 2000,
    '2026-06-06T00:00:00Z', now() - interval '1 minute',
    '{"tier":"amateur","period_type":"matchdays","duration_type":"flash","challengeBalance":1000}'::jsonb,
    '[{"positionType":"rank","start":1,"end":1,"rewards":[{"type":"coins","value":5000}]}]'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.challenge_configs WHERE challenge_id = v_chal) THEN
    INSERT INTO public.challenge_configs (challenge_id, config_type, config_data)
    VALUES (v_chal, 'betting',
      '{"tier":"amateur","entry_cost":2000,"duration_type":"flash","minimum_level":"Rookie","required_badges":[],"requires_subscription":false}'::jsonb);
  END IF;

  -- Matchday (today) + fixtures
  INSERT INTO public.challenge_matchdays (challenge_id, date, status, deadline)
  VALUES (v_chal, DATE '2026-06-06', 'finished', '2026-06-06T12:00:00Z')
  ON CONFLICT (challenge_id, date) DO NOTHING;
  SELECT id INTO v_md FROM public.challenge_matchdays WHERE challenge_id = v_chal AND date = DATE '2026-06-06';

  INSERT INTO public.matchday_fixtures (matchday_id, fixture_id) VALUES
    (v_md, '82f1ecfb-84df-497d-9cc6-22360caaccd8'),
    (v_md, '0cdfd050-1de5-4ab5-8866-2558bc46dee8'),
    (v_md, '433454b7-7b23-4d29-8018-cb031c57f3a5'),
    (v_md, 'bd5797df-223a-4a25-b732-dba9b08b4f6c'),
    (v_md, 'bdafbaef-f04b-46b8-a895-bd140e8ca0e2')
  ON CONFLICT DO NOTHING;

  -- Join the test user
  INSERT INTO public.challenge_participants (challenge_id, user_id)
  VALUES (v_chal, v_user) ON CONFLICT (challenge_id, user_id) DO NOTHING;

  INSERT INTO public.challenge_entries (challenge_id, user_id, entry_method)
  VALUES (v_chal, v_user, 'coins')
  ON CONFLICT (challenge_id, user_id) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_entry;

  INSERT INTO public.challenge_daily_entries (challenge_entry_id, day_number)
  VALUES (v_entry, 1)
  ON CONFLICT (challenge_entry_id, day_number) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_daily;

  -- Bets (mix of wins/losses vs the real results)
  --  82f1ecfb 1-2 (teamB) | 0cdfd050 5-0 (teamA) | 433454b7 2-1 (teamA)
  --  bd5797df 1-0 (teamA)  | bdafbaef 0-0 (draw)
  DELETE FROM public.challenge_bets WHERE daily_entry_id = v_daily;
  INSERT INTO public.challenge_bets (daily_entry_id, challenge_match_id, prediction, amount, odds_snapshot) VALUES
    (v_daily, '82f1ecfb-84df-497d-9cc6-22360caaccd8', 'teamB', 200, '{"teamA":2.5,"draw":3.2,"teamB":2.8}'::jsonb), -- WIN
    (v_daily, '0cdfd050-1de5-4ab5-8866-2558bc46dee8', 'teamA', 200, '{"teamA":1.5,"draw":4.0,"teamB":6.0}'::jsonb), -- WIN
    (v_daily, '433454b7-7b23-4d29-8018-cb031c57f3a5', 'draw',  100, '{"teamA":2.0,"draw":3.2,"teamB":3.5}'::jsonb), -- LOSE
    (v_daily, 'bd5797df-223a-4a25-b732-dba9b08b4f6c', 'teamA', 100, '{"teamA":2.0,"draw":3.0,"teamB":3.5}'::jsonb), -- WIN
    (v_daily, 'bdafbaef-f04b-46b8-a895-bd140e8ca0e2', 'draw',  100, '{"teamA":2.4,"draw":3.1,"teamB":3.0}'::jsonb); -- WIN

  -- Run the live engine
  PERFORM public.settle_finished_unsettled_bets();
  PERFORM public.finalize_due_challenges();
END $$;
