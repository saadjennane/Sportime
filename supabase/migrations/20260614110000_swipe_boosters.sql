-- Swipe/Prediction boosters: one x2 and one x3 per GAME (challenge), each on a
-- single predicted, not-yet-started match. Multiplies that match's points at settle.

ALTER TABLE public.swipe_predictions ADD COLUMN IF NOT EXISTS booster TEXT
  CHECK (booster IS NULL OR booster IN ('x2', 'x3'));

-- Set / move / clear a booster. Enforces 1 of each type per (user, challenge).
CREATE OR REPLACE FUNCTION public.swipe_set_booster(
  p_challenge_id UUID, p_matchday_id UUID, p_fixture_id UUID, p_booster TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_date TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_booster IS NOT NULL AND p_booster NOT IN ('x2', 'x3') THEN RAISE EXCEPTION 'invalid_booster'; END IF;

  -- A booster can't be changed once the match has kicked off.
  SELECT date INTO v_date FROM public.fb_fixtures WHERE id = p_fixture_id;
  IF v_date IS NOT NULL AND v_date <= now() THEN RAISE EXCEPTION 'match_started'; END IF;

  IF p_booster IS NULL THEN
    UPDATE public.swipe_predictions SET booster = NULL, updated_at = now()
    WHERE challenge_id = p_challenge_id AND user_id = v_uid AND fixture_id = p_fixture_id;
    RETURN;
  END IF;

  -- You can only boost a match you've predicted.
  IF NOT EXISTS (
    SELECT 1 FROM public.swipe_predictions
    WHERE challenge_id = p_challenge_id AND user_id = v_uid AND fixture_id = p_fixture_id
  ) THEN
    RAISE EXCEPTION 'no_prediction';
  END IF;

  -- One of each type per game: free this type from any other match first.
  UPDATE public.swipe_predictions SET booster = NULL, updated_at = now()
  WHERE challenge_id = p_challenge_id AND user_id = v_uid AND booster = p_booster AND fixture_id <> p_fixture_id;

  -- Apply (replaces any other booster already on this same match).
  UPDATE public.swipe_predictions SET booster = p_booster, updated_at = now()
  WHERE challenge_id = p_challenge_id AND user_id = v_uid AND fixture_id = p_fixture_id;
END $$;

GRANT EXECUTE ON FUNCTION public.swipe_set_booster(UUID, UUID, UUID, TEXT) TO authenticated, service_role;

-- Re-create the settle engine with the booster multiplier applied to correct picks.
CREATE OR REPLACE FUNCTION public.settle_swipe_predictions_for_fixture(p_fixture_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_fixture RECORD; v_result TEXT; v_is_void BOOLEAN := false;
  v_pred RECORD; v_odds NUMERIC; v_correct BOOLEAN; v_points INTEGER;
  v_mult NUMERIC; v_count INTEGER := 0; v_chal UUID;
BEGIN
  SELECT id, status, goals_home, goals_away INTO v_fixture
  FROM public.fb_fixtures WHERE id = p_fixture_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  IF v_fixture.status IN ('FT', 'AET', 'PEN') THEN
    IF COALESCE(v_fixture.goals_home, 0) > COALESCE(v_fixture.goals_away, 0) THEN v_result := 'home';
    ELSIF COALESCE(v_fixture.goals_home, 0) < COALESCE(v_fixture.goals_away, 0) THEN v_result := 'away';
    ELSE v_result := 'draw'; END IF;
  ELSIF v_fixture.status IN ('CANC', 'ABD', 'WO', 'AWD', 'POST', 'PST') THEN
    v_is_void := true;
  ELSE
    RETURN 0;
  END IF;

  FOR v_pred IN
    SELECT id, prediction, odds_at_prediction, booster
    FROM public.swipe_predictions
    WHERE fixture_id = p_fixture_id AND is_correct IS NULL
  LOOP
    IF v_is_void THEN
      v_correct := false; v_points := 0;
    ELSE
      v_correct := (v_pred.prediction = v_result);
      IF v_correct THEN
        v_odds := COALESCE((v_pred.odds_at_prediction->>v_pred.prediction)::NUMERIC, 1);
        v_mult := CASE v_pred.booster WHEN 'x2' THEN 2 WHEN 'x3' THEN 3 ELSE 1 END;
        v_points := ROUND(v_odds * 100 * v_mult);
      ELSE
        v_points := 0;
      END IF;
    END IF;

    UPDATE public.swipe_predictions
    SET is_correct = v_correct, points_earned = v_points
    WHERE id = v_pred.id;
    v_count := v_count + 1;
  END LOOP;

  FOR v_chal IN
    SELECT DISTINCT challenge_id FROM public.swipe_predictions WHERE fixture_id = p_fixture_id
  LOOP
    PERFORM public.update_challenge_rankings(v_chal);
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.settle_swipe_predictions_for_fixture(UUID) TO authenticated, anon, service_role;
