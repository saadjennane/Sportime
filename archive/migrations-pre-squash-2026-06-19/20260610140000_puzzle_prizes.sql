-- ─────────────────────────────────────────────────────────────────────────────
-- Puzzle Phase 1c: daily prize pot (top X% by score), monthly milestone rewards,
-- and admin reschedule (insert-shift). All driven by puzzle_config.
-- ─────────────────────────────────────────────────────────────────────────────

-- Richer monthly milestones (day, min games this month, reward).
UPDATE public.puzzle_config SET monthly_milestones =
  '[{"day":10,"min_games":5,"reward":{"type":"coins","value":500}},
    {"day":20,"min_games":10,"reward":{"type":"coins","value":1500}},
    {"day":"last","min_games":15,"reward":{"type":"ticket","tier":"amateur","quantity":1}}]'::jsonb
WHERE id = 1;
ALTER TABLE public.puzzle_config ALTER COLUMN monthly_milestones SET DEFAULT
  '[{"day":10,"min_games":5,"reward":{"type":"coins","value":500}},
    {"day":20,"min_games":10,"reward":{"type":"coins","value":1500}},
    {"day":"last","min_games":15,"reward":{"type":"ticket","tier":"amateur","quantity":1}}]'::jsonb;

-- Ledger to make monthly grants idempotent.
CREATE TABLE IF NOT EXISTS public.puzzle_monthly_grants (
  user_id    UUID NOT NULL,
  period     TEXT NOT NULL,   -- 'YYYY-MM'
  day_key    TEXT NOT NULL,   -- '10' | '20' | 'last'
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, period, day_key)
);
ALTER TABLE public.puzzle_monthly_grants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pmg_own ON public.puzzle_monthly_grants;
CREATE POLICY pmg_own ON public.puzzle_monthly_grants FOR SELECT USING (user_id = auth.uid());
GRANT SELECT ON public.puzzle_monthly_grants TO authenticated;

-- Distribute the daily pot to the top X% for a given puzzle date.
CREATE OR REPLACE FUNCTION public.puzzle_distribute_daily(p_date DATE)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cfg public.puzzle_config; lvl TEXT; v_game UUID; v_prize public.puzzle_daily_prizes;
  v_n INT; v_top INT; v_share INT; r RECORD; v_out JSONB := '[]'::jsonb;
BEGIN
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  FOREACH lvl IN ARRAY ARRAY['easy','medium','hard'] LOOP
    SELECT id INTO v_game FROM public.puzzle_games WHERE game_type='guess_score' AND level=lvl AND puzzle_date=p_date;
    IF v_game IS NULL THEN CONTINUE; END IF;
    SELECT * INTO v_prize FROM public.puzzle_daily_prizes WHERE level=lvl AND puzzle_date=p_date;
    IF v_prize.id IS NULL THEN
      IF NOT v_cfg.prize_enabled OR v_cfg.prize_pot_default <= 0 THEN CONTINUE; END IF;
      INSERT INTO public.puzzle_daily_prizes (level, puzzle_date, pot, top_pct)
      VALUES (lvl, p_date, v_cfg.prize_pot_default, v_cfg.prize_top_pct) RETURNING * INTO v_prize;
    END IF;
    IF v_prize.distributed OR v_prize.pot <= 0 THEN CONTINUE; END IF;

    SELECT count(*) INTO v_n FROM public.puzzle_plays WHERE game_id=v_game AND finished_at IS NOT NULL;
    IF v_n = 0 THEN UPDATE public.puzzle_daily_prizes SET distributed=true, distributed_at=now(), winners=0 WHERE id=v_prize.id; CONTINUE; END IF;
    v_top := GREATEST(1, CEIL(v_n * v_prize.top_pct / 100.0)::int);
    v_share := FLOOR(v_prize.pot / v_top);
    FOR r IN SELECT user_id FROM public.puzzle_plays WHERE game_id=v_game AND finished_at IS NOT NULL
             ORDER BY score DESC, total_time_ms ASC LIMIT v_top LOOP
      PERFORM public.add_coins(r.user_id, v_share, 'challenge_reward', jsonb_build_object('puzzle_daily', p_date, 'level', lvl));
    END LOOP;
    UPDATE public.puzzle_daily_prizes SET distributed=true, distributed_at=now(), winners=v_top WHERE id=v_prize.id;
    v_out := v_out || jsonb_build_object('level', lvl, 'winners', v_top, 'share', v_share);
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'date', p_date, 'results', v_out);
END $$;
GRANT EXECUTE ON FUNCTION public.puzzle_distribute_daily(DATE) TO authenticated, service_role;

-- Grant monthly milestone rewards if p_date matches a milestone.
CREATE OR REPLACE FUNCTION public.puzzle_grant_monthly(p_date DATE)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cfg public.puzzle_config; m JSONB; v_day TEXT; v_key TEXT; v_match BOOLEAN;
  v_period TEXT := to_char(p_date, 'YYYY-MM'); v_start DATE := date_trunc('month', p_date)::date;
  v_min INT; v_reward JSONB; v_granted INT := 0; u RECORD;
BEGIN
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  FOR m IN SELECT * FROM jsonb_array_elements(v_cfg.monthly_milestones) LOOP
    v_day := m->>'day';
    v_match := (v_day = 'last' AND p_date = (date_trunc('month', p_date) + interval '1 month - 1 day')::date)
            OR (v_day ~ '^[0-9]+$' AND EXTRACT(DAY FROM p_date)::int = v_day::int);
    IF NOT v_match THEN CONTINUE; END IF;
    v_key := v_day; v_min := COALESCE((m->>'min_games')::int, 1); v_reward := m->'reward';
    FOR u IN
      SELECT pl.user_id FROM public.puzzle_plays pl
      JOIN public.puzzle_games g ON g.id = pl.game_id
      WHERE pl.finished_at IS NOT NULL AND g.puzzle_date BETWEEN v_start AND p_date
      GROUP BY pl.user_id HAVING count(DISTINCT g.id) >= v_min
    LOOP
      INSERT INTO public.puzzle_monthly_grants (user_id, period, day_key) VALUES (u.user_id, v_period, v_key)
      ON CONFLICT DO NOTHING;
      IF FOUND THEN
        PERFORM public.distribute_reward_to_user(u.user_id, v_reward, 'puzzle_monthly', NULL);
        v_granted := v_granted + 1;
      END IF;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'date', p_date, 'granted', v_granted);
END $$;
GRANT EXECUTE ON FUNCTION public.puzzle_grant_monthly(DATE) TO authenticated, service_role;

-- Move a game to a date, pushing the whole level's calendar down (insert-shift).
CREATE OR REPLACE FUNCTION public.puzzle_reschedule(p_game_id UUID, p_new_date DATE)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_level TEXT;
BEGIN
  SELECT level INTO v_level FROM public.puzzle_games WHERE id = p_game_id;
  IF v_level IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  -- park the moved game, shift the block +1 day (latest first to avoid collisions), then place it
  UPDATE public.puzzle_games SET puzzle_date = NULL WHERE id = p_game_id;
  UPDATE public.puzzle_games SET puzzle_date = puzzle_date + 1
    WHERE game_type='guess_score' AND level=v_level AND puzzle_date >= p_new_date AND id <> p_game_id;
  UPDATE public.puzzle_games SET puzzle_date = p_new_date WHERE id = p_game_id;
  -- renumber seq by date
  WITH ord AS (SELECT id, row_number() OVER (ORDER BY puzzle_date) rn FROM public.puzzle_games WHERE game_type='guess_score' AND level=v_level)
  UPDATE public.puzzle_games g SET seq = ord.rn FROM ord WHERE g.id = ord.id;
  RETURN jsonb_build_object('ok', true);
END $$;
GRANT EXECUTE ON FUNCTION public.puzzle_reschedule(UUID, DATE) TO authenticated;

-- Crons: every day at the cutover hour (08:00) — distribute yesterday's pots + monthly milestones.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'puzzle-daily-prizes') THEN PERFORM cron.unschedule('puzzle-daily-prizes'); END IF;
    PERFORM cron.schedule('puzzle-daily-prizes', '0 8 * * *',
      $cron$ SELECT public.puzzle_distribute_daily((CURRENT_DATE - 1)); SELECT public.puzzle_grant_monthly(CURRENT_DATE); $cron$);
  END IF;
END $$;
