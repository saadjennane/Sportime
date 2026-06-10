-- ─────────────────────────────────────────────────────────────────────────────
-- Puzzle generator: team popularity, hints, heat, and the Guess-the-Score builder.
-- ─────────────────────────────────────────────────────────────────────────────

-- Default team popularity from historical standings (avg rank + presence). Keeps manual overrides.
CREATE OR REPLACE FUNCTION public.seed_team_popularity()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INTEGER; v_total INTEGER;
BEGIN
  SELECT count(DISTINCT season) INTO v_total FROM public.fb_standings;
  WITH agg AS (
    SELECT team_api_id, max(team_name) AS name, avg(rank) AS avg_rank, count(*) AS seasons
    FROM public.fb_standings GROUP BY team_api_id
  )
  INSERT INTO public.team_popularity (team_api_id, team_name, popularity, is_manual)
  SELECT team_api_id, name,
    GREATEST(5, LEAST(100, round(
      0.7 * (100 * (1 - (avg_rank - 1) / 19.0)) +
      0.3 * (100 * seasons / NULLIF(v_total,0))
    )))::int, false
  FROM agg
  ON CONFLICT (team_api_id) DO UPDATE
    SET popularity = CASE WHEN public.team_popularity.is_manual THEN public.team_popularity.popularity ELSE EXCLUDED.popularity END,
        team_name = EXCLUDED.team_name, updated_at = now();
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;

-- Derived hints for a scoreline.
CREATE OR REPLACE FUNCTION public.puzzle_hints(h INTEGER, a INTEGER)
RETURNS JSONB LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE arr TEXT[] := '{}';
BEGIN
  IF h + a = 0 THEN arr := arr || 'Goalless draw'; END IF;
  IF (h > 0 AND a = 0) OR (h = 0 AND a > 0) THEN arr := arr || 'Only one team scored'; END IF;
  IF h > 0 AND a > 0 THEN arr := arr || 'Both teams scored'; END IF;
  IF h = a AND h > 0 THEN arr := arr || 'A draw, but not goalless'; END IF;
  IF h + a = 1 THEN arr := arr || 'Only one goal in the whole match'; END IF;
  IF h + a >= 4 THEN arr := arr || 'Goal fest (4+ goals)'; END IF;
  IF abs(h - a) >= 3 THEN arr := arr || 'A heavy win'; END IF;
  RETURN to_jsonb(arr);
END $$;

-- Heat label from manhattan distance between guess and actual.
CREATE OR REPLACE FUNCTION public.puzzle_heat(gh INTEGER, ga INTEGER, ah INTEGER, aa INTEGER)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE d INTEGER := abs(gh - ah) + abs(ga - aa); b JSONB;
BEGIN
  FOR b IN SELECT * FROM jsonb_array_elements((SELECT heat_bands FROM public.puzzle_config WHERE id = 1)) LOOP
    IF d <= (b->>'max')::int THEN RETURN b->>'key'; END IF;
  END LOOP;
  RETURN 'cold';
END $$;

-- Generate p_count Guess-the-Score games for a level, dates starting at p_start_date.
CREATE OR REPLACE FUNCTION public.puzzle_generate_guess_score(p_level TEXT, p_count INTEGER, p_start_date DATE)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cfg public.puzzle_config; v_min INT; v_max INT; v_maxfreq INT; v_lo NUMERIC; v_hi NUMERIC;
  v_need INT; v_seq INT; v_games INT := 0; v_gid UUID; v_rn INT := 0; rec RECORD;
BEGIN
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  SELECT min(season), max(season) INTO v_min, v_max FROM public.fb_fixtures WHERE season IS NOT NULL;
  SELECT max(c) INTO v_maxfreq FROM (SELECT count(*) c FROM public.fb_fixtures WHERE season IS NOT NULL AND status='FT' GROUP BY goals_home, goals_away) z;
  v_lo := CASE p_level WHEN 'easy' THEN v_cfg.too_easy_max WHEN 'medium' THEN v_cfg.easy_max ELSE v_cfg.medium_max END;
  v_hi := CASE p_level WHEN 'easy' THEN v_cfg.easy_max WHEN 'medium' THEN v_cfg.medium_max ELSE v_cfg.impossible_min END;
  v_need := p_count * v_cfg.rounds_per_game;
  SELECT COALESCE(max(seq), 0) INTO v_seq FROM public.puzzle_games WHERE level = p_level AND game_type = 'guess_score';

  CREATE TEMP TABLE _cand ON COMMIT DROP AS
  WITH freq AS (
    SELECT goals_home gh, goals_away ga, count(*) c
    FROM public.fb_fixtures WHERE season IS NOT NULL AND status='FT' GROUP BY goals_home, goals_away
  )
  SELECT f.id AS fixture_id, f.season, f.date, f.round, f.goals_home, f.goals_away,
         ht.api_id AS ha, ht.name AS hn, ht.logo_url AS hl,
         at2.api_id AS aa, at2.name AS an, at2.logo_url AS al,
         lg.name AS comp,
         ( v_cfg.weight_pop * (100 - (COALESCE(ph.popularity,50) + COALESCE(pa.popularity,50)) / 2.0)
         + v_cfg.weight_rarity * (100 * (1 - fr.c::numeric / NULLIF(v_maxfreq,0)))
         + v_cfg.weight_recency * (100 * (v_max - f.season) / NULLIF(v_max - v_min, 0)) )
         / NULLIF(v_cfg.weight_pop + v_cfg.weight_rarity + v_cfg.weight_recency, 0) AS diff
  FROM public.fb_fixtures f
  JOIN public.fb_teams ht ON ht.id = f.home_team_id
  JOIN public.fb_teams at2 ON at2.id = f.away_team_id
  LEFT JOIN public.fb_leagues lg ON lg.id = f.league_id
  LEFT JOIN public.team_popularity ph ON ph.team_api_id = ht.api_id
  LEFT JOIN public.team_popularity pa ON pa.team_api_id = at2.api_id
  LEFT JOIN freq fr ON fr.gh = f.goals_home AND fr.ga = f.goals_away
  WHERE f.season IS NOT NULL AND f.status = 'FT' AND f.goals_home IS NOT NULL AND f.goals_away IS NOT NULL
    AND f.id NOT IN (SELECT fixture_id FROM public.puzzle_rounds WHERE fixture_id IS NOT NULL);

  -- pick matches inside the level band, randomly
  FOR rec IN
    SELECT * FROM _cand WHERE diff >= v_lo AND diff < v_hi ORDER BY random() LIMIT v_need
  LOOP
    IF v_rn = 0 THEN
      v_seq := v_seq + 1; v_games := v_games + 1;
      INSERT INTO public.puzzle_games (game_type, level, puzzle_date, seq, status)
      VALUES ('guess_score', p_level, p_start_date + (v_games - 1), v_seq, 'scheduled')
      RETURNING id INTO v_gid;
    END IF;
    v_rn := v_rn + 1;
    INSERT INTO public.puzzle_rounds (game_id, round_no, fixture_id, home_team_api, home_name, home_logo,
      away_team_api, away_name, away_logo, season, competition_name, stage, match_date,
      answer_home, answer_away, hints, difficulty_score)
    VALUES (v_gid, v_rn, rec.fixture_id, rec.ha, rec.hn, rec.hl, rec.aa, rec.an, rec.al, rec.season,
      COALESCE(rec.comp, 'La Liga'),
      CASE WHEN rec.round ILIKE 'Regular Season -%' THEN replace(rec.round, 'Regular Season - ', 'Matchday ') ELSE rec.round END,
      rec.date::date, rec.goals_home, rec.goals_away, public.puzzle_hints(rec.goals_home, rec.goals_away), round(rec.diff, 1));
    IF v_rn = v_cfg.rounds_per_game THEN
      UPDATE public.puzzle_games SET difficulty_score = (SELECT round(avg(difficulty_score),1) FROM public.puzzle_rounds WHERE game_id = v_gid) WHERE id = v_gid;
      v_rn := 0;
    END IF;
  END LOOP;

  RETURN v_games;
END $$;

GRANT EXECUTE ON FUNCTION public.seed_team_popularity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.puzzle_generate_guess_score(TEXT, INTEGER, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.puzzle_heat(INTEGER,INTEGER,INTEGER,INTEGER) TO authenticated, anon;
