-- ============================================================================
-- SWIPE / PREDICTION — settle engine on fb_fixtures
-- The legacy edge function read the wrong `fixtures` table and was never invoked.
-- Here we score predictions from fb_fixtures (the real results). Setting
-- is_correct/points_earned fires the existing AFTER-UPDATE trigger, which
-- recomputes matchday_participants + challenge_participants. Idempotent
-- (only predictions with is_correct IS NULL are processed).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.settle_swipe_predictions_for_fixture(p_fixture_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_fixture RECORD;
  v_result TEXT;     -- 'home' | 'draw' | 'away' | NULL (void)
  v_is_void BOOLEAN := false;
  v_pred RECORD;
  v_odds NUMERIC;
  v_correct BOOLEAN;
  v_points INTEGER;
  v_count INTEGER := 0;
  v_chal UUID;
BEGIN
  SELECT id, status, goals_home, goals_away INTO v_fixture
  FROM public.fb_fixtures WHERE id = p_fixture_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  IF v_fixture.status IN ('FT', 'AET', 'PEN') THEN
    IF COALESCE(v_fixture.goals_home, 0) > COALESCE(v_fixture.goals_away, 0) THEN
      v_result := 'home';
    ELSIF COALESCE(v_fixture.goals_home, 0) < COALESCE(v_fixture.goals_away, 0) THEN
      v_result := 'away';
    ELSE
      v_result := 'draw';
    END IF;
  ELSIF v_fixture.status IN ('CANC', 'ABD', 'WO', 'AWD', 'POST', 'PST') THEN
    v_is_void := true;  -- predictions settled with 0 points
  ELSE
    RETURN 0;  -- not finished yet
  END IF;

  FOR v_pred IN
    SELECT id, prediction, odds_at_prediction
    FROM public.swipe_predictions
    WHERE fixture_id = p_fixture_id AND is_correct IS NULL
  LOOP
    IF v_is_void THEN
      v_correct := false;
      v_points := 0;
    ELSE
      v_correct := (v_pred.prediction = v_result);
      IF v_correct THEN
        v_odds := COALESCE((v_pred.odds_at_prediction->>v_pred.prediction)::NUMERIC, 1);
        v_points := ROUND(v_odds * 100);
      ELSE
        v_points := 0;
      END IF;
    END IF;

    -- Fires trigger_update_stats_on_prediction -> recomputes matchday + challenge points
    UPDATE public.swipe_predictions
    SET is_correct = v_correct, points_earned = v_points
    WHERE id = v_pred.id;

    v_count := v_count + 1;
  END LOOP;

  -- Refresh ranks for every challenge touched by this fixture
  FOR v_chal IN
    SELECT DISTINCT challenge_id FROM public.swipe_predictions WHERE fixture_id = p_fixture_id
  LOOP
    PERFORM public.update_challenge_rankings(v_chal);
  END LOOP;

  RETURN v_count;
END;
$$;

-- Catch-up: settle any finished fixture that still has unscored predictions.
CREATE OR REPLACE FUNCTION public.settle_finished_unsettled_predictions()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_fixture_id UUID;
  v_total INTEGER := 0;
BEGIN
  FOR v_fixture_id IN
    SELECT DISTINCT f.id
    FROM public.fb_fixtures f
    JOIN public.swipe_predictions sp ON sp.fixture_id = f.id
    WHERE sp.is_correct IS NULL
      AND f.status IN ('FT', 'AET', 'PEN', 'CANC', 'ABD', 'WO', 'AWD', 'POST', 'PST')
  LOOP
    v_total := v_total + public.settle_swipe_predictions_for_fixture(v_fixture_id);
  END LOOP;
  RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.settle_swipe_predictions_for_fixture(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.settle_finished_unsettled_predictions() TO authenticated, anon, service_role;

-- Safety-net cron every 10 minutes.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'settle-swipe-predictions') THEN
      PERFORM cron.unschedule('settle-swipe-predictions');
    END IF;
    PERFORM cron.schedule(
      'settle-swipe-predictions',
      '*/10 * * * *',
      $cron$ SELECT public.settle_finished_unsettled_predictions(); $cron$
    );
  END IF;
END;
$$;

-- Settle the existing backlog right now.
SELECT public.settle_finished_unsettled_predictions();
