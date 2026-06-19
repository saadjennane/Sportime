-- Difficulty model v2: keep all matches popular; level = popularity floor (breadth of
-- known teams) AND score rarity (content hardness). Easy = marquee teams + common scores,
-- Hard = wider pool of known teams + rare scores (e.g. "Real Madrid 5-0"). All admin-tunable.
ALTER TABLE public.puzzle_config ADD COLUMN IF NOT EXISTS pop_floor_easy   NUMERIC NOT NULL DEFAULT 75;
ALTER TABLE public.puzzle_config ADD COLUMN IF NOT EXISTS pop_floor_medium NUMERIC NOT NULL DEFAULT 58;
ALTER TABLE public.puzzle_config ADD COLUMN IF NOT EXISTS pop_floor_hard   NUMERIC NOT NULL DEFAULT 45;
ALTER TABLE public.puzzle_config ADD COLUMN IF NOT EXISTS rarity_easy_max   NUMERIC NOT NULL DEFAULT 45;
ALTER TABLE public.puzzle_config ADD COLUMN IF NOT EXISTS rarity_medium_max NUMERIC NOT NULL DEFAULT 72;

CREATE OR REPLACE FUNCTION public.puzzle_generate_guess_score(p_level TEXT, p_count INTEGER, p_start_date DATE)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cfg public.puzzle_config; v_maxfreq INT; v_floor NUMERIC; v_rlo NUMERIC; v_rhi NUMERIC;
  v_need INT; v_seq INT; v_games INT := 0; v_gid UUID; v_rn INT := 0; rec RECORD;
BEGIN
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  SELECT max(c) INTO v_maxfreq FROM (SELECT count(*) c FROM public.fb_fixtures WHERE season IS NOT NULL AND status='FT' GROUP BY goals_home, goals_away) z;
  v_floor := CASE p_level WHEN 'easy' THEN v_cfg.pop_floor_easy WHEN 'medium' THEN v_cfg.pop_floor_medium ELSE v_cfg.pop_floor_hard END;
  v_rlo := CASE p_level WHEN 'easy' THEN 0 WHEN 'medium' THEN v_cfg.rarity_easy_max ELSE v_cfg.rarity_medium_max END;
  v_rhi := CASE p_level WHEN 'easy' THEN v_cfg.rarity_easy_max WHEN 'medium' THEN v_cfg.rarity_medium_max ELSE 101 END;
  v_need := p_count * v_cfg.rounds_per_game;
  SELECT COALESCE(max(seq), 0) INTO v_seq FROM public.puzzle_games WHERE level = p_level AND game_type = 'guess_score';

  CREATE TEMP TABLE _cand ON COMMIT DROP AS
  WITH freq AS (
    SELECT goals_home gh, goals_away ga, count(*) c
    FROM public.fb_fixtures WHERE season IS NOT NULL AND status='FT' GROUP BY goals_home, goals_away
  )
  SELECT f.id AS fixture_id, f.season, f.date, f.round, f.goals_home, f.goals_away,
         ht.api_id AS ha, ht.name AS hn, ht.logo_url AS hl,
         at2.api_id AS aa, at2.name AS an, at2.logo_url AS al, lg.name AS comp,
         (COALESCE(ph.popularity,50) + COALESCE(pa.popularity,50)) / 2.0 AS popm,
         (100 * (1 - fr.c::numeric / NULLIF(v_maxfreq,0))) AS rarity
  FROM public.fb_fixtures f
  JOIN public.fb_teams ht ON ht.id = f.home_team_id
  JOIN public.fb_teams at2 ON at2.id = f.away_team_id
  LEFT JOIN public.fb_leagues lg ON lg.id = f.league_id
  LEFT JOIN public.team_popularity ph ON ph.team_api_id = ht.api_id
  LEFT JOIN public.team_popularity pa ON pa.team_api_id = at2.api_id
  LEFT JOIN freq fr ON fr.gh = f.goals_home AND fr.ga = f.goals_away
  WHERE f.season IS NOT NULL AND f.status='FT' AND f.goals_home IS NOT NULL AND f.goals_away IS NOT NULL
    AND f.id NOT IN (SELECT fixture_id FROM public.puzzle_rounds WHERE fixture_id IS NOT NULL);

  FOR rec IN
    SELECT * FROM _cand WHERE popm >= v_floor AND rarity >= v_rlo AND rarity < v_rhi ORDER BY random() LIMIT v_need
  LOOP
    IF v_rn = 0 THEN
      v_seq := v_seq + 1; v_games := v_games + 1;
      INSERT INTO public.puzzle_games (game_type, level, puzzle_date, seq, status)
      VALUES ('guess_score', p_level, p_start_date + (v_games - 1), v_seq, 'scheduled') RETURNING id INTO v_gid;
    END IF;
    v_rn := v_rn + 1;
    INSERT INTO public.puzzle_rounds (game_id, round_no, fixture_id, home_team_api, home_name, home_logo,
      away_team_api, away_name, away_logo, season, competition_name, stage, match_date,
      answer_home, answer_away, hints, difficulty_score)
    VALUES (v_gid, v_rn, rec.fixture_id, rec.ha, rec.hn, rec.hl, rec.aa, rec.an, rec.al, rec.season,
      COALESCE(rec.comp, 'La Liga'),
      CASE WHEN rec.round ILIKE 'Regular Season -%' THEN replace(rec.round, 'Regular Season - ', 'Matchday ') ELSE rec.round END,
      rec.date::date, rec.goals_home, rec.goals_away, public.puzzle_hints(rec.goals_home, rec.goals_away), round(rec.rarity, 1));
    IF v_rn = v_cfg.rounds_per_game THEN
      UPDATE public.puzzle_games SET difficulty_score = (SELECT round(avg(difficulty_score),1) FROM public.puzzle_rounds WHERE game_id = v_gid) WHERE id = v_gid;
      v_rn := 0;
    END IF;
  END LOOP;
  RETURN v_games;
END $$;
