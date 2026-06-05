-- Debug: Check finished matches from the last 2 days
-- Check what finished matches exist in the database

-- 1. Get today's date boundaries
SELECT
  'Today boundaries' as step,
  NOW() as now,
  DATE_TRUNC('day', NOW()) as today_start,
  DATE_TRUNC('day', NOW()) + INTERVAL '1 day' - INTERVAL '1 second' as today_end;

-- 2. Get date range for last 2 days
SELECT
  'Last 2 days range' as step,
  (DATE_TRUNC('day', NOW()) - INTERVAL '2 days') as from_date,
  (DATE_TRUNC('day', NOW()) + INTERVAL '1 day' - INTERVAL '1 second') as to_date;

-- 3. Check finished matches in last 2 days
SELECT
  'Finished matches count' as info,
  COUNT(*) as total_count,
  COUNT(CASE WHEN DATE(date) = CURRENT_DATE THEN 1 END) as today_count,
  COUNT(CASE WHEN DATE(date) = CURRENT_DATE - 1 THEN 1 END) as yesterday_count,
  COUNT(CASE WHEN DATE(date) = CURRENT_DATE - 2 THEN 1 END) as two_days_ago_count
FROM fb_fixtures
WHERE date >= (DATE_TRUNC('day', NOW()) - INTERVAL '2 days')
  AND date <= (DATE_TRUNC('day', NOW()) + INTERVAL '1 day' - INTERVAL '1 second')
  AND status IN ('FT', 'AET', 'PEN', 'AWARDED', 'W.O', 'CANC', 'ABD', 'POST');

-- 4. Show sample matches from yesterday
SELECT
  'Sample matches from yesterday' as info,
  id,
  api_id,
  date,
  status,
  goals_home,
  goals_away,
  DATE(date) as match_date
FROM fb_fixtures
WHERE DATE(date) = CURRENT_DATE - 1
  AND status IN ('FT', 'AET', 'PEN', 'AWARDED', 'W.O', 'CANC', 'ABD', 'POST')
ORDER BY date DESC
LIMIT 5;

-- 5. Check all matches with their dates in last 3 days
SELECT
  DATE(date) as match_date,
  status,
  COUNT(*) as count
FROM fb_fixtures
WHERE date >= (DATE_TRUNC('day', NOW()) - INTERVAL '3 days')
  AND date <= NOW()
GROUP BY DATE(date), status
ORDER BY match_date DESC, status;

-- 6. Check timezone of stored dates
SELECT
  'Sample dates with timezone' as info,
  date,
  date AT TIME ZONE 'UTC' as utc_date,
  DATE(date) as date_part,
  status
FROM fb_fixtures
WHERE date >= (DATE_TRUNC('day', NOW()) - INTERVAL '2 days')
ORDER BY date DESC
LIMIT 10;
