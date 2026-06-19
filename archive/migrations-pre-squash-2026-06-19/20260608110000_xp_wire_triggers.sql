-- ============================================================================
-- XP v2 — immediate award via triggers on result tables (decoupled from settle).
-- award_xp() is idempotent (xp_events unique per user+source), so re-settles are safe.
-- Barème:
--   Swipe   : +5 played, +15 if correct (=20)
--   Match   : +10 played, + difficulty bonus 20..60 if won
--   Live    : +10 played, + round(total_points / 4)   (0..50)
-- ============================================================================

-- Swipe ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.xp_on_swipe_settled()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.is_correct IS NULL AND NEW.is_correct IS NOT NULL THEN
    PERFORM public.award_xp(
      NEW.user_id,
      CASE WHEN NEW.is_correct THEN 20 ELSE 5 END,
      'swipe', NEW.id::text, 'Swipe prediction settled'
    );
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_xp_swipe_settled ON public.swipe_predictions;
CREATE TRIGGER trg_xp_swipe_settled AFTER UPDATE ON public.swipe_predictions
  FOR EACH ROW EXECUTE FUNCTION public.xp_on_swipe_settled();

-- Match bets -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.xp_on_match_bet_settled()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_xp INT;
BEGIN
  IF NEW.status IN ('won', 'lost')
     AND OLD.status IS DISTINCT FROM NEW.status
     AND COALESCE(OLD.status, '') NOT IN ('won', 'lost') THEN
    v_xp := 10;  -- participation
    IF NEW.status = 'won' THEN
      v_xp := v_xp + ROUND(20 * (1 + LEAST(GREATEST((COALESCE(NEW.odds, 1) - 1) / 2.0, 0), 2)))::INT;
    END IF;
    PERFORM public.award_xp(NEW.user_id, v_xp, 'match_bet', NEW.id::text, 'Match bet settled');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_xp_match_bet_settled ON public.match_bets;
CREATE TRIGGER trg_xp_match_bet_settled AFTER UPDATE ON public.match_bets
  FOR EACH ROW EXECUTE FUNCTION public.xp_on_match_bet_settled();

-- Live game ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.xp_on_live_settled()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.total_points IS NOT NULL
     AND OLD.total_points IS DISTINCT FROM NEW.total_points THEN
    PERFORM public.award_xp(
      NEW.user_id,
      10 + GREATEST(ROUND(NEW.total_points / 4.0)::INT, 0),
      'live', NEW.id::text, 'Live game settled'
    );
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_xp_live_settled ON public.live_game_entries;
CREATE TRIGGER trg_xp_live_settled AFTER UPDATE ON public.live_game_entries
  FOR EACH ROW EXECUTE FUNCTION public.xp_on_live_settled();
