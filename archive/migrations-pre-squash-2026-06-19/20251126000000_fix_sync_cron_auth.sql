-- =====================================================
-- Migration: Fix Sync Live Scores Cron Authentication
-- Description: Remove Authorization header that causes 401 errors
-- Problem: current_setting('supabase.service_role_key', true) returns NULL in pg_cron context
-- Solution: Edge Functions already have access to env vars, no auth header needed
-- =====================================================

-- First, unschedule existing cron jobs that have broken auth
SELECT cron.unschedule('sync-live-scores');
SELECT cron.unschedule('sync-daily-correction');

-- =====================================================
-- CRON 1: Sync Live Scores (every minute)
-- The Edge Function will make 2 API calls spaced 30s apart
-- No Authorization header - the function uses its own SUPABASE_SERVICE_ROLE_KEY
-- =====================================================
SELECT cron.schedule(
  'sync-live-scores',
  '* * * * *',  -- Every minute
  $$
  SELECT net.http_post(
    url := 'https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/sync-live-scores',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"mode": "live"}'::jsonb
  );
  $$
);

-- =====================================================
-- CRON 2: Daily Correction (every day at 06:00 UTC)
-- Catches any missed matches from the previous day
-- Also fixes stuck matches (in 1H/HT/2H for > 4 hours)
-- =====================================================
SELECT cron.schedule(
  'sync-daily-correction',
  '0 6 * * *',  -- Every day at 06:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/sync-live-scores',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"mode": "daily_correction"}'::jsonb
  );
  $$
);

-- =====================================================
-- Verification query (run manually to check cron jobs)
-- SELECT * FROM cron.job WHERE jobname LIKE 'sync%';
--
-- Check execution history:
-- SELECT * FROM cron.job_run_details
-- WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE 'sync%')
-- ORDER BY start_time DESC LIMIT 10;
-- =====================================================
