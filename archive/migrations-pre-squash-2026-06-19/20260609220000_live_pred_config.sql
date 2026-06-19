-- Externalize the Live Prediction scoring barème (was hardcoded in settle_live_game_score).
CREATE TABLE IF NOT EXISTS public.live_pred_config (
  id                  INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  diff_points         JSONB NOT NULL DEFAULT '[90,72,54,36,18,0]'::jsonb, -- goal-diff error 0,1,2,3,4,5+
  result_points       INTEGER NOT NULL DEFAULT 70,                         -- correct 1X2
  halftime_malus_pct  INTEGER NOT NULL DEFAULT 40,                         -- % reduction on (diff+result) at half-time edit
  bonus_count         INTEGER NOT NULL DEFAULT 3,                          -- number of bonus questions
  bonus_points        JSONB NOT NULL DEFAULT '[20,10,10]'::jsonb,          -- points per bonus question
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.live_pred_config (id) VALUES (1) ON CONFLICT DO NOTHING;
ALTER TABLE public.live_pred_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lpc_read ON public.live_pred_config;
CREATE POLICY lpc_read ON public.live_pred_config FOR SELECT USING (true);
DROP POLICY IF EXISTS lpc_admin ON public.live_pred_config;
CREATE POLICY lpc_admin ON public.live_pred_config FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT SELECT ON public.live_pred_config TO anon, authenticated;
GRANT INSERT, UPDATE ON public.live_pred_config TO authenticated;

-- Rewrite the scoring engine to read the config.
CREATE OR REPLACE FUNCTION public.settle_live_game_score(p_game_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_fixture_id UUID; v_status TEXT; v_gh INTEGER; v_ga INTEGER; v_actual TEXT;
  v_entry RECORD; v_ph INTEGER; v_pa INTEGER; v_pred TEXT;
  v_diff_err INTEGER; v_diff_pts INTEGER; v_res_pts INTEGER; v_bonus_pts INTEGER;
  v_q JSONB; v_total INTEGER; v_count INTEGER := 0;
  v_cfg public.live_pred_config; v_malus NUMERIC;
BEGIN
  SELECT lg.fixture_id INTO v_fixture_id FROM public.live_games lg WHERE lg.id = p_game_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  SELECT * INTO v_cfg FROM public.live_pred_config WHERE id = 1;
  v_malus := (100 - COALESCE(v_cfg.halftime_malus_pct,40)) / 100.0;

  SELECT f.status, f.goals_home, f.goals_away INTO v_status, v_gh, v_ga
  FROM public.fb_fixtures f WHERE f.id = v_fixture_id;

  IF v_status IN ('CANC','ABD','WO','AWD','POST','PST') THEN
    UPDATE public.live_games SET status='cancelled', updated_at=now() WHERE id=p_game_id; RETURN 0;
  ELSIF v_status NOT IN ('FT','AET','PEN') THEN RETURN 0; END IF;

  v_gh := COALESCE(v_gh,0); v_ga := COALESCE(v_ga,0);
  v_actual := CASE WHEN v_gh > v_ga THEN 'home' WHEN v_gh < v_ga THEN 'away' ELSE 'draw' END;

  FOR v_entry IN
    SELECT id, predicted_score, bonus_questions, bonus_answers, midtime_edit
    FROM public.live_game_entries WHERE live_game_id=p_game_id AND predicted_score IS NOT NULL
  LOOP
    v_ph := COALESCE((v_entry.predicted_score->>'home')::int,0);
    v_pa := COALESCE((v_entry.predicted_score->>'away')::int,0);
    v_pred := CASE WHEN v_ph > v_pa THEN 'home' WHEN v_ph < v_pa THEN 'away' ELSE 'draw' END;

    v_diff_err := abs((v_ph - v_pa) - (v_gh - v_ga));
    v_diff_pts := COALESCE((v_cfg.diff_points -> LEAST(v_diff_err, jsonb_array_length(v_cfg.diff_points)-1))::text::int, 0);
    v_res_pts := CASE WHEN v_pred = v_actual THEN v_cfg.result_points ELSE 0 END;

    v_bonus_pts := 0;
    FOR v_q IN SELECT * FROM jsonb_array_elements(COALESCE(v_entry.bonus_questions,'[]'::jsonb)) LOOP
      IF v_entry.bonus_answers->>(v_q->>'key') = public.live_bonus_correct(v_q->>'key', v_entry.predicted_score, v_gh, v_ga) THEN
        v_bonus_pts := v_bonus_pts + COALESCE((v_q->>'points')::int,0);
      END IF;
    END LOOP;

    v_total := CASE WHEN v_entry.midtime_edit
      THEN round((v_diff_pts + v_res_pts) * v_malus) ELSE (v_diff_pts + v_res_pts) END + v_bonus_pts;

    UPDATE public.live_game_entries SET total_points=v_total, goal_diff_error=v_diff_err WHERE id=v_entry.id;
    v_count := v_count + 1;
  END LOOP;

  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY total_points DESC, COALESCE(goal_diff_error,99) ASC) AS rnk
    FROM public.live_game_entries WHERE live_game_id=p_game_id AND predicted_score IS NOT NULL
  ) UPDATE public.live_game_entries e SET rank=r.rnk FROM ranked r WHERE e.id=r.id;

  UPDATE public.live_games SET status='finished', updated_at=now() WHERE id=p_game_id;
  RETURN v_count;
END; $$;
GRANT EXECUTE ON FUNCTION public.settle_live_game_score(UUID) TO authenticated, anon, service_role;
