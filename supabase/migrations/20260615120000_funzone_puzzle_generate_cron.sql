-- =====================================================
-- FunZone daily-puzzle generation cron
-- The generators (generate-connections / grid / rapid / lineup-puzzle) were never
-- scheduled, so no daily content existed. This keeps a rolling ~30-day horizon filled
-- by generating the far-edge day (CURRENT_DATE + 30) once per day, per game/difficulty.
--
-- Auth: the public anon key (verify_jwt is off on these functions). Each function uses
-- its own SUPABASE_SERVICE_ROLE_KEY internally for the DB writes.
-- (current_setting('supabase.service_role_key') returns NULL in pg_cron context here —
--  see 20251126000000_fix_sync_cron_auth.sql — so we pass the anon bearer explicitly.)
-- =====================================================

CREATE OR REPLACE FUNCTION public.funzone_generate_horizon()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_base text := 'https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/';
  v_hdr  jsonb := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyeXB1emR1cGxiemJtdmVmdnpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MjA1NjgsImV4cCI6MjA3NTM5NjU2OH0.jsUTKfIjsLF2wlbBPeJDlFPj2ICozE6VaqYA7egKrsQ');
  v_date text := (CURRENT_DATE + 30)::text;   -- generate the day that will be "today" in 30 days
  v_lvl  text;
  v_ho   int;
BEGIN
  -- Football Connections (single 'daily' level)
  PERFORM net.http_post(url := v_base || 'generate-connections', headers := v_hdr,
    body := jsonb_build_object('count', 1, 'start_date', v_date));

  -- Box2Box grid + Rapid Fire (easy / medium / hard)
  FOREACH v_lvl IN ARRAY ARRAY['easy','medium','hard'] LOOP
    PERFORM net.http_post(url := v_base || 'generate-grid', headers := v_hdr,
      body := jsonb_build_object('count', 1, 'start_date', v_date, 'level', v_lvl));
    PERFORM net.http_post(url := v_base || 'generate-rapid', headers := v_hdr,
      body := jsonb_build_object('count', 1, 'start_date', v_date, 'level', v_lvl));
  END LOOP;

  -- Guess the Lineup (scope 'big' only — 'all' has no source data; holes 1 = no-prefs
  -- default, 3/6/11 = the difficulties offered in the picker)
  FOREACH v_ho IN ARRAY ARRAY[1, 3, 6, 11] LOOP
    PERFORM net.http_post(url := v_base || 'generate-lineup-puzzle', headers := v_hdr,
      body := jsonb_build_object('scope', 'big', 'holes', v_ho, 'count', 1, 'start_date', v_date, 'rounds', 5));
  END LOOP;
END;
$fn$;

-- Schedule daily at 03:17 UTC.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('funzone-puzzle-generate')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'funzone-puzzle-generate');
    PERFORM cron.schedule('funzone-puzzle-generate', '17 3 * * *',
      $cron$ SELECT public.funzone_generate_horizon(); $cron$);
  END IF;
END $$;

-- Verify:  SELECT * FROM cron.job WHERE jobname = 'funzone-puzzle-generate';
-- Run now: SELECT public.funzone_generate_horizon();
-- History: SELECT * FROM cron.job_run_details
--          WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname='funzone-puzzle-generate')
--          ORDER BY start_time DESC LIMIT 10;
