-- Tournament daily prediction reworked: just 1X2, correct = odds x 100.
alter table public.tq_matches add column if not exists odds_home numeric;
alter table public.tq_matches add column if not exists odds_draw numeric;
alter table public.tq_matches add column if not exists odds_away numeric;
alter table public.tq_daily_predictions add column if not exists locked_odds numeric;

-- Backfill odds from fb_odds (matches link to fb fixtures via quest_slot_key 'fx-{api_id}').
update public.tq_matches m set odds_home=o.home_win, odds_draw=o.draw, odds_away=o.away_win
from public.fb_fixtures f
cross join lateral (select home_win, draw, away_win from public.fb_odds where fixture_id=f.id order by updated_at desc nulls last limit 1) o
where m.quest_slot_key = 'fx-' || f.api_id::text;

drop function if exists public.tq_save_daily_prediction(uuid, uuid, integer, integer, text);
create or replace function public.tq_save_daily_prediction(p_comp uuid, p_match_id uuid, p_result text)
returns void language plpgsql security definer set search_path to 'public' as $$
DECLARE v_entry UUID; v_start TIMESTAMPTZ; v_status TEXT; v_odds NUMERIC;
BEGIN
  IF p_result NOT IN ('A','B','draw') THEN RAISE EXCEPTION 'Invalid result'; END IF;
  SELECT start_time, status, CASE p_result WHEN 'A' THEN odds_home WHEN 'B' THEN odds_away ELSE odds_draw END
    INTO v_start, v_status, v_odds FROM public.tq_matches WHERE id=p_match_id AND competition_id=p_comp;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF v_status <> 'scheduled' OR (v_start IS NOT NULL AND now() >= v_start) THEN RAISE EXCEPTION 'This match is locked'; END IF;
  v_entry := public.tq_get_or_create_entry(p_comp);
  INSERT INTO public.tq_daily_predictions (entry_id, match_id, predicted_result, locked_odds, predicted_score_a, predicted_score_b, predicted_bonus)
  VALUES (v_entry, p_match_id, p_result, v_odds, NULL, NULL, NULL)
  ON CONFLICT (entry_id, match_id) DO UPDATE SET predicted_result=EXCLUDED.predicted_result, locked_odds=EXCLUDED.locked_odds,
    predicted_score_a=NULL, predicted_score_b=NULL, predicted_bonus=NULL;
  UPDATE public.tq_entries SET last_prediction_at = now() WHERE id = v_entry;
END $$;
grant all on function public.tq_save_daily_prediction(uuid,uuid,text) to anon, authenticated, service_role;

create or replace function public.tq_score_daily(p_entry_id uuid) returns integer language plpgsql security definer set search_path to 'public' as $$
DECLARE v_total INT := 0; r RECORD; v_actual TEXT; pts INT;
BEGIN
  DELETE FROM public.tq_scoring_events WHERE entry_id = p_entry_id AND source_type = 'daily';
  FOR r IN
    SELECT dp.id, dp.predicted_result pr, dp.locked_odds odds, m.score_a ra, m.score_b rb
    FROM public.tq_daily_predictions dp JOIN public.tq_matches m ON m.id = dp.match_id
    WHERE m.status='finished' AND dp.predicted_result IS NOT NULL AND m.score_a IS NOT NULL AND m.score_b IS NOT NULL
  LOOP
    v_actual := CASE WHEN r.ra > r.rb THEN 'A' WHEN r.ra < r.rb THEN 'B' ELSE 'draw' END;
    pts := CASE WHEN r.pr = v_actual THEN round(COALESCE(r.odds,0) * 100)::int ELSE 0 END;
    UPDATE public.tq_daily_predictions SET points_awarded = pts WHERE id = r.id;
    IF pts > 0 THEN INSERT INTO public.tq_scoring_events(entry_id, source_type, source_id, points, reason) VALUES (p_entry_id, 'daily', r.id, pts, 'daily 1X2'); END IF;
    v_total := v_total + pts;
  END LOOP;
  UPDATE public.tq_entries SET daily_score = v_total, exact_score_predictions_count = 0 WHERE id = p_entry_id;
  RETURN v_total;
END $$;
grant all on function public.tq_score_daily(uuid) to anon, authenticated, service_role;
