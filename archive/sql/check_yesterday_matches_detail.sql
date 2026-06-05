-- Check yesterday's finished matches with full details
SELECT
  id,
  api_id,
  date,
  date AT TIME ZONE 'UTC' as utc_date,
  status,
  goals_home,
  goals_away,
  home_team_id,
  away_team_id,
  league_id
FROM fb_fixtures
WHERE DATE(date) = '2025-11-23'
  AND status = 'FT'
ORDER BY date DESC;

-- Check what the hook is looking for
-- Current timestamp in different formats
SELECT
  NOW() as now,
  CURRENT_DATE as current_date,
  CURRENT_DATE - 1 as yesterday,
  (DATE_TRUNC('day', NOW()) - INTERVAL '2 days') as two_days_ago,
  (DATE_TRUNC('day', NOW()) + INTERVAL '1 day' - INTERVAL '1 second') as end_of_today;

-- Check if yesterday's matches fall within the date range query
SELECT
  'Matches in range' as info,
  COUNT(*) as count
FROM fb_fixtures
WHERE date >= (DATE_TRUNC('day', NOW()) - INTERVAL '2 days')
  AND date <= (DATE_TRUNC('day', NOW()) + INTERVAL '1 day' - INTERVAL '1 second')
  AND status IN ('FT', 'AET', 'PEN', 'AWARDED', 'W.O', 'CANC', 'ABD', 'POST');
