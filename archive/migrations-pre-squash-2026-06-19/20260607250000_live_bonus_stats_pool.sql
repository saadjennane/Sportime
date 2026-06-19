-- ============================================================================
-- Live Game A — bonus questions reworked to MATCH STATS (orthogonal to score),
-- chosen by the prediction's SITUATION (goalless / clean_sheet / both_score).
-- The client draws 3 from the situation's sub-pool (20/10/10); the server
-- validates them and resolves from fb_fixture_stats (captured from the API).
-- ============================================================================

-- 1) Per-fixture stats (filled by the sync from /fixtures/statistics + /events).
CREATE TABLE IF NOT EXISTS public.fb_fixture_stats (
  fixture_id UUID PRIMARY KEY REFERENCES public.fb_fixtures(id) ON DELETE CASCADE,
  possession_home INTEGER,
  possession_away INTEGER,
  yellow_home INTEGER DEFAULT 0,
  yellow_away INTEGER DEFAULT 0,
  red_home INTEGER DEFAULT 0,
  red_away INTEGER DEFAULT 0,
  corners_home INTEGER DEFAULT 0,
  corners_away INTEGER DEFAULT 0,
  first_goal_team TEXT,    -- 'home' | 'away' | 'none'
  first_goal_half INTEGER, -- 1 | 2 | null
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.fb_fixture_stats ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fb_fixture_stats' AND policyname='fb_fixture_stats_read') THEN
    CREATE POLICY fb_fixture_stats_read ON public.fb_fixture_stats FOR SELECT USING (true);
  END IF;
END $$;

-- 2) Situation from the predicted score.
CREATE OR REPLACE FUNCTION public.live_situation(h INTEGER, a INTEGER)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN h = 0 AND a = 0 THEN 'goalless'
              WHEN h = 0 OR a = 0 THEN 'clean_sheet'
              ELSE 'both_score' END;
$$;

-- 3) Valid bonus keys for a situation (must match the client sub-pools).
CREATE OR REPLACE FUNCTION public.live_bonus_subpool(sit TEXT)
RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE sit
    WHEN 'goalless' THEN
      ARRAY['possession_most','both_carded','cards_4plus','cards_most','red_card','corners_9plus','corners_most']
    WHEN 'clean_sheet' THEN
      ARRAY['possession_most','both_carded','cards_4plus','cards_most','red_card','first_goal_1h','corners_9plus','corners_most']
    ELSE
      ARRAY['first_scorer','first_goal_1h','possession_most','both_carded','cards_4plus','cards_most','red_card','corners_9plus','corners_most']
  END;
$$;

-- 4) Resolve one bonus question from the fixture stats -> correct answer.
CREATE OR REPLACE FUNCTION public.resolve_live_bonus(p_key TEXT, s public.fb_fixture_stats)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_ch INT := COALESCE(s.yellow_home,0) + COALESCE(s.red_home,0);
  v_ca INT := COALESCE(s.yellow_away,0) + COALESCE(s.red_away,0);
BEGIN
  CASE p_key
    WHEN 'possession_most' THEN
      RETURN CASE WHEN COALESCE(s.possession_home,0) > COALESCE(s.possession_away,0) THEN 'home'
                  WHEN COALESCE(s.possession_away,0) > COALESCE(s.possession_home,0) THEN 'away' ELSE 'none' END;
    WHEN 'both_carded' THEN RETURN CASE WHEN v_ch > 0 AND v_ca > 0 THEN 'yes' ELSE 'no' END;
    WHEN 'cards_4plus' THEN RETURN CASE WHEN v_ch + v_ca >= 4 THEN 'yes' ELSE 'no' END;
    WHEN 'cards_most' THEN
      RETURN CASE WHEN v_ch > v_ca THEN 'home' WHEN v_ca > v_ch THEN 'away' ELSE 'none' END;
    WHEN 'red_card' THEN RETURN CASE WHEN COALESCE(s.red_home,0)+COALESCE(s.red_away,0) > 0 THEN 'yes' ELSE 'no' END;
    WHEN 'first_scorer' THEN RETURN COALESCE(s.first_goal_team, 'none');
    WHEN 'first_goal_1h' THEN RETURN CASE WHEN s.first_goal_half = 1 THEN 'yes' ELSE 'no' END;
    WHEN 'corners_9plus' THEN RETURN CASE WHEN COALESCE(s.corners_home,0)+COALESCE(s.corners_away,0) >= 10 THEN 'yes' ELSE 'no' END;
    WHEN 'corners_most' THEN
      RETURN CASE WHEN COALESCE(s.corners_home,0) > COALESCE(s.corners_away,0) THEN 'home'
                  WHEN COALESCE(s.corners_away,0) > COALESCE(s.corners_home,0) THEN 'away' ELSE 'none' END;
    ELSE RETURN NULL;
  END CASE;
END;
$$;

-- 5) Submit a prediction + its 3 situation-bonus questions (client-drawn) + answers.
CREATE OR REPLACE FUNCTION public.submit_live_prediction(
  p_game_id UUID, p_user_id UUID, p_home INTEGER, p_away INTEGER,
  p_questions JSONB, p_answers JSONB
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_fixture_id UUID;
  v_date TIMESTAMPTZ;
  v_sit TEXT;
  v_subpool TEXT[];
  v_keys TEXT[];
  v_points INT[];
  v_k TEXT;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_home < 0 OR p_away < 0 THEN RAISE EXCEPTION 'invalid_score'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.live_game_entries
                 WHERE live_game_id = p_game_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'not_joined';
  END IF;

  SELECT fixture_id INTO v_fixture_id FROM public.live_games WHERE id = p_game_id;
  SELECT date INTO v_date FROM public.fb_fixtures WHERE id = v_fixture_id;
  IF v_date IS NULL OR v_date <= now() THEN RAISE EXCEPTION 'match_started'; END IF;

  -- Validate the 3 questions belong to the situation's sub-pool, are distinct, 20/10/10.
  v_sit := public.live_situation(p_home, p_away);
  v_subpool := public.live_bonus_subpool(v_sit);
  SELECT array_agg(q->>'key'), array_agg((q->>'points')::int)
    INTO v_keys, v_points
  FROM jsonb_array_elements(COALESCE(p_questions, '[]'::jsonb)) q;

  IF v_keys IS NULL OR array_length(v_keys, 1) <> 3 THEN RAISE EXCEPTION 'invalid_questions'; END IF;
  IF (SELECT count(DISTINCT k) FROM unnest(v_keys) k) <> 3 THEN RAISE EXCEPTION 'duplicate_questions'; END IF;
  FOREACH v_k IN ARRAY v_keys LOOP
    IF NOT (v_k = ANY(v_subpool)) THEN RAISE EXCEPTION 'question_not_in_situation'; END IF;
  END LOOP;
  IF (SELECT array_agg(p ORDER BY p) FROM unnest(v_points) p) <> ARRAY[10,10,20] THEN
    RAISE EXCEPTION 'invalid_points';
  END IF;

  UPDATE public.live_game_entries
  SET predicted_score = jsonb_build_object('home', p_home, 'away', p_away),
      bonus_questions = p_questions,
      bonus_answers   = COALESCE(p_answers, '{}'::jsonb),
      midtime_edit    = false,
      submitted_at    = now()
  WHERE live_game_id = p_game_id AND user_id = p_user_id;
END;
$$;

-- 6) Settle: score + écart + result (fb_fixtures) and bonus (fb_fixture_stats).
CREATE OR REPLACE FUNCTION public.settle_live_game_score(p_game_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_fixture_id UUID;
  v_status TEXT;
  v_gh INTEGER;
  v_ga INTEGER;
  v_actual TEXT;
  v_stats public.fb_fixture_stats;
  v_has_stats BOOLEAN := false;
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

  IF v_status IN ('CANC','ABD','WO','AWD','POST','PST') THEN
    UPDATE public.live_games SET status = 'cancelled', updated_at = now() WHERE id = p_game_id;
    RETURN 0;
  ELSIF v_status NOT IN ('FT','AET','PEN') THEN
    RETURN 0;
  END IF;

  v_gh := COALESCE(v_gh,0); v_ga := COALESCE(v_ga,0);
  v_actual := CASE WHEN v_gh > v_ga THEN 'home' WHEN v_gh < v_ga THEN 'away' ELSE 'draw' END;

  SELECT * INTO v_stats FROM public.fb_fixture_stats WHERE fixture_id = v_fixture_id;
  v_has_stats := FOUND;

  FOR v_entry IN
    SELECT id, predicted_score, bonus_questions, bonus_answers, midtime_edit
    FROM public.live_game_entries
    WHERE live_game_id = p_game_id AND predicted_score IS NOT NULL
  LOOP
    v_ph := COALESCE((v_entry.predicted_score->>'home')::int, 0);
    v_pa := COALESCE((v_entry.predicted_score->>'away')::int, 0);
    v_pred := CASE WHEN v_ph > v_pa THEN 'home' WHEN v_ph < v_pa THEN 'away' ELSE 'draw' END;

    v_diff_err := abs((v_ph - v_pa) - (v_gh - v_ga));
    v_diff_pts := CASE v_diff_err WHEN 0 THEN 90 WHEN 1 THEN 72 WHEN 2 THEN 54 WHEN 3 THEN 36 WHEN 4 THEN 18 ELSE 0 END;
    v_res_pts := CASE WHEN v_pred = v_actual THEN 70 ELSE 0 END;

    v_bonus_pts := 0;
    IF v_has_stats THEN
      FOR v_q IN SELECT * FROM jsonb_array_elements(COALESCE(v_entry.bonus_questions, '[]'::jsonb)) LOOP
        IF v_entry.bonus_answers->>(v_q->>'key') = public.resolve_live_bonus(v_q->>'key', v_stats) THEN
          v_bonus_pts := v_bonus_pts + COALESCE((v_q->>'points')::int, 0);
        END IF;
      END LOOP;
    END IF;

    v_total := CASE WHEN v_entry.midtime_edit
      THEN round((v_diff_pts + v_res_pts) * 0.6) ELSE (v_diff_pts + v_res_pts) END + v_bonus_pts;

    UPDATE public.live_game_entries
    SET total_points = v_total, goal_diff_error = v_diff_err
    WHERE id = v_entry.id;
    v_count := v_count + 1;
  END LOOP;

  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY total_points DESC, COALESCE(goal_diff_error,99) ASC) AS rnk
    FROM public.live_game_entries WHERE live_game_id = p_game_id AND predicted_score IS NOT NULL
  )
  UPDATE public.live_game_entries e SET rank = r.rnk FROM ranked r WHERE e.id = r.id;

  UPDATE public.live_games SET status = 'finished', updated_at = now() WHERE id = p_game_id;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.live_situation(INTEGER, INTEGER) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.live_bonus_subpool(TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_live_bonus(TEXT, public.fb_fixture_stats) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.submit_live_prediction(UUID, UUID, INTEGER, INTEGER, JSONB, JSONB) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.settle_live_game_score(UUID) TO authenticated, anon, service_role;

-- Drop the old 5-arg submit signature (replaced by the 6-arg one above).
DROP FUNCTION IF EXISTS public.submit_live_prediction(UUID, UUID, INTEGER, INTEGER, JSONB);
