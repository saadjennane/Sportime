-- "Only Big Clubs" = player passed through >=1 big club (anywhere in the trail).
-- 1) Seed major foreign clubs into team_popularity so the trail-based check sees them.
INSERT INTO public.team_popularity (team_api_id, team_name, popularity, is_manual)
SELECT api, max(name), 90, true FROM (
  SELECT team_in_api api, team_in_name name FROM public.fb_transfers
  UNION ALL SELECT team_out_api, team_out_name FROM public.fb_transfers
) x
WHERE api IS NOT NULL AND name = ANY (ARRAY[
  'Manchester United','Manchester City','Liverpool','Chelsea','Arsenal','Tottenham',
  'Bayern Munich','Bayern München','Borussia Dortmund','RB Leipzig','Bayer Leverkusen',
  'Paris Saint Germain','Marseille','Lyon','Monaco',
  'Juventus','Inter','AC Milan','Napoli','AS Roma','Atalanta','Lazio',
  'Ajax','PSV Eindhoven','FC Porto','Benfica','Sporting CP','Celtic','Rangers'])
GROUP BY api
ON CONFLICT (team_api_id) DO UPDATE SET popularity = GREATEST(public.team_popularity.popularity, 90), is_manual = true;

-- 2) Generator: notoriety = max popularity across the WHOLE trail; big = >=1 big club.
CREATE OR REPLACE FUNCTION public.puzzle_generate_guess_player(p_level TEXT, p_count INTEGER, p_start_date DATE)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cfg public.puzzle_config; v_floor NUMERIC; v_need INT; v_seq INT; v_games INT := 0; v_gid UUID; v_rn INT := 0; rec RECORD; v_trail JSONB; v_era TEXT;
BEGIN
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  -- big = the trail contains a club with popularity >= 78; all = no restriction
  v_floor := CASE p_level WHEN 'big' THEN 78 ELSE 0 END;
  v_need := p_count * v_cfg.rounds_per_game;
  SELECT COALESCE(max(seq), 0) INTO v_seq FROM public.puzzle_games WHERE level = p_level AND game_type = 'guess_player';

  CREATE TEMP TABLE _pcand ON COMMIT DROP AS
  WITH club_noto AS (
    SELECT t.player_id, max(COALESCE(tp.popularity, 30)) AS noto
    FROM (SELECT player_id, team_in_api AS api FROM public.fb_transfers WHERE team_in_api IS NOT NULL
          UNION ALL SELECT player_id, team_out_api FROM public.fb_transfers WHERE team_out_api IS NOT NULL) t
    LEFT JOIN public.team_popularity tp ON tp.team_api_id = t.api
    GROUP BY t.player_id
  ),
  pstats AS (
    SELECT pss.player_id, mode() WITHIN GROUP (ORDER BY pss.position) pos, min(pss.season) smin, max(pss.season) smax,
           (SELECT count(*) FROM public.fb_transfers tt WHERE tt.player_id = pss.player_id) tcount
    FROM public.fb_player_season_stats pss GROUP BY pss.player_id
  )
  SELECT p.api_id AS id, p.name, p.photo, p.nationality, cn.noto, ps.pos, ps.smin, ps.smax
  FROM public.fb_players p
  JOIN pstats ps ON ps.player_id = p.api_id
  LEFT JOIN club_noto cn ON cn.player_id = p.api_id
  WHERE COALESCE(cn.noto,0) >= v_floor AND ps.tcount >= 2
    AND p.api_id NOT IN (SELECT answer_player_id FROM public.puzzle_rounds WHERE answer_player_id IS NOT NULL);

  FOR rec IN SELECT * FROM _pcand ORDER BY random() LIMIT v_need * 2 LOOP
    v_trail := public.puzzle_player_trail(rec.id);
    IF jsonb_array_length(v_trail) < 3 THEN CONTINUE; END IF;
    IF v_rn = 0 THEN
      v_seq := v_seq + 1; v_games := v_games + 1;
      INSERT INTO public.puzzle_games (game_type, level, puzzle_date, seq, status)
      VALUES ('guess_player', p_level, p_start_date + (v_games - 1), v_seq, 'scheduled') RETURNING id INTO v_gid;
    END IF;
    v_rn := v_rn + 1;
    v_era := CASE WHEN rec.smin = rec.smax THEN rec.smin::text ELSE rec.smin::text || '–' || rec.smax::text END;
    INSERT INTO public.puzzle_rounds (game_id, round_no, answer_player_id, payload)
    VALUES (v_gid, v_rn, rec.id, jsonb_build_object('trail', v_trail,
      'hints', jsonb_build_array(
        jsonb_build_object('k','Position','v', COALESCE(rec.pos,'—')),
        jsonb_build_object('k','Nationality','v', COALESCE(NULLIF(rec.nationality,'Unknown'),'—')),
        jsonb_build_object('k','Era','v', v_era))));
    IF v_rn = v_cfg.rounds_per_game THEN v_rn := 0; IF v_games >= p_count THEN EXIT; END IF; END IF;
  END LOOP;
  RETURN v_games;
END $$;
