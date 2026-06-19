-- ============================================================================
-- SEED INITIAL GAME CONFIGURATIONS
-- ============================================================================
-- Migrates all hardcoded constants from TypeScript to database
-- 15 core configurations across 5 categories
-- Date: 2025-11-17

-- ============================================================================
-- CATEGORY: rewards
-- ============================================================================

-- 1. Daily Streak Rewards
INSERT INTO public.game_config (id, category, key, value, description, version)
VALUES (
  'daily_streak_rewards',
  'rewards',
  'daily_streak_rewards',
  '{
    "1": {"coins": 100},
    "2": {"coins": 200},
    "3": {"coins": 300},
    "4": {"coins": 500},
    "5": {"coins": 500},
    "6": {"coins": 500},
    "7": {"ticket": "amateur"}
  }'::jsonb,
  'Rewards for consecutive daily logins (1-7 days)',
  1
) ON CONFLICT (category, key) DO NOTHING;

-- 2. Starting Coins
INSERT INTO public.game_config (id, category, key, value, description, version)
VALUES (
  'starting_coins',
  'rewards',
  'starting_coins',
  '{"amount": 1000}'::jsonb,
  'Initial coins for new users',
  1
) ON CONFLICT (category, key) DO NOTHING;

-- ============================================================================
-- CATEGORY: progression
-- ============================================================================

-- 3. Level Bet Limits
INSERT INTO public.game_config (id, category, key, value, description, version)
VALUES (
  'level_bet_limits',
  'progression',
  'level_bet_limits',
  '{
    "Rookie": 500,
    "Rising Star": 1000,
    "Pro": 2000,
    "Elite": 5000,
    "Legend": 15000,
    "Master": 40000,
    "GOAT": null
  }'::jsonb,
  'Maximum bet amount per level (null = no limit for GOAT)',
  1
) ON CONFLICT (category, key) DO NOTHING;

-- 4. Level XP Thresholds
INSERT INTO public.game_config (id, category, key, value, description, version)
VALUES (
  'level_xp_thresholds',
  'progression',
  'level_xp_thresholds',
  '{
    "Amateur": 0,
    "Rising Star": 5000,
    "Pro": 15000,
    "Elite": 35000,
    "Legend": 70000,
    "GOAT": 120000
  }'::jsonb,
  'XP required to reach each level',
  1
) ON CONFLICT (category, key) DO NOTHING;

-- ============================================================================
-- CATEGORY: tournament
-- ============================================================================

-- 5. Tournament Base Costs
INSERT INTO public.game_config (id, category, key, value, description, version)
VALUES (
  'tournament_base_costs',
  'tournament',
  'tournament_base_costs',
  '{
    "amateur": 2000,
    "master": 10000,
    "apex": 20000
  }'::jsonb,
  'Base entry cost in coins for each tournament tier',
  1
) ON CONFLICT (category, key) DO NOTHING;

-- 6. Tournament Multipliers
INSERT INTO public.game_config (id, category, key, value, description, version)
VALUES (
  'tournament_multipliers',
  'tournament',
  'tournament_multipliers',
  '{
    "flash": 1,
    "series": 2,
    "season": 4
  }'::jsonb,
  'Cost multipliers based on tournament duration',
  1
) ON CONFLICT (category, key) DO NOTHING;

-- 7. Ticket Expiry Days
INSERT INTO public.game_config (id, category, key, value, description, version)
VALUES (
  'ticket_expiry_days',
  'tournament',
  'ticket_expiry_days',
  '{
    "amateur": 30,
    "master": 45,
    "apex": 60
  }'::jsonb,
  'Days until tournament tickets expire per tier',
  1
) ON CONFLICT (category, key) DO NOTHING;

-- 8. Ticket Max Quantity
INSERT INTO public.game_config (id, category, key, value, description, version)
VALUES (
  'ticket_max_quantity',
  'tournament',
  'ticket_max_quantity',
  '{
    "amateur": 5,
    "master": 3,
    "apex": 2
  }'::jsonb,
  'Maximum number of tickets a user can hold per tier',
  1
) ON CONFLICT (category, key) DO NOTHING;

-- ============================================================================
-- CATEGORY: pgs_formula (Points Game Score / XP Calculation)
-- ============================================================================

-- 9. PGS Coefficients
INSERT INTO public.game_config (id, category, key, value, description, version)
VALUES (
  'pgs_coefficients',
  'pgs_formula',
  'pgs_coefficients',
  '{
    "activity": 50,
    "accuracy": 120,
    "fantasy": 0.5,
    "risk": 100,
    "badges": 150,
    "variety": 40
  }'::jsonb,
  'XP formula coefficients: A (days_active × 50), P (accuracy% × 120), F (avg_fantasy_score × 0.5), R ((avg_win_odds-1) × 100), B (badges × 150), G (game_types × 40)',
  1
) ON CONFLICT (category, key) DO NOTHING;

-- 10. PGS Diminishing Factor
INSERT INTO public.game_config (id, category, key, value, description, version)
VALUES (
  'pgs_diminishing_factor',
  'pgs_formula',
  'pgs_diminishing_factor',
  '{
    "base": 1,
    "increment": 0.05
  }'::jsonb,
  'Diminishing factor formula: 1 / (1 + increment × (current_level - 1))',
  1
) ON CONFLICT (category, key) DO NOTHING;

-- 11. PGS GOAT Bonus
INSERT INTO public.game_config (id, category, key, value, description, version)
VALUES (
  'pgs_goat_bonus',
  'pgs_formula',
  'pgs_goat_bonus',
  '{"multiplier": 1.05}'::jsonb,
  'XP multiplier for GOAT users (5% bonus)',
  1
) ON CONFLICT (category, key) DO NOTHING;

-- 12. PGS Inactivity Decay
INSERT INTO public.game_config (id, category, key, value, description, version)
VALUES (
  'pgs_inactivity_decay',
  'pgs_formula',
  'pgs_inactivity_decay',
  '{
    "max_penalty": 0.3,
    "days_threshold": 14,
    "applies_to_goat": false
  }'::jsonb,
  'XP decay for inactive users: up to 30% reduction after 14 days (GOAT exempt)',
  1
) ON CONFLICT (category, key) DO NOTHING;

-- ============================================================================
-- CATEGORY: badges
-- ============================================================================

-- 13. Default Badge XP
INSERT INTO public.game_config (id, category, key, value, description, version)
VALUES (
  'default_badge_xp',
  'badges',
  'default_badge_xp',
  '{"bonus": 150}'::jsonb,
  'Default XP bonus awarded when earning a badge',
  1
) ON CONFLICT (category, key) DO NOTHING;

-- 14. Badge Condition Types
INSERT INTO public.game_config (id, category, key, value, description, version)
VALUES (
  'badge_condition_types',
  'badges',
  'badge_condition_types',
  '["win_streak", "total_wins", "accuracy_threshold", "coins_earned", "games_played", "custom_query"]'::jsonb,
  'Available condition types for badge requirements',
  1
) ON CONFLICT (category, key) DO NOTHING;

-- ============================================================================
-- CATEGORY: system
-- ============================================================================

-- 15. Config Cache Version
INSERT INTO public.game_config (id, category, key, value, description, version)
VALUES (
  'config_cache_version',
  'system',
  'config_cache_version',
  '{"version": 1}'::jsonb,
  'Global cache version - increment this to invalidate all frontend caches',
  1
) ON CONFLICT (category, key) DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERY (run separately to verify)
-- ============================================================================
-- SELECT
--   id,
--   category,
--   key,
--   LEFT(value::text, 50) as value_preview,
--   description,
--   version,
--   is_active
-- FROM game_config
-- ORDER BY category, key;

-- Count by category:
-- SELECT category, COUNT(*) as config_count
-- FROM game_config
-- GROUP BY category
-- ORDER BY category;
