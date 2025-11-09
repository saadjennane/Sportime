-- ============================================================================
-- Profile Statistics Views and Functions
-- Calculates user stats from existing Supabase data
-- ============================================================================

-- =============================================================================
-- MATERIALIZED VIEW: Daily HPI (Hot Performance Index)
-- Aggregates daily prediction performance for each user
-- =============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.user_daily_hpi AS
SELECT
  sp.user_id,
  DATE(sp.created_at) as prediction_date,
  COUNT(*) as total_predictions,
  SUM(CASE WHEN sp.is_correct THEN 1 ELSE 0 END) as correct_predictions,
  ROUND(
    (SUM(CASE WHEN sp.is_correct THEN 1 ELSE 0 END)::decimal / COUNT(*))
    * AVG((sp.odds_at_prediction->>'home_odds')::decimal),
    2
  ) as hpi
FROM public.swipe_predictions sp
WHERE sp.created_at >= NOW() - INTERVAL '30 days'
GROUP BY sp.user_id, DATE(sp.created_at)
HAVING COUNT(*) >= 3; -- Minimum 3 predictions for valid HPI

CREATE INDEX IF NOT EXISTS idx_user_daily_hpi_user_date
  ON public.user_daily_hpi(user_id, prediction_date DESC);

-- Refresh function (can be called by cron or edge function)
CREATE OR REPLACE FUNCTION public.refresh_user_daily_hpi()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_daily_hpi;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- VIEW: User Profile Statistics
-- Comprehensive stats for each user
-- =============================================================================
CREATE OR REPLACE VIEW public.user_profile_stats AS
WITH
-- Prediction accuracy
prediction_stats AS (
  SELECT
    user_id,
    COUNT(*) as predictions_total,
    SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as predictions_correct
  FROM public.swipe_predictions
  GROUP BY user_id
),

-- Hot Performance Index (average of last 10 active days)
hpi_stats AS (
  SELECT
    user_id,
    ROUND(AVG(hpi), 2) as hot_performance_index,
    MAX(hpi) as best_hpi,
    (ARRAY_AGG(prediction_date ORDER BY hpi DESC))[1] as best_hpi_date
  FROM (
    SELECT user_id, hpi, prediction_date,
      ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY prediction_date DESC) as rn
    FROM public.user_daily_hpi
  ) recent
  WHERE rn <= 10
  GROUP BY user_id
),

-- Current streak (consecutive days with HPI >= 1.0)
streak_stats AS (
  SELECT
    user_id,
    COUNT(*) as streak
  FROM (
    SELECT
      user_id,
      prediction_date,
      hpi,
      prediction_date - LAG(prediction_date) OVER (PARTITION BY user_id ORDER BY prediction_date) as day_diff
    FROM public.user_daily_hpi
    WHERE hpi >= 1.0
    ORDER BY user_id, prediction_date DESC
  ) gaps
  WHERE day_diff IS NULL OR day_diff = 1
  GROUP BY user_id
),

-- Betting stats
bet_stats AS (
  SELECT
    cb.user_id,
    ROUND(AVG(cb.bet_amount)) as average_bet_coins,
    -- Risk index: std deviation of odds variance
    ROUND(
      LEAST(10, GREATEST(1,
        5 + (STDDEV((cb.odds->>'odds')::decimal - 1.5) * 3)
      )),
      1
    ) as risk_index
  FROM public.challenge_bets cb
  GROUP BY cb.user_id
),

-- Games played and podiums
game_stats AS (
  SELECT
    cp.user_id,
    COUNT(*) as games_played,
    SUM(CASE WHEN cp.rank = 1 THEN 1 ELSE 0 END) as gold_podiums,
    SUM(CASE WHEN cp.rank = 2 THEN 1 ELSE 0 END) as silver_podiums,
    SUM(CASE WHEN cp.rank = 3 THEN 1 ELSE 0 END) as bronze_podiums
  FROM public.challenge_participants cp
  WHERE cp.rank IS NOT NULL
  GROUP BY cp.user_id
),

-- Trophies (top 3 finishes)
trophy_stats AS (
  SELECT
    user_id,
    COUNT(*) as trophies
  FROM public.challenge_participants
  WHERE rank <= 3
  GROUP BY user_id
),

-- Badges
badge_stats AS (
  SELECT
    ub.user_id,
    COUNT(*) as badge_count,
    ARRAY_AGG(b.name ORDER BY ub.earned_at DESC) as badge_names
  FROM public.user_badges ub
  JOIN public.badges b ON b.id = ub.badge_id
  GROUP BY ub.user_id
),

-- Most played league
league_stats AS (
  SELECT DISTINCT ON (sp.user_id)
    sp.user_id,
    f.league as most_played_league
  FROM public.swipe_predictions sp
  JOIN public.fixtures f ON f.id = sp.fixture_id
  GROUP BY sp.user_id, f.league
  ORDER BY sp.user_id, COUNT(*) DESC
),

-- Most played team
team_stats AS (
  SELECT DISTINCT ON (sp.user_id)
    sp.user_id,
    CASE
      WHEN COUNT(CASE WHEN sp.prediction = f.home_team THEN 1 END) >
           COUNT(CASE WHEN sp.prediction = f.away_team THEN 1 END)
      THEN f.home_team
      ELSE f.away_team
    END as most_played_team
  FROM public.swipe_predictions sp
  JOIN public.fixtures f ON f.id = sp.fixture_id
  GROUP BY sp.user_id, f.home_team, f.away_team
  ORDER BY sp.user_id, COUNT(*) DESC
),

-- Favorite game type
game_type_stats AS (
  SELECT DISTINCT ON (cp.user_id)
    cp.user_id,
    c.type as favorite_game_type
  FROM public.challenge_participants cp
  JOIN public.challenges c ON c.id = cp.challenge_id
  GROUP BY cp.user_id, c.type
  ORDER BY cp.user_id, COUNT(*) DESC
),

-- Last 10 days accuracy (for trend visualization)
recent_accuracy AS (
  SELECT
    user_id,
    ROUND(
      SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::decimal / COUNT(*),
      2
    ) as last_10_days_accuracy
  FROM public.swipe_predictions
  WHERE created_at >= NOW() - INTERVAL '10 days'
  GROUP BY user_id
)

-- Main SELECT combining all stats
SELECT
  u.id as user_id,
  u.username,

  -- Prediction stats
  COALESCE(ps.predictions_total, 0) as predictions_total,
  COALESCE(ps.predictions_correct, 0) as predictions_correct,

  -- HPI stats
  COALESCE(hpi.hot_performance_index, 0) as hot_performance_index,
  COALESCE(hpi.best_hpi, 0) as best_hpi,
  hpi.best_hpi_date,

  -- Streak
  COALESCE(ss.streak, 0) as streak,

  -- Betting stats
  COALESCE(bs.average_bet_coins, 0) as average_bet_coins,
  COALESCE(bs.risk_index, 5.0) as risk_index,

  -- Games and podiums
  COALESCE(gs.games_played, 0) as games_played,
  COALESCE(gs.gold_podiums, 0) as gold_podiums,
  COALESCE(gs.silver_podiums, 0) as silver_podiums,
  COALESCE(gs.bronze_podiums, 0) as bronze_podiums,

  -- Trophies
  COALESCE(ts.trophies, 0) as trophies,

  -- Badges
  COALESCE(badges.badge_count, 0) as badge_count,
  COALESCE(badges.badge_names, ARRAY[]::text[]) as badge_names,

  -- Preferences
  COALESCE(ls.most_played_league, 'Unknown') as most_played_league,
  COALESCE(team.most_played_team, 'Unknown') as most_played_team,
  COALESCE(gt.favorite_game_type, 'Unknown') as favorite_game_type,

  -- Trends
  COALESCE(ra.last_10_days_accuracy, 0) as last_10_days_accuracy

FROM public.users u
LEFT JOIN prediction_stats ps ON ps.user_id = u.id
LEFT JOIN hpi_stats hpi ON hpi.user_id = u.id
LEFT JOIN streak_stats ss ON ss.user_id = u.id
LEFT JOIN bet_stats bs ON bs.user_id = u.id
LEFT JOIN game_stats gs ON gs.user_id = u.id
LEFT JOIN trophy_stats ts ON ts.user_id = u.id
LEFT JOIN badge_stats badges ON badges.user_id = u.id
LEFT JOIN league_stats ls ON ls.user_id = u.id
LEFT JOIN team_stats team ON team.user_id = u.id
LEFT JOIN game_type_stats gt ON gt.user_id = u.id
LEFT JOIN recent_accuracy ra ON ra.user_id = u.id;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_profile_stats_user_id
  ON public.users(id);

-- =============================================================================
-- FUNCTION: Get user profile stats
-- Returns all stats for a specific user
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_user_profile_stats(p_user_id UUID)
RETURNS TABLE (
  username TEXT,
  predictions_total BIGINT,
  predictions_correct BIGINT,
  hot_performance_index NUMERIC,
  best_hpi NUMERIC,
  best_hpi_date DATE,
  streak BIGINT,
  average_bet_coins NUMERIC,
  risk_index NUMERIC,
  games_played BIGINT,
  gold_podiums BIGINT,
  silver_podiums BIGINT,
  bronze_podiums BIGINT,
  trophies BIGINT,
  badge_count BIGINT,
  badge_names TEXT[],
  most_played_league TEXT,
  most_played_team TEXT,
  favorite_game_type TEXT,
  last_10_days_accuracy NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ups.username,
    ups.predictions_total,
    ups.predictions_correct,
    ups.hot_performance_index,
    ups.best_hpi,
    ups.best_hpi_date,
    ups.streak,
    ups.average_bet_coins,
    ups.risk_index,
    ups.games_played,
    ups.gold_podiums,
    ups.silver_podiums,
    ups.bronze_podiums,
    ups.trophies,
    ups.badge_count,
    ups.badge_names,
    ups.most_played_league,
    ups.most_played_team,
    ups.favorite_game_type,
    ups.last_10_days_accuracy
  FROM public.user_profile_stats ups
  WHERE ups.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON public.user_daily_hpi TO authenticated;
GRANT SELECT ON public.user_profile_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_profile_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_user_daily_hpi() TO service_role;

-- Initial refresh of materialized view
SELECT public.refresh_user_daily_hpi();

-- Verification
SELECT 'Profile stats views created successfully!' as status;
