-- ============================================================================
-- Live Game A — "Score Prediction": data model + scoring engine on fb_fixtures.
-- Barème (total 200): goal-diff error 0->90/1->72/2->54/3->36/4->18/5+->0,
-- correct 1X2 = 70, 3 bonus questions = 20+10+10. Halftime edit -40% malus on
-- (result + écart) only. Bonus questions are resolvable from the FINAL score so
-- no realtime infra is needed. See memory live-game-scoring.
-- ============================================================================

-- 1) Score-prediction columns on the entry (the table was built for live betting).
ALTER TABLE public.live_game_entries
  ADD COLUMN IF NOT EXISTS predicted_score JSONB,        -- {"home": int, "away": int}
  ADD COLUMN IF NOT EXISTS bonus_questions JSONB DEFAULT '[]'::jsonb, -- [{key, points, prompt}]
  ADD COLUMN IF NOT EXISTS bonus_answers   JSONB DEFAULT '{}'::jsonb, -- {key: "yes"|"no"}
  ADD COLUMN IF NOT EXISTS midtime_edit    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_points    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS goal_diff_error INTEGER,
  ADD COLUMN IF NOT EXISTS rank            INTEGER,
  ADD COLUMN IF NOT EXISTS submitted_at    TIMESTAMPTZ;

-- 2) Resolve one bonus question key against the final score -> 'yes' | 'no'.
CREATE OR REPLACE FUNCTION public.live_bonus_correct(
  p_key TEXT, p_pred JSONB, p_gh INTEGER, p_ga INTEGER
) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_ph INTEGER := COALESCE((p_pred->>'home')::int, 0);
  v_pa INTEGER := COALESCE((p_pred->>'away')::int, 0);
BEGIN
  CASE p_key
    WHEN 'btts'   THEN RETURN CASE WHEN p_gh > 0 AND p_ga > 0 THEN 'yes' ELSE 'no' END;
    WHEN 'over25' THEN RETURN CASE WHEN p_gh + p_ga >= 3 THEN 'yes' ELSE 'no' END;
    WHEN 'nil_nil' THEN RETURN CASE WHEN p_gh = 0 AND p_ga = 0 THEN 'yes' ELSE 'no' END;
    -- Clean sheet for the team the player predicted to win
    WHEN 'clean_sheet_winner' THEN
      IF v_ph > v_pa THEN RETURN CASE WHEN p_ga = 0 THEN 'yes' ELSE 'no' END;
      ELSIF v_pa > v_ph THEN RETURN CASE WHEN p_gh = 0 THEN 'yes' ELSE 'no' END;
      ELSE RETURN 'no'; END IF;
    ELSE RETURN NULL;
  END CASE;
END;
$$;

-- 3) Settle every entry of a live score-prediction game from its fixture result.
CREATE OR REPLACE FUNCTION public.settle_live_game_score(p_game_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_fixture_id UUID;
  v_status TEXT;
  v_gh INTEGER;
  v_ga INTEGER;
  v_actual TEXT;      -- 'home'|'draw'|'away'
  v_entry RECORD;
  v_ph INTEGER;
  v_pa INTEGER;
  v_pred TEXT;
  v_diff_err INTEGER;
  v_diff_pts INTEGER;
  v_res_pts INTEGER;
  v_bonus_pts INTEGER;
  v_q JSONB;
  v_total INTEGER;
  v_count INTEGER := 0;
BEGIN
  SELECT lg.fixture_id INTO v_fixture_id FROM public.live_games lg WHERE lg.id = p_game_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT f.status, f.goals_home, f.goals_away INTO v_status, v_gh, v_ga
  FROM public.fb_fixtures f WHERE f.id = v_fixture_id;

  IF v_status IN ('CANC', 'ABD', 'WO', 'AWD', 'POST', 'PST') THEN
    UPDATE public.live_games SET status = 'cancelled', updated_at = now() WHERE id = p_game_id;
    RETURN 0;
  ELSIF v_status NOT IN ('FT', 'AET', 'PEN') THEN
    RETURN 0;  -- not finished yet
  END IF;

  v_gh := COALESCE(v_gh, 0); v_ga := COALESCE(v_ga, 0);
  v_actual := CASE WHEN v_gh > v_ga THEN 'home' WHEN v_gh < v_ga THEN 'away' ELSE 'draw' END;

  FOR v_entry IN
    SELECT id, predicted_score, bonus_questions, bonus_answers, midtime_edit
    FROM public.live_game_entries
    WHERE live_game_id = p_game_id AND predicted_score IS NOT NULL
  LOOP
    v_ph := COALESCE((v_entry.predicted_score->>'home')::int, 0);
    v_pa := COALESCE((v_entry.predicted_score->>'away')::int, 0);
    v_pred := CASE WHEN v_ph > v_pa THEN 'home' WHEN v_ph < v_pa THEN 'away' ELSE 'draw' END;

    -- Goal-difference error -> points
    v_diff_err := abs((v_ph - v_pa) - (v_gh - v_ga));
    v_diff_pts := CASE v_diff_err
      WHEN 0 THEN 90 WHEN 1 THEN 72 WHEN 2 THEN 54 WHEN 3 THEN 36 WHEN 4 THEN 18 ELSE 0 END;

    -- Correct result
    v_res_pts := CASE WHEN v_pred = v_actual THEN 70 ELSE 0 END;

    -- Bonus questions (resolved from the final score)
    v_bonus_pts := 0;
    FOR v_q IN SELECT * FROM jsonb_array_elements(COALESCE(v_entry.bonus_questions, '[]'::jsonb))
    LOOP
      IF v_entry.bonus_answers->>(v_q->>'key')
         = public.live_bonus_correct(v_q->>'key', v_entry.predicted_score, v_gh, v_ga) THEN
        v_bonus_pts := v_bonus_pts + COALESCE((v_q->>'points')::int, 0);
      END IF;
    END LOOP;

    -- Halftime edit applies -40% to (result + écart) only
    v_total := CASE WHEN v_entry.midtime_edit
      THEN round((v_diff_pts + v_res_pts) * 0.6) ELSE (v_diff_pts + v_res_pts) END
      + v_bonus_pts;

    UPDATE public.live_game_entries
    SET total_points = v_total, goal_diff_error = v_diff_err
    WHERE id = v_entry.id;

    v_count := v_count + 1;
  END LOOP;

  -- Ranks: points desc, tiebreak goal_diff_error asc
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (
      ORDER BY total_points DESC, COALESCE(goal_diff_error, 99) ASC
    ) AS rnk
    FROM public.live_game_entries
    WHERE live_game_id = p_game_id AND predicted_score IS NOT NULL
  )
  UPDATE public.live_game_entries e
  SET rank = r.rnk FROM ranked r WHERE e.id = r.id;

  UPDATE public.live_games SET status = 'finished', updated_at = now() WHERE id = p_game_id;
  RETURN v_count;
END;
$$;

-- 4) Catch-up: settle any finished-fixture score-prediction game still pending.
CREATE OR REPLACE FUNCTION public.settle_finished_live_score_games()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_game_id UUID;
  v_total INTEGER := 0;
BEGIN
  FOR v_game_id IN
    SELECT lg.id
    FROM public.live_games lg
    JOIN public.fb_fixtures f ON f.id = lg.fixture_id
    WHERE lg.status IN ('upcoming', 'live')
      AND f.status IN ('FT', 'AET', 'PEN', 'CANC', 'ABD', 'WO', 'AWD', 'POST', 'PST')
      AND EXISTS (SELECT 1 FROM public.live_game_entries e
                  WHERE e.live_game_id = lg.id AND e.predicted_score IS NOT NULL)
  LOOP
    v_total := v_total + public.settle_live_game_score(v_game_id);
  END LOOP;
  RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.settle_live_game_score(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.settle_finished_live_score_games() TO authenticated, anon, service_role;

-- Safety-net cron every 10 minutes.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'settle-live-score-games') THEN
      PERFORM cron.unschedule('settle-live-score-games');
    END IF;
    PERFORM cron.schedule('settle-live-score-games', '*/10 * * * *',
      $cron$ SELECT public.settle_finished_live_score_games(); $cron$);
  END IF;
END;
$$;
