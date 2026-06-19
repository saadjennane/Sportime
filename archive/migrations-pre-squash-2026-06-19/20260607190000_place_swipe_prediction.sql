-- ============================================================================
-- Secure swipe/prediction placement.
-- Server validates: challenge not finished, user joined, fixture belongs to the
-- matchday and has NOT started (fb_fixtures.date > now); and snapshots the odds
-- server-side (fb_odds). Replaces the client-side savePrediction upsert.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.place_swipe_prediction(
  p_challenge_id UUID,
  p_matchday_id UUID,
  p_user_id UUID,
  p_fixture_id UUID,
  p_prediction TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status TEXT;
  v_date TIMESTAMPTZ;
  v_odds RECORD;
  v_snapshot JSONB;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_prediction NOT IN ('home', 'draw', 'away') THEN
    RAISE EXCEPTION 'invalid_prediction';
  END IF;

  SELECT status::text INTO v_status FROM public.challenges WHERE id = p_challenge_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Challenge not found'; END IF;
  IF v_status = 'finished' THEN RAISE EXCEPTION 'challenge_finished'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.challenge_participants
    WHERE challenge_id = p_challenge_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'not_joined';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.matchday_fixtures
    WHERE matchday_id = p_matchday_id AND fixture_id = p_fixture_id
  ) THEN
    RAISE EXCEPTION 'fixture_not_in_matchday';
  END IF;

  SELECT date INTO v_date FROM public.fb_fixtures WHERE id = p_fixture_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'fixture_not_found'; END IF;
  IF v_date <= now() THEN RAISE EXCEPTION 'match_started'; END IF;

  -- Server-side odds snapshot (prefer Pinnacle/Bet365, most recent)
  SELECT o.home_win, o.draw, o.away_win INTO v_odds
  FROM public.fb_odds o
  WHERE o.fixture_id = p_fixture_id AND o.home_win IS NOT NULL
  ORDER BY CASE o.bookmaker_name WHEN 'Pinnacle' THEN 0 WHEN 'Bet365' THEN 1 ELSE 2 END,
           o.updated_at DESC
  LIMIT 1;

  v_snapshot := CASE WHEN v_odds.home_win IS NOT NULL
    THEN jsonb_build_object('home', v_odds.home_win, 'draw', v_odds.draw, 'away', v_odds.away_win)
    ELSE jsonb_build_object('home', 1, 'draw', 1, 'away', 1) END;

  INSERT INTO public.swipe_predictions (challenge_id, matchday_id, user_id, fixture_id, prediction, odds_at_prediction)
  VALUES (p_challenge_id, p_matchday_id, p_user_id, p_fixture_id, p_prediction, v_snapshot)
  ON CONFLICT (challenge_id, user_id, fixture_id) DO UPDATE
  SET prediction = EXCLUDED.prediction,
      odds_at_prediction = EXCLUDED.odds_at_prediction,
      is_correct = NULL,
      points_earned = 0,
      updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_swipe_prediction(UUID, UUID, UUID, UUID, TEXT)
  TO authenticated, anon, service_role;
