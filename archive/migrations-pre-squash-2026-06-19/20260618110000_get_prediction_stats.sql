-- =====================================================
-- get_prediction_stats — advanced (but clear) prediction analytics for the
-- Premium stats screen. Reads existing swipe_predictions; no new pipeline, no HPI.
-- Returns: overall accuracy, accuracy by pick type (home/draw/away),
-- last-30-days accuracy, and the current correct-prediction streak.
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_prediction_stats(p_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := COALESCE(p_user_id, auth.uid());
  v_total INT; v_correct INT;
  v_l30_total INT; v_l30_correct INT;
  v_streak INT;
  v_by JSONB;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;

  -- Overall (settled predictions only)
  SELECT count(*) FILTER (WHERE is_correct IS NOT NULL),
         count(*) FILTER (WHERE is_correct)
    INTO v_total, v_correct
  FROM public.swipe_predictions WHERE user_id = v_user;

  -- Last 30 days
  SELECT count(*) FILTER (WHERE is_correct IS NOT NULL),
         count(*) FILTER (WHERE is_correct)
    INTO v_l30_total, v_l30_correct
  FROM public.swipe_predictions
  WHERE user_id = v_user AND created_at >= now() - interval '30 days';

  -- By pick type
  SELECT jsonb_object_agg(prediction, jsonb_build_object('total', t, 'correct', c))
    INTO v_by
  FROM (
    SELECT prediction,
           count(*) FILTER (WHERE is_correct IS NOT NULL) AS t,
           count(*) FILTER (WHERE is_correct) AS c
    FROM public.swipe_predictions
    WHERE user_id = v_user
    GROUP BY prediction
  ) s;

  -- Current streak = consecutive correct from the most recent settled predictions.
  SELECT count(*) INTO v_streak FROM (
    SELECT sum(CASE WHEN is_correct THEN 0 ELSE 1 END)
             OVER (ORDER BY created_at DESC) AS grp
    FROM public.swipe_predictions
    WHERE user_id = v_user AND is_correct IS NOT NULL
  ) q WHERE grp = 0;

  RETURN jsonb_build_object(
    'ok', true,
    'total', COALESCE(v_total, 0),
    'correct', COALESCE(v_correct, 0),
    'accuracy_pct', CASE WHEN COALESCE(v_total, 0) > 0 THEN round(100.0 * v_correct / v_total) ELSE 0 END,
    'by_type', COALESCE(v_by, '{}'::jsonb),
    'last30', jsonb_build_object(
      'total', COALESCE(v_l30_total, 0),
      'correct', COALESCE(v_l30_correct, 0),
      'accuracy_pct', CASE WHEN COALESCE(v_l30_total, 0) > 0 THEN round(100.0 * v_l30_correct / v_l30_total) ELSE 0 END),
    'current_streak', COALESCE(v_streak, 0)
  );
END $$;

GRANT EXECUTE ON FUNCTION public.get_prediction_stats(UUID) TO authenticated;
