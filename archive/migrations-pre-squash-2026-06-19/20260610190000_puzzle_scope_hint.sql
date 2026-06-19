-- Separate the two axes: match SCOPE (big | all) drives match selection;
-- HINT level (easy=arrows | medium=distance | hard=heat) drives feedback only.
-- puzzle_games.level now holds the SCOPE; puzzle_user_prefs gains `hint`.
ALTER TABLE public.puzzle_user_prefs ADD COLUMN IF NOT EXISTS hint TEXT NOT NULL DEFAULT 'easy';
ALTER TABLE public.puzzle_user_prefs ALTER COLUMN level SET DEFAULT 'big';
ALTER TABLE public.puzzle_config ADD COLUMN IF NOT EXISTS pop_floor_big NUMERIC NOT NULL DEFAULT 75;
ALTER TABLE public.puzzle_config ADD COLUMN IF NOT EXISTS pop_floor_all NUMERIC NOT NULL DEFAULT 30;

-- Set both prefs at once (first-launch config).
CREATE OR REPLACE FUNCTION public.puzzle_set_prefs(p_scope TEXT, p_hint TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  IF p_scope NOT IN ('big','all') OR p_hint NOT IN ('easy','medium','hard') THEN RETURN jsonb_build_object('ok', false, 'error', 'bad'); END IF;
  INSERT INTO public.puzzle_user_prefs (user_id, level, hint) VALUES (v_user, p_scope, p_hint)
  ON CONFLICT (user_id) DO UPDATE SET level = EXCLUDED.level, hint = EXCLUDED.hint, updated_at = now();
  RETURN jsonb_build_object('ok', true, 'scope', p_scope, 'hint', p_hint);
END $$;
GRANT EXECUTE ON FUNCTION public.puzzle_set_prefs(TEXT, TEXT) TO authenticated;

-- Generator by scope (big = marquee floor, all = wide floor). No rarity tiers.
CREATE OR REPLACE FUNCTION public.puzzle_generate_guess_score(p_level TEXT, p_count INTEGER, p_start_date DATE)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cfg public.puzzle_config; v_floor NUMERIC; v_need INT; v_seq INT; v_games INT := 0; v_gid UUID; v_rn INT := 0; rec RECORD;
BEGIN
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  v_floor := CASE p_level WHEN 'big' THEN v_cfg.pop_floor_big ELSE v_cfg.pop_floor_all END;
  v_need := p_count * v_cfg.rounds_per_game;
  SELECT COALESCE(max(seq), 0) INTO v_seq FROM public.puzzle_games WHERE level = p_level AND game_type = 'guess_score';

  CREATE TEMP TABLE _cand ON COMMIT DROP AS
  SELECT f.id AS fixture_id, f.season, f.date, f.round, f.goals_home, f.goals_away,
         ht.api_id AS ha, ht.name AS hn, ht.logo_url AS hl, at2.api_id AS aa, at2.name AS an, at2.logo_url AS al, lg.name AS comp,
         (COALESCE(ph.popularity,50) + COALESCE(pa.popularity,50)) / 2.0 AS popm
  FROM public.fb_fixtures f
  JOIN public.fb_teams ht ON ht.id = f.home_team_id
  JOIN public.fb_teams at2 ON at2.id = f.away_team_id
  LEFT JOIN public.fb_leagues lg ON lg.id = f.league_id
  LEFT JOIN public.team_popularity ph ON ph.team_api_id = ht.api_id
  LEFT JOIN public.team_popularity pa ON pa.team_api_id = at2.api_id
  WHERE f.season IS NOT NULL AND f.status='FT' AND f.goals_home IS NOT NULL AND f.goals_away IS NOT NULL
    AND f.id NOT IN (SELECT fixture_id FROM public.puzzle_rounds WHERE fixture_id IS NOT NULL);

  FOR rec IN SELECT * FROM _cand WHERE popm >= v_floor ORDER BY random() LIMIT v_need LOOP
    IF v_rn = 0 THEN
      v_seq := v_seq + 1; v_games := v_games + 1;
      INSERT INTO public.puzzle_games (game_type, level, puzzle_date, seq, status)
      VALUES ('guess_score', p_level, p_start_date + (v_games - 1), v_seq, 'scheduled') RETURNING id INTO v_gid;
    END IF;
    v_rn := v_rn + 1;
    INSERT INTO public.puzzle_rounds (game_id, round_no, fixture_id, home_team_api, home_name, home_logo,
      away_team_api, away_name, away_logo, season, competition_name, stage, match_date, answer_home, answer_away, hints, difficulty_score)
    VALUES (v_gid, v_rn, rec.fixture_id, rec.ha, rec.hn, rec.hl, rec.aa, rec.an, rec.al, rec.season,
      COALESCE(rec.comp, 'La Liga'),
      CASE WHEN rec.round ILIKE 'Regular Season -%' THEN replace(rec.round, 'Regular Season - ', 'Matchday ') ELSE rec.round END,
      rec.date::date, rec.goals_home, rec.goals_away, public.puzzle_hints(rec.goals_home, rec.goals_away), round(rec.popm,1));
    IF v_rn = v_cfg.rounds_per_game THEN v_rn := 0; END IF;
  END LOOP;
  RETURN v_games;
END $$;

-- Feedback now follows the player's HINT preference (not the game).
CREATE OR REPLACE FUNCTION public.puzzle_guess(p_game_id UUID, p_round_no INTEGER, p_home INTEGER, p_away INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_play public.puzzle_plays; v_round public.puzzle_rounds; v_cfg public.puzzle_config;
  v_att public.puzzle_round_attempts; v_solved BOOLEAN; v_attempts INT; v_hint TEXT; v_fb JSONB; v_d INT; b JSONB; v_heat TEXT := 'cold';
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=p_game_id;
  IF v_play.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_started'); END IF;
  IF v_play.finished_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'finished'); END IF;
  SELECT * INTO v_round FROM public.puzzle_rounds WHERE game_id=p_game_id AND round_no=p_round_no;
  IF v_round.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_round'); END IF;
  v_hint := COALESCE((SELECT hint FROM public.puzzle_user_prefs WHERE user_id=v_user), 'easy');

  SELECT * INTO v_att FROM public.puzzle_round_attempts WHERE play_id=v_play.id AND round_no=p_round_no;
  IF v_att.solved THEN RETURN jsonb_build_object('ok', true, 'already', true, 'solved', true); END IF;
  IF COALESCE(v_att.attempts,0) >= v_cfg.max_attempts THEN RETURN jsonb_build_object('ok', false, 'error', 'no_attempts_left'); END IF;

  v_solved := (p_home = v_round.answer_home AND p_away = v_round.answer_away);
  v_d := abs(p_home - v_round.answer_home) + abs(p_away - v_round.answer_away);
  v_attempts := COALESCE(v_att.attempts,0) + 1;

  IF v_hint = 'easy' THEN
    v_fb := jsonb_build_object('kind','arrows',
      'home', CASE WHEN p_home < v_round.answer_home THEN 'up' WHEN p_home > v_round.answer_home THEN 'down' ELSE 'ok' END,
      'away', CASE WHEN p_away < v_round.answer_away THEN 'up' WHEN p_away > v_round.answer_away THEN 'down' ELSE 'ok' END);
  ELSIF v_hint = 'medium' THEN
    v_fb := jsonb_build_object('kind','distance','value', v_d);
  ELSE
    FOR b IN SELECT * FROM jsonb_array_elements(v_cfg.heat_bands) LOOP IF v_d <= (b->>'max')::int THEN v_heat := b->>'key'; EXIT; END IF; END LOOP;
    v_fb := jsonb_build_object('kind','heat','key', v_heat);
  END IF;

  INSERT INTO public.puzzle_round_attempts (play_id, round_no, guesses, solved, attempts)
  VALUES (v_play.id, p_round_no, jsonb_build_array(jsonb_build_object('h',p_home,'a',p_away,'fb',v_fb)), v_solved, 1)
  ON CONFLICT (play_id, round_no) DO UPDATE SET
    guesses = public.puzzle_round_attempts.guesses || jsonb_build_object('h',p_home,'a',p_away,'fb',v_fb), solved = v_solved, attempts = v_attempts;

  RETURN jsonb_build_object('ok', true, 'solved', v_solved, 'attempts_used', v_attempts,
    'attempts_left', v_cfg.max_attempts - v_attempts, 'fb', v_fb,
    'reveal', CASE WHEN v_solved OR v_attempts >= v_cfg.max_attempts THEN jsonb_build_object('home', v_round.answer_home, 'away', v_round.answer_away) ELSE NULL END);
END $$;
