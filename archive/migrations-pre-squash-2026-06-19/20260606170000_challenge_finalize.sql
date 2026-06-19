-- ============================================================================
-- BETTING CHALLENGES — FINALIZATION + AUTOMATIC PRIZE DISTRIBUTION
-- ============================================================================
-- When a betting challenge's window is over (now >= end_date), freeze the final
-- ranking and distribute prizes (challenges.prizes) to ranked participants.
-- Idempotent: a challenge is finalized at most once (guarded by status='finished'
-- + a prizes_distributed flag).
-- ============================================================================

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS prizes_distributed BOOLEAN NOT NULL DEFAULT false;

-- Finalize one challenge: final ranks + prize distribution + mark finished.
CREATE OR REPLACE FUNCTION public.finalize_betting_challenge(p_challenge_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_status TEXT;
  v_distributed BOOLEAN;
  v_prizes JSONB;
  v_total INTEGER;
  v_tier JSONB;
  v_ptype TEXT;
  v_start NUMERIC;
  v_end NUMERIC;
  v_lo INTEGER;
  v_hi INTEGER;
  v_participant RECORD;
  v_reward JSONB;
BEGIN
  SELECT status, prizes_distributed, prizes
    INTO v_status, v_distributed, v_prizes
  FROM public.challenges
  WHERE id = p_challenge_id;

  IF NOT FOUND THEN RETURN; END IF;

  -- Always refresh final ranks
  PERFORM public.update_challenge_rankings(p_challenge_id);

  -- Distribute prizes once
  IF NOT v_distributed AND jsonb_typeof(v_prizes) = 'array' THEN
    SELECT COUNT(*) INTO v_total
    FROM public.challenge_participants WHERE challenge_id = p_challenge_id;

    FOR v_tier IN SELECT * FROM jsonb_array_elements(v_prizes)
    LOOP
      v_ptype := COALESCE(v_tier->>'positionType', v_tier->>'position_type', 'rank');
      v_start := COALESCE((v_tier->>'start')::NUMERIC, 1);
      v_end   := COALESCE((v_tier->>'end')::NUMERIC, (v_tier->>'range_end')::NUMERIC, v_start);

      IF v_ptype = 'percent' THEN
        v_lo := GREATEST(1, CEIL(v_start / 100.0 * v_total)::INT);
        v_hi := GREATEST(v_lo, CEIL(v_end / 100.0 * v_total)::INT);
      ELSE
        v_lo := GREATEST(1, v_start::INT);
        v_hi := GREATEST(v_lo, v_end::INT);
      END IF;

      FOR v_participant IN
        SELECT user_id FROM public.challenge_participants
        WHERE challenge_id = p_challenge_id AND rank BETWEEN v_lo AND v_hi
      LOOP
        IF jsonb_typeof(v_tier->'rewards') = 'array' THEN
          FOR v_reward IN SELECT * FROM jsonb_array_elements(v_tier->'rewards')
          LOOP
            BEGIN
              PERFORM public.distribute_reward_to_user(v_participant.user_id, v_reward);
            EXCEPTION WHEN OTHERS THEN
              RAISE NOTICE 'Prize distribution failed for user % : %', v_participant.user_id, SQLERRM;
            END;
          END LOOP;
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  UPDATE public.challenges
  SET status = 'finished', prizes_distributed = true
  WHERE id = p_challenge_id;
END;
$$;

-- Catch-up: finalize every betting challenge whose window has ended.
CREATE OR REPLACE FUNCTION public.finalize_due_challenges()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id UUID;
  v_count INTEGER := 0;
BEGIN
  FOR v_id IN
    SELECT id FROM public.challenges
    WHERE game_type = 'betting'
      AND status <> 'finished'
      AND end_date IS NOT NULL
      AND now() >= end_date
  LOOP
    PERFORM public.finalize_betting_challenge(v_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_betting_challenge(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_due_challenges() TO authenticated, anon, service_role;

-- Safety-net cron: finalize due challenges every 15 minutes.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'finalize-challenges') THEN
      PERFORM cron.unschedule('finalize-challenges');
    END IF;
    PERFORM cron.schedule(
      'finalize-challenges',
      '*/15 * * * *',
      $cron$ SELECT public.finalize_due_challenges(); $cron$
    );
  END IF;
END;
$$;
