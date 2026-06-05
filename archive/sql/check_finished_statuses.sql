-- Check what statuses exist in fb_fixtures
SELECT
  status,
  COUNT(*) as count,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM fb_fixtures
GROUP BY status
ORDER BY count DESC;

-- Check if there are ANY finished matches at all
SELECT COUNT(*) as finished_count
FROM fb_fixtures
WHERE status IN ('FT', 'AET', 'PEN', 'AWARDED', 'W.O', 'CANC', 'ABD', 'POST');

-- Check matches from yesterday and today with ANY status
SELECT
  DATE(date) as match_date,
  status,
  COUNT(*) as count
FROM fb_fixtures
WHERE date >= CURRENT_DATE - 1
  AND date <= CURRENT_DATE + 1
GROUP BY DATE(date), status
ORDER BY match_date, status;
