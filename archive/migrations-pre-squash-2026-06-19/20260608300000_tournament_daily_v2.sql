-- ============================================================================
-- TOURNAMENT QUEST v2: score-based daily + conditional bonus question, degressive
-- goal-difference distance, top-scorer picks (tq_players).
-- ============================================================================

-- ── Schema ───────────────────────────────────────────────────────────────────
ALTER TABLE public.tq_matches ADD COLUMN IF NOT EXISTS first_goal_half TEXT;  -- 'first' | 'second' | NULL
ALTER TABLE public.tq_matches ADD COLUMN IF NOT EXISTS total_cards INTEGER;
ALTER TABLE public.tq_daily_predictions ADD COLUMN IF NOT EXISTS predicted_bonus TEXT; -- team_id | 'first'/'second' | 'over'/'under'

-- Players (competition-scoped) for the top-scorer pick
CREATE TABLE IF NOT EXISTS public.tq_players (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.tq_competitions(id) ON DELETE CASCADE,
  team_id        UUID REFERENCES public.tq_teams(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  photo          TEXT
);
CREATE INDEX IF NOT EXISTS idx_tq_players_comp ON public.tq_players(competition_id);
ALTER TABLE public.tq_players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tq_players_read ON public.tq_players;
CREATE POLICY tq_players_read ON public.tq_players FOR SELECT USING (true);
GRANT SELECT ON public.tq_players TO anon, authenticated;

-- top_scorer_player_id: bigint -> uuid (references tq_players). Existing data is NULL.
ALTER TABLE public.tq_long_term_predictions DROP COLUMN IF EXISTS top_scorer_player_id;
ALTER TABLE public.tq_long_term_predictions ADD COLUMN top_scorer_player_id UUID REFERENCES public.tq_players(id) ON DELETE SET NULL;

-- Seed one striker per team for the open + KO demo competitions
INSERT INTO public.tq_players (competition_id, team_id, name)
SELECT t.competition_id, t.id, t.name || ' (striker)'
FROM public.tq_teams t
WHERE t.competition_id IN ('b0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000003')
  AND NOT EXISTS (SELECT 1 FROM public.tq_players p WHERE p.team_id = t.id);

-- ── Daily scoring v2 ─────────────────────────────────────────────────────────
-- result + exact + degressive goal-difference distance + conditional bonus.
CREATE OR REPLACE FUNCTION public.tq_score_daily(p_entry_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_comp UUID; v_cfg JSONB; v_total INT := 0; r RECORD;
  p_result INT; p_exact INT; p_bonus INT; v_cards_line NUMERIC; v_exact_count INT := 0;
BEGIN
  SELECT competition_id INTO v_comp FROM public.tq_entries WHERE id = p_entry_id;
  SELECT config_json INTO v_cfg FROM public.tq_competitions WHERE id = v_comp;
  p_result := COALESCE((v_cfg->'scoring'->'daily'->>'result')::int, 10);
  p_exact  := COALESCE((v_cfg->'scoring'->'daily'->>'exact_score')::int, 12);
  p_bonus  := COALESCE((v_cfg->'scoring'->'daily'->>'bonus')::int, 8);
  v_cards_line := COALESCE((v_cfg->'scoring'->'daily'->>'cards_line')::numeric, 3.5);

  DELETE FROM public.tq_scoring_events WHERE entry_id = p_entry_id AND source_type = 'daily';
  FOR r IN
    SELECT dp.id, dp.predicted_score_a pa, dp.predicted_score_b pb, dp.predicted_bonus bonus,
           m.score_a ra, m.score_b rb, m.first_scorer_team_id, m.first_goal_half, m.total_cards
    FROM public.tq_daily_predictions dp
    JOIN public.tq_matches m ON m.id = dp.match_id
    WHERE m.status = 'finished' AND dp.predicted_score_a IS NOT NULL
  LOOP
    DECLARE
      pts INT := 0; res_ok BOOLEAN; dist INT; dpts INT; bonus_ok BOOLEAN := false;
    BEGIN
      res_ok := sign(r.pa - r.pb) = sign(r.ra - r.rb);
      IF res_ok THEN pts := pts + p_result; END IF;
      IF r.pa = r.ra AND r.pb = r.rb THEN pts := pts + p_exact; v_exact_count := v_exact_count + 1; END IF;

      -- degressive goal-difference distance (default 0:15,1:10,2:5,3:2, >=4:0)
      dist := abs((r.pa - r.pb) - (r.ra - r.rb));
      dpts := COALESCE((v_cfg->'scoring'->'daily'->'distance'->>(LEAST(dist,4))::text)::int,
                       CASE dist WHEN 0 THEN 15 WHEN 1 THEN 10 WHEN 2 THEN 5 WHEN 3 THEN 2 ELSE 0 END);
      pts := pts + dpts;

      -- bonus question type is driven by the PREDICTED score
      IF r.pa > 0 AND r.pb > 0 THEN          -- both score -> who scores first (team id)
        bonus_ok := r.bonus IS NOT NULL AND r.bonus = r.first_scorer_team_id::text;
      ELSIF (r.pa > 0) <> (r.pb > 0) THEN     -- exactly one scores -> which half
        bonus_ok := r.bonus IS NOT NULL AND r.bonus = r.first_goal_half;
      ELSE                                    -- 0-0 -> over/under cards
        bonus_ok := (r.bonus = 'over' AND r.total_cards > v_cards_line)
                 OR (r.bonus = 'under' AND r.total_cards <= v_cards_line);
      END IF;
      IF bonus_ok THEN pts := pts + p_bonus; END IF;

      UPDATE public.tq_daily_predictions SET points_awarded = pts WHERE id = r.id;
      IF pts > 0 THEN
        INSERT INTO public.tq_scoring_events(entry_id, source_type, source_id, points, reason)
        VALUES (p_entry_id, 'daily', r.id, pts, 'daily match');
      END IF;
      v_total := v_total + pts;
    END;
  END LOOP;

  UPDATE public.tq_entries SET daily_score = v_total, exact_score_predictions_count = v_exact_count WHERE id = p_entry_id;
  RETURN v_total;
END;
$$;

-- ── Long-term scoring: top scorer now keyed on tq_players uuid ────────────────
-- (config.results.top_scorer = { exact: <uuid>, top3:[uuids], top10:[uuids] })
CREATE OR REPLACE FUNCTION public.tq_score_long_term(p_entry_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_comp UUID; v_cfg JSONB; v_total INT := 0; lt RECORD;
  v_champion UUID; v_finalists UUID[]; v_semis UUID[]; v_actual_goals INT; v_top JSONB;
BEGIN
  SELECT competition_id INTO v_comp FROM public.tq_entries WHERE id = p_entry_id;
  SELECT config_json INTO v_cfg FROM public.tq_competitions WHERE id = v_comp;
  SELECT * INTO lt FROM public.tq_long_term_predictions WHERE entry_id = p_entry_id;
  IF lt IS NULL THEN RETURN 0; END IF;

  SELECT winner_team_id, ARRAY[team_a_id, team_b_id] INTO v_champion, v_finalists
  FROM public.tq_matches WHERE competition_id = v_comp AND knockout_round = 'F' AND status = 'finished' LIMIT 1;
  SELECT array_agg(t) INTO v_semis FROM (
    SELECT unnest(ARRAY[team_a_id, team_b_id]) t FROM public.tq_matches WHERE competition_id = v_comp AND knockout_round = 'SF'
  ) s WHERE t IS NOT NULL;

  IF lt.champion_team_id IS NOT NULL THEN
    IF lt.champion_team_id = v_champion THEN v_total := v_total + COALESCE((v_cfg->'scoring'->'long_term'->>'champion_exact')::int, 150);
    ELSIF lt.champion_team_id = ANY(v_finalists) THEN v_total := v_total + COALESCE((v_cfg->'scoring'->'long_term'->>'champion_finalist')::int, 75);
    ELSIF lt.champion_team_id = ANY(v_semis) THEN v_total := v_total + COALESCE((v_cfg->'scoring'->'long_term'->>'champion_semi')::int, 30);
    END IF;
  END IF;
  IF lt.finalist_team_id IS NOT NULL THEN
    IF lt.finalist_team_id = ANY(v_finalists) THEN v_total := v_total + COALESCE((v_cfg->'scoring'->'long_term'->>'finalist_exact')::int, 100);
    ELSIF lt.finalist_team_id = ANY(v_semis) THEN v_total := v_total + COALESCE((v_cfg->'scoring'->'long_term'->>'finalist_semi')::int, 40);
    END IF;
  END IF;

  v_top := v_cfg->'results'->'top_scorer';
  IF lt.top_scorer_player_id IS NOT NULL AND v_top IS NOT NULL THEN
    IF (v_top->>'exact') IS NOT NULL AND lt.top_scorer_player_id::text = (v_top->>'exact') THEN
      v_total := v_total + COALESCE((v_cfg->'scoring'->'long_term'->>'top_scorer_exact')::int, 100);
    ELSIF v_top->'top3' ? lt.top_scorer_player_id::text THEN
      v_total := v_total + COALESCE((v_cfg->'scoring'->'long_term'->>'top_scorer_top3')::int, 40);
    ELSIF v_top->'top10' ? lt.top_scorer_player_id::text THEN
      v_total := v_total + COALESCE((v_cfg->'scoring'->'long_term'->>'top_scorer_top10')::int, 15);
    END IF;
  END IF;

  SELECT COALESCE(sum(COALESCE(score_a,0) + COALESCE(score_b,0)), 0) INTO v_actual_goals
  FROM public.tq_matches WHERE competition_id = v_comp AND status = 'finished';

  DELETE FROM public.tq_scoring_events WHERE entry_id = p_entry_id AND source_type = 'long_term';
  IF v_total > 0 THEN
    INSERT INTO public.tq_scoring_events(entry_id, source_type, source_id, points, reason)
    VALUES (p_entry_id, 'long_term', lt.id, v_total, 'long-term picks');
  END IF;
  UPDATE public.tq_long_term_predictions SET points_awarded = v_total WHERE id = lt.id;
  UPDATE public.tq_entries SET long_term_score = v_total,
    total_goals_tiebreak_delta = CASE WHEN lt.total_goals_prediction IS NOT NULL THEN abs(lt.total_goals_prediction - v_actual_goals) ELSE NULL END
  WHERE id = p_entry_id;
  RETURN v_total;
END;
$$;

-- ── Save RPCs updated for the new shapes ─────────────────────────────────────
DROP FUNCTION IF EXISTS public.tq_save_long_term(UUID, UUID, UUID, BIGINT, INTEGER, JSONB);
CREATE OR REPLACE FUNCTION public.tq_save_long_term(
  p_comp UUID, p_champion UUID, p_finalist UUID,
  p_top_scorer UUID DEFAULT NULL, p_total_goals INTEGER DEFAULT NULL, p_extras JSONB DEFAULT '{}'::jsonb)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_entry UUID;
BEGIN
  IF NOT public.tq_phase_open(p_comp, 'long_term') THEN RAISE EXCEPTION 'Long-term predictions are locked'; END IF;
  v_entry := public.tq_get_or_create_entry(p_comp);
  INSERT INTO public.tq_long_term_predictions (entry_id, champion_team_id, finalist_team_id, top_scorer_player_id, total_goals_prediction, extras_json)
  VALUES (v_entry, p_champion, p_finalist, p_top_scorer, p_total_goals, COALESCE(p_extras,'{}'::jsonb))
  ON CONFLICT (entry_id) DO UPDATE SET
    champion_team_id = EXCLUDED.champion_team_id, finalist_team_id = EXCLUDED.finalist_team_id,
    top_scorer_player_id = EXCLUDED.top_scorer_player_id, total_goals_prediction = EXCLUDED.total_goals_prediction, extras_json = EXCLUDED.extras_json;
  UPDATE public.tq_entries SET total_goals_prediction = p_total_goals, last_prediction_at = now() WHERE id = v_entry;
END;
$$;
GRANT EXECUTE ON FUNCTION public.tq_save_long_term(UUID, UUID, UUID, UUID, INTEGER, JSONB) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.tq_save_daily_prediction(UUID, UUID, TEXT, TEXT, UUID, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION public.tq_save_daily_prediction(
  p_comp UUID, p_match_id UUID, p_score_a INTEGER, p_score_b INTEGER, p_bonus TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_entry UUID; v_start TIMESTAMPTZ; v_status TEXT; v_result TEXT;
BEGIN
  SELECT start_time, status INTO v_start, v_status FROM public.tq_matches WHERE id = p_match_id AND competition_id = p_comp;
  IF v_status <> 'scheduled' OR (v_start IS NOT NULL AND now() >= v_start) THEN RAISE EXCEPTION 'This match is locked'; END IF;
  v_entry := public.tq_get_or_create_entry(p_comp);
  v_result := CASE WHEN p_score_a > p_score_b THEN 'A' WHEN p_score_a < p_score_b THEN 'B' ELSE 'draw' END;
  INSERT INTO public.tq_daily_predictions (entry_id, match_id, predicted_result, predicted_score_a, predicted_score_b, predicted_bonus)
  VALUES (v_entry, p_match_id, v_result, p_score_a, p_score_b, p_bonus)
  ON CONFLICT (entry_id, match_id) DO UPDATE SET
    predicted_result = EXCLUDED.predicted_result, predicted_score_a = EXCLUDED.predicted_score_a,
    predicted_score_b = EXCLUDED.predicted_score_b, predicted_bonus = EXCLUDED.predicted_bonus;
  UPDATE public.tq_entries SET last_prediction_at = now() WHERE id = v_entry;
END;
$$;
GRANT EXECUTE ON FUNCTION public.tq_save_daily_prediction(UUID, UUID, INTEGER, INTEGER, TEXT) TO authenticated, service_role;
