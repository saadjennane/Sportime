-- Results + leaderboard end-screens for the 3 live games.
-- Crowd stats are computed once and cached in a crowd_stats column (lazily on first
-- read after the game is finished — also works for already-finished games).

ALTER TABLE public.live_games ADD COLUMN IF NOT EXISTS crowd_stats JSONB;
ALTER TABLE public.mr_games   ADD COLUMN IF NOT EXISTS crowd_stats JSONB;
ALTER TABLE public.lf_games   ADD COLUMN IF NOT EXISTS crowd_stats JSONB;

-- ───────────────────────────── Live Prediction ─────────────────────────────
CREATE OR REPLACE FUNCTION public.compute_lp_crowd_stats(p_game_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE gh INT; ga INT; v_total INT; v_correct INT; v_exact INT; v_top INT; v_preds JSONB;
BEGIN
  SELECT f.goals_home, f.goals_away INTO gh, ga
  FROM live_games g JOIN fb_fixtures f ON f.id = g.fixture_id WHERE g.id = p_game_id;
  IF gh IS NULL OR ga IS NULL THEN RETURN NULL; END IF;
  SELECT count(*),
    count(*) FILTER (WHERE sign((predicted_score->>'home')::int - (predicted_score->>'away')::int) = sign(gh - ga)),
    count(*) FILTER (WHERE (predicted_score->>'home')::int = gh AND (predicted_score->>'away')::int = ga),
    COALESCE(max(total_points), 0)
  INTO v_total, v_correct, v_exact, v_top
  FROM live_game_entries WHERE game_id = p_game_id AND predicted_score IS NOT NULL;
  IF COALESCE(v_total,0) = 0 THEN RETURN jsonb_build_object('players', 0); END IF;
  SELECT jsonb_agg(x) INTO v_preds FROM (
    SELECT jsonb_build_object(
      'score', (predicted_score->>'home') || '-' || (predicted_score->>'away'),
      'pct', round(100.0 * count(*) / v_total)) AS x
    FROM live_game_entries WHERE game_id = p_game_id AND predicted_score IS NOT NULL
    GROUP BY (predicted_score->>'home'), (predicted_score->>'away')
    ORDER BY count(*) DESC LIMIT 3) t;
  RETURN jsonb_build_object(
    'players', v_total,
    'correct_winner_pct', round(100.0 * v_correct / v_total),
    'exact_score_pct', round(100.0 * v_exact / v_total),
    'actual_score', jsonb_build_object('home', gh, 'away', ga),
    'top_predictions', COALESCE(v_preds, '[]'::jsonb),
    'top_score', v_top);
END $$;

CREATE OR REPLACE FUNCTION public.lp_results(p_fixture_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g RECORD; v_stats JSONB; v_lb JSONB; v_uid UUID := auth.uid();
BEGIN
  SELECT * INTO g FROM live_games WHERE fixture_id = p_fixture_id ORDER BY created_at DESC LIMIT 1;
  IF g.id IS NULL THEN RETURN NULL; END IF;
  v_stats := g.crowd_stats;
  IF v_stats IS NULL AND g.status = 'finished' THEN
    v_stats := compute_lp_crowd_stats(g.id);
    UPDATE live_games SET crowd_stats = v_stats WHERE id = g.id;
  END IF;
  SELECT jsonb_agg(jsonb_build_object(
    'user_id', e.user_id, 'username', COALESCE(pr.username, 'Player'),
    'points', e.total_points, 'rank', e.rank,
    'predicted_score', e.predicted_score, 'is_me', e.user_id = v_uid)
    ORDER BY e.rank NULLS LAST, e.total_points DESC)
  INTO v_lb FROM live_game_entries e LEFT JOIN profiles pr ON pr.id = e.user_id
  WHERE e.game_id = g.id;
  RETURN jsonb_build_object('game_type', 'live_prediction', 'game_id', g.id,
    'status', g.status, 'crowd_stats', v_stats,
    'i_played', EXISTS(SELECT 1 FROM live_game_entries WHERE game_id = g.id AND user_id = v_uid),
    'leaderboard', COALESCE(v_lb, '[]'::jsonb));
END $$;

-- ───────────────────────────── Match Royale ─────────────────────────────
CREATE OR REPLACE FUNCTION public.compute_mr_crowd_stats(p_game_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_entered INT; v_survived INT; v_pot INT; v_winners JSONB; v_peak JSONB;
BEGIN
  SELECT pot_amount INTO v_pot FROM mr_games WHERE id = p_game_id;
  SELECT count(*), count(*) FILTER (WHERE is_winner) INTO v_entered, v_survived
  FROM mr_participants WHERE game_id = p_game_id;
  IF COALESCE(v_entered,0) = 0 THEN RETURN jsonb_build_object('entered', 0); END IF;
  SELECT jsonb_agg(jsonb_build_object('username', COALESCE(pr.username, 'Player'), 'prize', p.prize_amount))
  INTO v_winners FROM mr_participants p LEFT JOIN profiles pr ON pr.id = p.user_id
  WHERE p.game_id = p_game_id AND p.is_winner;
  SELECT jsonb_build_object('seq', eliminated_question_seq, 'count', count(*))
  INTO v_peak FROM mr_participants
  WHERE game_id = p_game_id AND eliminated_question_seq IS NOT NULL
  GROUP BY eliminated_question_seq ORDER BY count(*) DESC LIMIT 1;
  RETURN jsonb_build_object('entered', v_entered, 'survived', v_survived,
    'survived_pct', round(100.0 * v_survived / v_entered), 'pot', COALESCE(v_pot, 0),
    'winners', COALESCE(v_winners, '[]'::jsonb), 'elimination_peak', v_peak);
END $$;

CREATE OR REPLACE FUNCTION public.mr_results(p_fixture_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g RECORD; v_stats JSONB; v_lb JSONB; v_uid UUID := auth.uid();
BEGIN
  SELECT * INTO g FROM mr_games WHERE fixture_id = p_fixture_id ORDER BY created_at DESC LIMIT 1;
  IF g.id IS NULL THEN RETURN NULL; END IF;
  v_stats := g.crowd_stats;
  IF v_stats IS NULL AND g.status = 'finished' THEN
    v_stats := compute_mr_crowd_stats(g.id);
    UPDATE mr_games SET crowd_stats = v_stats WHERE id = g.id;
  END IF;
  SELECT jsonb_agg(jsonb_build_object(
    'user_id', p.user_id, 'username', COALESCE(pr.username, 'Player'),
    'is_winner', p.is_winner, 'lives', p.lives, 'status', p.status,
    'eliminated_seq', p.eliminated_question_seq, 'prize', p.prize_amount,
    'is_me', p.user_id = v_uid)
    ORDER BY p.is_winner DESC, p.eliminated_question_seq DESC NULLS FIRST, p.eliminated_at DESC NULLS FIRST)
  INTO v_lb FROM mr_participants p LEFT JOIN profiles pr ON pr.id = p.user_id
  WHERE p.game_id = g.id;
  RETURN jsonb_build_object('game_type', 'match_royale', 'game_id', g.id,
    'status', g.status, 'crowd_stats', v_stats,
    'i_played', EXISTS(SELECT 1 FROM mr_participants WHERE game_id = g.id AND user_id = v_uid),
    'leaderboard', COALESCE(v_lb, '[]'::jsonb));
END $$;

-- ───────────────────────────── Live Fantasy ─────────────────────────────
CREATE OR REPLACE FUNCTION public.compute_lf_crowd_stats(p_game_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_players INT; v_top NUMERIC; v_winner JSONB; v_most JSONB; v_cap JSONB; v_gk JSONB; v_pot INT;
BEGIN
  SELECT pot_amount INTO v_pot FROM lf_games WHERE id = p_game_id;
  SELECT count(*), COALESCE(max(score), 0) INTO v_players, v_top FROM lf_teams WHERE game_id = p_game_id;
  IF COALESCE(v_players,0) = 0 THEN RETURN jsonb_build_object('players', 0); END IF;
  SELECT jsonb_build_object('username', COALESCE(pr.username, 'Player'), 'score', t.score)
  INTO v_winner FROM lf_teams t LEFT JOIN profiles pr ON pr.id = t.user_id
  WHERE t.game_id = p_game_id ORDER BY t.score DESC NULLS LAST LIMIT 1;
  SELECT jsonb_build_object('name', pl.name, 'pct', round(100.0 * count(*) / v_players))
  INTO v_most FROM lf_team_players tp JOIN lf_teams t ON t.id = tp.team_id JOIN players pl ON pl.id = tp.player_id
  WHERE t.game_id = p_game_id AND tp.active GROUP BY pl.id, pl.name ORDER BY count(*) DESC LIMIT 1;
  SELECT jsonb_build_object('name', pl.name, 'pct', round(100.0 * count(*) / v_players))
  INTO v_cap FROM lf_teams t JOIN players pl ON pl.id = t.captain_player_id
  WHERE t.game_id = p_game_id AND t.captain_player_id IS NOT NULL GROUP BY pl.id, pl.name ORDER BY count(*) DESC LIMIT 1;
  SELECT jsonb_build_object('name', pl.name, 'mult', gu.mult,
    'pct', round(100.0 * COALESCE((SELECT count(*) FROM lf_team_players tp2 JOIN lf_teams t2 ON t2.id = tp2.team_id
              WHERE t2.game_id = p_game_id AND tp2.player_id = gu.pid AND tp2.active), 0) / v_players))
  INTO v_gk FROM (
    SELECT key::uuid AS pid, value::numeric AS mult FROM lf_games g, jsonb_each_text(g.gk_underdog)
    WHERE g.id = p_game_id ORDER BY value::numeric DESC LIMIT 1) gu
  JOIN players pl ON pl.id = gu.pid;
  RETURN jsonb_build_object('players', v_players, 'top_score', v_top, 'winner', v_winner,
    'most_picked', v_most, 'best_captain', v_cap, 'gk_underdog', v_gk, 'pot', COALESCE(v_pot, 0));
END $$;

CREATE OR REPLACE FUNCTION public.lf_results(p_fixture_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g RECORD; v_stats JSONB; v_lb JSONB; v_uid UUID := auth.uid();
BEGIN
  SELECT * INTO g FROM lf_games WHERE fixture_id = p_fixture_id ORDER BY created_at DESC LIMIT 1;
  IF g.id IS NULL THEN RETURN NULL; END IF;
  v_stats := g.crowd_stats;
  IF v_stats IS NULL AND g.status = 'settled' THEN
    v_stats := compute_lf_crowd_stats(g.id);
    UPDATE lf_games SET crowd_stats = v_stats WHERE id = g.id;
  END IF;
  SELECT jsonb_agg(jsonb_build_object(
    'user_id', t.user_id, 'username', COALESCE(pr.username, 'Player'),
    'score', t.score, 'rank', t.rank, 'is_me', t.user_id = v_uid)
    ORDER BY t.rank NULLS LAST, t.score DESC NULLS LAST)
  INTO v_lb FROM lf_teams t LEFT JOIN profiles pr ON pr.id = t.user_id
  WHERE t.game_id = g.id;
  RETURN jsonb_build_object('game_type', 'live_fantasy', 'game_id', g.id,
    'status', g.status, 'crowd_stats', v_stats,
    'i_played', EXISTS(SELECT 1 FROM lf_teams WHERE game_id = g.id AND user_id = v_uid),
    'leaderboard', COALESCE(v_lb, '[]'::jsonb));
END $$;

-- ───────────── Index: which games ran on this fixture (+ teaser counts) ─────────────
CREATE OR REPLACE FUNCTION public.live_results_index(p_fixture_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lp JSONB; v_mr JSONB; v_lf JSONB;
BEGIN
  SELECT jsonb_build_object('game_type','live_prediction','status',lg.status,
    'players',(SELECT count(*) FROM live_game_entries WHERE game_id = lg.id))
  INTO v_lp FROM live_games lg WHERE lg.fixture_id = p_fixture_id ORDER BY lg.created_at DESC LIMIT 1;
  SELECT jsonb_build_object('game_type','match_royale','status',mg.status,
    'players',(SELECT count(*) FROM mr_participants WHERE game_id = mg.id),
    'winners',(SELECT count(*) FROM mr_participants WHERE game_id = mg.id AND is_winner))
  INTO v_mr FROM mr_games mg WHERE mg.fixture_id = p_fixture_id ORDER BY mg.created_at DESC LIMIT 1;
  SELECT jsonb_build_object('game_type','live_fantasy','status',lf.status,
    'players',(SELECT count(*) FROM lf_teams WHERE game_id = lf.id))
  INTO v_lf FROM lf_games lf WHERE lf.fixture_id = p_fixture_id ORDER BY lf.created_at DESC LIMIT 1;
  RETURN jsonb_build_object('fixture_id', p_fixture_id,
    'games', jsonb_strip_nulls(jsonb_build_object('live_prediction', v_lp, 'match_royale', v_mr, 'live_fantasy', v_lf)));
END $$;

GRANT EXECUTE ON FUNCTION public.lp_results(UUID), public.mr_results(UUID), public.lf_results(UUID),
  public.live_results_index(UUID), public.compute_lp_crowd_stats(UUID),
  public.compute_mr_crowd_stats(UUID), public.compute_lf_crowd_stats(UUID) TO authenticated, service_role;
