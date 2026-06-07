-- ============================================================================
-- Secure bet placement for betting challenges.
-- Server validates: challenge not finished, each fixture NOT started
-- (fb_fixtures.date > now), daily stake within challengeBalance budget; and
-- snapshots the odds server-side (fb_odds) — clients can't forge odds or bet late.
-- Replaces the client-side saveDailyEntry direct inserts.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.place_challenge_bets(
  p_challenge_id UUID,
  p_user_id UUID,
  p_day_number INTEGER,
  p_bets JSONB,                          -- [{challengeMatchId, prediction, amount}]
  p_booster JSONB DEFAULT NULL,          -- {type:'x2'|'x3', matchId} | null
  p_entry_method TEXT DEFAULT 'coins',
  p_ticket_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status TEXT;
  v_rules JSONB;
  v_budget INTEGER;
  v_total INTEGER := 0;
  v_entry UUID;
  v_daily UUID;
  v_bet JSONB;
  v_fix_date TIMESTAMPTZ;
  v_odds RECORD;
  v_booster_type TEXT := NULL;
  v_booster_match UUID := NULL;
  v_fixture UUID;
  v_pred TEXT;
  v_amount INTEGER;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT status::text, rules INTO v_status, v_rules
  FROM public.challenges WHERE id = p_challenge_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Challenge not found'; END IF;
  IF v_status = 'finished' THEN RAISE EXCEPTION 'challenge_finished'; END IF;

  v_budget := COALESCE((v_rules->>'challengeBalance')::int, 1000);

  -- Total stake must fit the daily budget
  SELECT COALESCE(SUM((b->>'amount')::int), 0) INTO v_total
  FROM jsonb_array_elements(COALESCE(p_bets, '[]'::jsonb)) b;
  IF v_total > v_budget THEN RAISE EXCEPTION 'over_budget'; END IF;

  IF p_booster IS NOT NULL AND p_booster ? 'type' THEN
    v_booster_type := p_booster->>'type';
    v_booster_match := NULLIF(p_booster->>'matchId', '')::uuid;
  END IF;

  -- Validate every fixture exists and has NOT started
  FOR v_bet IN SELECT value FROM jsonb_array_elements(COALESCE(p_bets, '[]'::jsonb)) AS value
  LOOP
    v_fixture := (v_bet->>'challengeMatchId')::uuid;
    SELECT f.date INTO v_fix_date FROM public.fb_fixtures f WHERE f.id = v_fixture;
    IF NOT FOUND THEN RAISE EXCEPTION 'fixture_not_found'; END IF;
    IF v_fix_date <= now() THEN RAISE EXCEPTION 'match_started'; END IF;
  END LOOP;

  -- Upsert entry + daily entry
  INSERT INTO public.challenge_entries (challenge_id, user_id, entry_method, ticket_id)
  VALUES (p_challenge_id, p_user_id, p_entry_method, p_ticket_id)
  ON CONFLICT (challenge_id, user_id) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_entry;

  INSERT INTO public.challenge_daily_entries (challenge_entry_id, day_number, booster_type, booster_match_id)
  VALUES (v_entry, p_day_number, v_booster_type, v_booster_match)
  ON CONFLICT (challenge_entry_id, day_number) DO UPDATE
    SET booster_type = EXCLUDED.booster_type,
        booster_match_id = EXCLUDED.booster_match_id,
        updated_at = now()
  RETURNING id INTO v_daily;

  -- Replace the day's bets with server-snapshotted odds
  DELETE FROM public.challenge_bets WHERE daily_entry_id = v_daily;

  FOR v_bet IN SELECT value FROM jsonb_array_elements(COALESCE(p_bets, '[]'::jsonb)) AS value
  LOOP
    v_fixture := (v_bet->>'challengeMatchId')::uuid;
    v_pred := v_bet->>'prediction';
    v_amount := (v_bet->>'amount')::int;

    SELECT o.home_win, o.draw, o.away_win INTO v_odds
    FROM public.fb_odds o
    WHERE o.fixture_id = v_fixture AND o.home_win IS NOT NULL
    ORDER BY CASE o.bookmaker_name WHEN 'Pinnacle' THEN 0 WHEN 'Bet365' THEN 1 ELSE 2 END,
             o.updated_at DESC
    LIMIT 1;

    INSERT INTO public.challenge_bets (daily_entry_id, challenge_match_id, prediction, amount, odds_snapshot, status)
    VALUES (
      v_daily, v_fixture, v_pred, v_amount,
      CASE WHEN v_odds.home_win IS NOT NULL
        THEN jsonb_build_object('teamA', v_odds.home_win, 'draw', v_odds.draw, 'teamB', v_odds.away_win)
        ELSE NULL END,
      'pending'
    );
  END LOOP;

  RETURN v_daily;
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_challenge_bets(UUID, UUID, INTEGER, JSONB, JSONB, TEXT, UUID)
  TO authenticated, anon, service_role;
