-- ─────────────────────────────────────────────────────────────────────────────
-- Progression admin: editable XP formula coefficients + admin write on
-- levels_config and badges. The XP function now reads its coefficients from
-- xp_formula_config (falling back to the previous hard-coded values).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.xp_formula_config (
  key   TEXT PRIMARY KEY,
  value NUMERIC NOT NULL,
  label TEXT
);
INSERT INTO public.xp_formula_config (key, value, label) VALUES
  ('activity_per_day',   50,   'XP per active day'),
  ('accuracy_mult',      1.2,  'XP per accuracy %'),
  ('fantasy_mult',       0.5,  'XP per avg fantasy point'),
  ('risk_mult',          100,  'XP per unit of average winning odds above 1'),
  ('badge_xp',           150,  'XP per badge earned'),
  ('game_variety_mult',  40,   'XP per distinct game type played'),
  ('diminishing_rate',   0.05, 'Per-level diminishing rate'),
  ('goat_multiplier',    1.05, 'GOAT weekly XP multiplier'),
  ('decay_rate',         0.02, 'Inactivity decay per week'),
  ('decay_cap',          0.30, 'Max inactivity decay')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.xp_formula_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS xp_formula_read ON public.xp_formula_config;
CREATE POLICY xp_formula_read ON public.xp_formula_config FOR SELECT USING (true);
DROP POLICY IF EXISTS xp_formula_admin ON public.xp_formula_config;
CREATE POLICY xp_formula_admin ON public.xp_formula_config FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT SELECT ON public.xp_formula_config TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.xp_formula_config TO authenticated;

-- Admin write on the progression catalogs (public read kept as-is).
DROP POLICY IF EXISTS levels_config_admin ON public.levels_config;
CREATE POLICY levels_config_admin ON public.levels_config FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS badges_admin ON public.badges;
CREATE POLICY badges_admin ON public.badges FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT INSERT, UPDATE, DELETE ON public.levels_config TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.badges TO authenticated;

-- Coefficient accessor.
CREATE OR REPLACE FUNCTION public.xp_coef(p_key TEXT, p_default NUMERIC)
RETURNS NUMERIC LANGUAGE sql STABLE AS $$
  SELECT COALESCE((SELECT value FROM public.xp_formula_config WHERE key = p_key), p_default);
$$;

-- Rewrite the weekly XP calculation to read coefficients from config.
CREATE OR REPLACE FUNCTION public.calculate_user_weekly_xp(p_user_id UUID)
RETURNS INT AS $$
DECLARE
  v_current_level INT;
  v_goat_bonus_active BOOLEAN;
  v_last_active_date TIMESTAMPTZ;
  v_days_active INT := 0;
  v_predictions_made INT := 0;
  v_predictions_correct INT := 0;
  v_fantasy_avg_score NUMERIC := 0;
  v_avg_win_odds NUMERIC := 1.0;
  v_badges_earned INT := 0;
  v_game_types_played INT := 0;
  v_activity_xp NUMERIC := 0;
  v_accuracy_xp NUMERIC := 0;
  v_fantasy_xp NUMERIC := 0;
  v_risk_xp NUMERIC := 0;
  v_badges_xp NUMERIC := 0;
  v_games_xp NUMERIC := 0;
  v_total_xp NUMERIC := 0;
  v_diminishing_factor NUMERIC;
  v_decay_factor NUMERIC := 0;
  v_weeks_inactive INT := 0;
  v_goat_multiplier NUMERIC := 1.0;
  v_accuracy NUMERIC := 0;
  v_week_start DATE;
BEGIN
  SELECT current_level, goat_bonus_active, last_active_date
  INTO v_current_level, v_goat_bonus_active, v_last_active_date
  FROM public.users WHERE id = p_user_id;

  IF v_last_active_date IS NOT NULL THEN
    v_weeks_inactive := FLOOR(EXTRACT(EPOCH FROM (NOW() - v_last_active_date)) / 604800)::INT;
  END IF;
  IF v_weeks_inactive >= 2 AND v_current_level < 6 THEN
    v_decay_factor := LEAST(public.xp_coef('decay_cap', 0.30), public.xp_coef('decay_rate', 0.02) * v_weeks_inactive);
  END IF;

  v_week_start := public.get_week_start(NOW() - INTERVAL '1 week');
  SELECT
    COALESCE(days_active, 0), COALESCE(predictions_made, 0), COALESCE(predictions_correct, 0),
    COALESCE(fantasy_avg_score, 0), COALESCE(NULLIF(avg_win_odds, 0), 1.0),
    COALESCE(badges_earned, 0), COALESCE(game_types_played, 0)
  INTO
    v_days_active, v_predictions_made, v_predictions_correct,
    v_fantasy_avg_score, v_avg_win_odds, v_badges_earned, v_game_types_played
  FROM public.user_activity_logs
  WHERE user_id = p_user_id AND week_start = v_week_start;

  IF v_predictions_made > 0 THEN
    v_accuracy := (v_predictions_correct::NUMERIC / v_predictions_made) * 100;
  END IF;

  v_activity_xp := v_days_active        * public.xp_coef('activity_per_day', 50);
  v_accuracy_xp := v_accuracy           * public.xp_coef('accuracy_mult', 1.2);
  v_fantasy_xp  := v_fantasy_avg_score  * public.xp_coef('fantasy_mult', 0.5);
  v_risk_xp     := (v_avg_win_odds - 1) * public.xp_coef('risk_mult', 100);
  v_badges_xp   := v_badges_earned      * public.xp_coef('badge_xp', 150);
  v_games_xp    := v_game_types_played  * public.xp_coef('game_variety_mult', 40);

  v_diminishing_factor := 1.0 / (1.0 + public.xp_coef('diminishing_rate', 0.05) * (v_current_level - 1));
  IF v_goat_bonus_active THEN
    v_goat_multiplier := public.xp_coef('goat_multiplier', 1.05);
  END IF;

  v_total_xp := (v_activity_xp + v_accuracy_xp + v_fantasy_xp + v_risk_xp + v_badges_xp + v_games_xp)
                * v_diminishing_factor * v_goat_multiplier;
  v_total_xp := v_total_xp * (1.0 - v_decay_factor);
  RETURN GREATEST(ROUND(v_total_xp), 0)::INT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
