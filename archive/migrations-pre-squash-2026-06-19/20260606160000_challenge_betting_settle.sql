-- ============================================================================
-- BETTING CHALLENGES — SETTLE ENGINE on fb_fixtures
-- ============================================================================
-- The real match results live in fb_fixtures (updated by sync-live-scores).
-- challenge_bets.challenge_match_id stores the fb_fixtures.id directly.
-- This migration scores bets from fb_fixtures (the legacy matches/challenge_matches
-- path is abandoned), recomputes challenge_participants points + ranks.
-- Idempotent: only 'pending' bets are processed.
-- ============================================================================

-- 1) Settlement columns on challenge_bets ------------------------------------
ALTER TABLE public.challenge_bets
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'won', 'lost', 'void')),
  ADD COLUMN IF NOT EXISTS points_earned INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_challenge_bets_match_status
  ON public.challenge_bets (challenge_match_id, status);

-- 2) Recompute a single participant's total points + refresh ranks -----------
CREATE OR REPLACE FUNCTION public.recalc_challenge_participant(
  p_challenge_id UUID,
  p_user_id UUID
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total INTEGER;
BEGIN
  SELECT COALESCE(SUM(cb.points_earned), 0) INTO v_total
  FROM public.challenge_bets cb
  JOIN public.challenge_daily_entries cde ON cde.id = cb.daily_entry_id
  JOIN public.challenge_entries ce ON ce.id = cde.challenge_entry_id
  WHERE ce.challenge_id = p_challenge_id
    AND ce.user_id = p_user_id;

  UPDATE public.challenge_participants
  SET points = v_total
  WHERE challenge_id = p_challenge_id AND user_id = p_user_id;
END;
$$;

-- 3) Settle all pending bets on a finished fixture ---------------------------
CREATE OR REPLACE FUNCTION public.settle_challenge_bets_for_fixture(
  p_fixture_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_fixture RECORD;
  v_result TEXT;          -- 'teamA' | 'draw' | 'teamB' | NULL (void)
  v_is_void BOOLEAN := false;
  v_bet RECORD;
  v_odds NUMERIC;
  v_mult NUMERIC;
  v_points INTEGER;
  v_settled INTEGER := 0;
  v_pair RECORD;
BEGIN
  SELECT id, status, goals_home, goals_away
    INTO v_fixture
  FROM public.fb_fixtures
  WHERE id = p_fixture_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Determine outcome from the fixture status
  IF v_fixture.status IN ('FT', 'AET', 'PEN') THEN
    IF COALESCE(v_fixture.goals_home, 0) > COALESCE(v_fixture.goals_away, 0) THEN
      v_result := 'teamA';
    ELSIF COALESCE(v_fixture.goals_home, 0) < COALESCE(v_fixture.goals_away, 0) THEN
      v_result := 'teamB';
    ELSE
      v_result := 'draw';
    END IF;
  ELSIF v_fixture.status IN ('CANC', 'ABD', 'WO', 'AWD', 'POST', 'PST') THEN
    v_is_void := true;  -- bets voided (0 points)
  ELSE
    RETURN 0;  -- not finished yet, nothing to do
  END IF;

  -- Score each pending bet on this fixture
  FOR v_bet IN
    SELECT cb.id, cb.daily_entry_id, cb.prediction, cb.amount, cb.odds_snapshot,
           cde.booster_type, cde.booster_match_id
    FROM public.challenge_bets cb
    JOIN public.challenge_daily_entries cde ON cde.id = cb.daily_entry_id
    WHERE cb.challenge_match_id = p_fixture_id
      AND cb.status = 'pending'
  LOOP
    IF v_is_void THEN
      UPDATE public.challenge_bets
      SET status = 'void', points_earned = 0, settled_at = now()
      WHERE id = v_bet.id;
      v_settled := v_settled + 1;
      CONTINUE;
    END IF;

    IF v_bet.prediction = v_result THEN
      v_odds := COALESCE((v_bet.odds_snapshot->>v_bet.prediction)::NUMERIC, 1);
      v_mult := 1;
      IF v_bet.booster_match_id = p_fixture_id THEN
        v_mult := CASE v_bet.booster_type
                    WHEN 'x2' THEN 2 WHEN 'x3' THEN 3 ELSE 1 END;
      END IF;
      v_points := FLOOR(v_odds * v_bet.amount * v_mult);
      UPDATE public.challenge_bets
      SET status = 'won', points_earned = v_points, settled_at = now()
      WHERE id = v_bet.id;
    ELSE
      UPDATE public.challenge_bets
      SET status = 'lost', points_earned = 0, settled_at = now()
      WHERE id = v_bet.id;
    END IF;
    v_settled := v_settled + 1;
  END LOOP;

  -- Recompute points for every (challenge, user) touched by this fixture
  FOR v_pair IN
    SELECT DISTINCT ce.challenge_id, ce.user_id
    FROM public.challenge_bets cb
    JOIN public.challenge_daily_entries cde ON cde.id = cb.daily_entry_id
    JOIN public.challenge_entries ce ON ce.id = cde.challenge_entry_id
    WHERE cb.challenge_match_id = p_fixture_id
  LOOP
    PERFORM public.recalc_challenge_participant(v_pair.challenge_id, v_pair.user_id);
  END LOOP;

  -- Refresh ranks for affected challenges
  FOR v_pair IN
    SELECT DISTINCT ce.challenge_id
    FROM public.challenge_bets cb
    JOIN public.challenge_daily_entries cde ON cde.id = cb.daily_entry_id
    JOIN public.challenge_entries ce ON ce.id = cde.challenge_entry_id
    WHERE cb.challenge_match_id = p_fixture_id
  LOOP
    PERFORM public.update_challenge_rankings(v_pair.challenge_id);
  END LOOP;

  RETURN v_settled;
END;
$$;

-- 4) Catch-up: settle any finished fixture that still has pending bets --------
CREATE OR REPLACE FUNCTION public.settle_finished_unsettled_bets()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_fixture_id UUID;
  v_total INTEGER := 0;
BEGIN
  FOR v_fixture_id IN
    SELECT DISTINCT f.id
    FROM public.fb_fixtures f
    JOIN public.challenge_bets cb ON cb.challenge_match_id = f.id
    WHERE cb.status = 'pending'
      AND f.status IN ('FT', 'AET', 'PEN', 'CANC', 'ABD', 'WO', 'AWD', 'POST', 'PST')
  LOOP
    v_total := v_total + public.settle_challenge_bets_for_fixture(v_fixture_id);
  END LOOP;
  RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.settle_challenge_bets_for_fixture(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.settle_finished_unsettled_bets() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.recalc_challenge_participant(UUID, UUID) TO authenticated, anon, service_role;

-- 5) Safety-net cron: catch-up every 10 minutes ------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'settle-challenge-bets') THEN
      PERFORM cron.unschedule('settle-challenge-bets');
    END IF;
    PERFORM cron.schedule(
      'settle-challenge-bets',
      '*/10 * * * *',
      $cron$ SELECT public.settle_finished_unsettled_bets(); $cron$
    );
  END IF;
END;
$$;
