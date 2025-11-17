/**
 * Game Configuration Types
 *
 * Type definitions for all game configurations stored in the database
 */

import type { TournamentType } from './index'

// ============================================================================
// Database Schema Types
// ============================================================================

export type ConfigCategory =
  | 'rewards'
  | 'progression'
  | 'tournament'
  | 'pgs_formula'
  | 'badges'
  | 'system'

export type GameConfig = {
  id: string
  category: ConfigCategory
  key: string
  value: any // JSONB - specific type depends on config
  description: string | null
  is_active: boolean
  version: number
  updated_at: string
  updated_by: string | null
}

// ============================================================================
// Rewards Configuration Types
// ============================================================================

export type DailyStreakReward = {
  coins?: number
  ticket?: TournamentType
}

export type DailyStreakRewardsConfig = Record<number, DailyStreakReward>

export type StartingCoinsConfig = {
  amount: number
}

// ============================================================================
// Progression Configuration Types
// ============================================================================

export type LevelBetLimitsConfig = Record<string, number | null>

export type LevelXPThresholdsConfig = Record<string, number>

// ============================================================================
// Tournament Configuration Types
// ============================================================================

export type TournamentBaseCostsConfig = Record<TournamentType, number>

export type TournamentMultipliersConfig = {
  flash: number
  series: number
  season: number
}

export type TicketExpiryDaysConfig = Record<TournamentType, number>

export type TicketMaxQuantityConfig = Record<TournamentType, number>

// ============================================================================
// PGS Formula Configuration Types
// ============================================================================

export type PGSCoefficientsConfig = {
  activity: number    // days_active × coefficient
  accuracy: number    // accuracy% × coefficient
  fantasy: number     // avg_fantasy_score × coefficient
  risk: number        // (avg_win_odds - 1) × coefficient
  badges: number      // badges_earned × coefficient
  variety: number     // game_types_played × coefficient
}

export type PGSDiminishingFactorConfig = {
  base: number
  increment: number
  // Formula: base / (base + increment × (current_level - 1))
}

export type PGSGoatBonusConfig = {
  multiplier: number  // e.g., 1.05 = 5% bonus
}

export type PGSInactivityDecayConfig = {
  max_penalty: number       // e.g., 0.3 = 30% max reduction
  days_threshold: number    // Days of inactivity before decay starts
  applies_to_goat: boolean  // Whether GOAT users are affected
}

// ============================================================================
// Badges Configuration Types
// ============================================================================

export type DefaultBadgeXPConfig = {
  bonus: number
}

export type BadgeConditionType =
  | 'win_streak'
  | 'total_wins'
  | 'accuracy_threshold'
  | 'coins_earned'
  | 'games_played'
  | 'custom_query'

export type BadgeConditionTypesConfig = BadgeConditionType[]

// ============================================================================
// System Configuration Types
// ============================================================================

export type ConfigCacheVersionConfig = {
  version: number
}

// ============================================================================
// Complete Config Map (for type-safe access)
// ============================================================================

export type ConfigMap = {
  // Rewards
  daily_streak_rewards: DailyStreakRewardsConfig
  starting_coins: StartingCoinsConfig

  // Progression
  level_bet_limits: LevelBetLimitsConfig
  level_xp_thresholds: LevelXPThresholdsConfig

  // Tournament
  tournament_base_costs: TournamentBaseCostsConfig
  tournament_multipliers: TournamentMultipliersConfig
  ticket_expiry_days: TicketExpiryDaysConfig
  ticket_max_quantity: TicketMaxQuantityConfig

  // PGS Formula
  pgs_coefficients: PGSCoefficientsConfig
  pgs_diminishing_factor: PGSDiminishingFactorConfig
  pgs_goat_bonus: PGSGoatBonusConfig
  pgs_inactivity_decay: PGSInactivityDecayConfig

  // Badges
  default_badge_xp: DefaultBadgeXPConfig
  badge_condition_types: BadgeConditionTypesConfig

  // System
  config_cache_version: ConfigCacheVersionConfig
}

export type ConfigKey = keyof ConfigMap

// ============================================================================
// Config Update Types (for admin panel)
// ============================================================================

export type ConfigUpdate = {
  id: string
  value: any
  updated_by: string
}

export type ConfigPublish = {
  updated_by: string
  new_version: number
}
