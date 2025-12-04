-- =====================================================
-- Migration: Add Sync Live Scores Cron Jobs
-- Description: Configure pg_cron jobs for live score synchronization
-- =====================================================

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =====================================================
-- CRON 1: Sync Live Scores (every minute)
-- The Edge Function will make 2 API calls spaced 30s apart
-- =====================================================
SELECT cron.schedule(
  'sync-live-scores',
  '* * * * *',  -- Every minute
  $$
  SELECT net.http_post(
    url := 'https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/sync-live-scores',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{"mode": "live"}'::jsonb
  );
  $$
);

-- =====================================================
-- CRON 2: Daily Correction (every day at 06:00 UTC)
-- Catches any missed matches from the previous day
-- =====================================================
SELECT cron.schedule(
  'sync-daily-correction',
  '0 6 * * *',  -- Every day at 06:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/sync-live-scores',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{"mode": "daily_correction"}'::jsonb
  );
  $$
);

-- =====================================================
-- Verification query (run manually to check cron jobs)
-- SELECT * FROM cron.job;
-- =====================================================
