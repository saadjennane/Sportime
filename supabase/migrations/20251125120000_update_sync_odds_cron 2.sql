-- =====================================================
-- Migration: Update Sync Odds Cron Jobs
-- Description: Change cron frequency and fix any issues
-- =====================================================

-- First, unschedule the old job if it exists
SELECT cron.unschedule('sync-odds-upcoming') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'sync-odds-upcoming'
);

-- =====================================================
-- CRON: Sync Odds (every hour at minute 15)
-- Runs 15 minutes after fixture sync to catch new fixtures
-- =====================================================
SELECT cron.schedule(
  'sync-odds-upcoming',
  '15 * * * *',  -- Every hour at minute 15
  $$
  SELECT net.http_post(
    url := 'https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/sync-odds',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{"mode": "upcoming", "days_ahead": 3}'::jsonb
  );
  $$
);

-- =====================================================
-- Verification query (run manually to check cron jobs)
-- SELECT * FROM cron.job WHERE jobname LIKE 'sync%';
-- =====================================================
