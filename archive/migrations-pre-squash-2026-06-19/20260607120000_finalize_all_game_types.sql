-- ============================================================================
-- Finalize ALL past-due challenges (not just betting).
-- Prediction/fantasy games whose end_date has passed were stuck at
-- status='upcoming' (only betting was finalized) -> stuck in "Awaiting Results".
-- ============================================================================
CREATE OR REPLACE FUNCTION public.finalize_due_challenges()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id UUID;
  v_count INTEGER := 0;
BEGIN
  FOR v_id IN
    SELECT id FROM public.challenges
    WHERE status <> 'finished'
      AND end_date IS NOT NULL
      AND now() >= end_date
  LOOP
    PERFORM public.finalize_betting_challenge(v_id);  -- generic: ranks + prizes + status
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Unstick existing past-due challenges right now.
SELECT public.finalize_due_challenges();
