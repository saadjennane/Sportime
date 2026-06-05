-- =====================================================
-- Migration: Add Sync Odds Cron Jobs
-- Description: Configure pg_cron jobs for odds synchronization
-- =====================================================

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =====================================================
-- CRON: Sync Odds (every hour)
-- Fetches odds from API-Football for upcoming matches
-- =====================================================
SELECT cron.schedule(
  'sync-odds-upcoming',
  '15 * * * *',  -- Every hour at minute 15 (after fixture sync at minute 0)
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
-- SELECT * FROM cron.job;
-- =====================================================
