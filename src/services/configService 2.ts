/**
 * Game Configuration Service
 *
 * Manages runtime configuration with caching and fallback to constants.ts
 * Cache is invalidated when admin publishes changes (version increment)
 */

import { supabase } from './supabase'
import type {
  GameConfig,
  ConfigCategory,
  ConfigKey,
  ConfigMap,
  ConfigUpdate,
} from '../types/config'

// Fallback imports from constants.ts
import {
  DAILY_STREAK_REWARDS,
  LEVEL_BET_LIMITS,
  TICKET_RULES,
  TOURNAMENT_COSTS,
} from '../config/constants'

// ============================================================================
// Cache Management
// ============================================================================

type CacheEntry<T> = {
  value: T
  version: number
  timestamp: number
}

const configCache = new Map<string, CacheEntry<any>>()
let currentCacheVersion = 0

/**
 * Clear all cached configs
 */
export function clearConfigCache(): void {
  configCache.clear()
  currentCacheVersion = 0
  console.log('[configService] Cache cleared')
}

/**
 * Check if cache needs invalidation based on version
 */
async function checkCacheVersion(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('game_config')
      .select('value')
      .eq('id', 'config_cache_version')
      .single()

    if (error || !data) {
      console.warn('[configService] Failed to fetch cache version, using current:', currentCacheVersion)
      return currentCacheVersion
    }

    const serverVersion = data.value?.version ?? 1

    // If server version is newer, invalidate cache
    if (serverVersion > currentCacheVersion) {
      console.log(`[configService] Cache version mismatch (local: ${currentCacheVersion}, server: ${serverVersion}) - invalidating cache`)
      clearConfigCache()
      currentCacheVersion = serverVersion
    }

    return serverVersion
  } catch (error) {
    console.error('[configService] Error checking cache version:', error)
    return currentCacheVersion
  }
}

// ============================================================================
// Config Retrieval
// ============================================================================

/**
 * Get a configuration value by key
 * Returns cached value if available, otherwise fetches from DB
 * Falls back to constants.ts if DB unavailable
 *
 * @param key - Configuration key
 * @returns Configuration value
 */
export async function getConfig<K extends ConfigKey>(
  key: K
): Promise<ConfigMap[K]> {
  // Check cache version first
  await checkCacheVersion()

  // Check cache
  const cached = configCache.get(key)
  if (cached && cached.version === currentCacheVersion) {
    return cached.value as ConfigMap[K]
  }

  // Fetch from database
  try {
    const { data, error } = await supabase
      .from('game_config')
      .select('value, version')
      .eq('id', key)
      .eq('is_active', true)
      .single()

    if (error) {
      console.warn(`[configService] Failed to fetch config "${key}":`, error)
      return getFallbackConfig(key)
    }

    if (!data) {
      console.warn(`[configService] Config "${key}" not found in database, using fallback`)
      return getFallbackConfig(key)
    }

    // Cache the result
    configCache.set(key, {
      value: data.value,
      version: data.version,
      timestamp: Date.now(),
    })

    return data.value as ConfigMap[K]
  } catch (error) {
    console.error(`[configService] Error fetching config "${key}":`, error)
    return getFallbackConfig(key)
  }
}

/**
 * Get configuration by category and key
 *
 * @param category - Config category
 * @param key - Config key within category
 * @returns Configuration value
 */
export async function getConfigByCategory(
  category: ConfigCategory,
  key: string
): Promise<any> {
  // Check cache version
  await checkCacheVersion()

  const cacheKey = `${category}:${key}`
  const cached = configCache.get(cacheKey)
  if (cached && cached.version === currentCacheVersion) {
    return cached.value
  }

  try {
    const { data, error } = await supabase
      .from('game_config')
      .select('value, version')
      .eq('category', category)
      .eq('key', key)
      .eq('is_active', true)
      .single()

    if (error || !data) {
      console.warn(`[configService] Config not found: ${category}/${key}`)
      return null
    }

    configCache.set(cacheKey, {
      value: data.value,
      version: data.version,
      timestamp: Date.now(),
    })

    return data.value
  } catch (error) {
    console.error(`[configService] Error fetching config: ${category}/${key}`, error)
    return null
  }
}

/**
 * Get all configurations (for admin panel)
 *
 * @returns Array of all game configs
 */
export async function getAllConfigs(): Promise<GameConfig[]> {
  try {
    const { data, error } = await supabase
      .from('game_config')
      .select('*')
      .order('category', { ascending: true })
      .order('key', { ascending: true })

    if (error) {
      throw error
    }

    return data || []
  } catch (error) {
    console.error('[configService] Error fetching all configs:', error)
    throw error
  }
}

/**
 * Get all configurations in a specific category
 *
 * @param category - Config category
 * @returns Array of configs in category
 */
export async function getConfigsByCategory(
  category: ConfigCategory
): Promise<GameConfig[]> {
  try {
    const { data, error } = await supabase
      .from('game_config')
      .select('*')
      .eq('category', category)
      .order('key', { ascending: true })

    if (error) {
      throw error
    }

    return data || []
  } catch (error) {
    console.error(`[configService] Error fetching configs for category "${category}":`, error)
    throw error
  }
}

// ============================================================================
// Config Updates (Admin Only)
// ============================================================================

/**
 * Update a configuration value (does NOT increment version)
 * Save as draft - changes visible in admin panel but not published
 *
 * @param id - Config ID
 * @param value - New value (JSONB)
 * @param adminId - Admin user ID
 */
export async function updateConfig(
  id: string,
  value: any,
  adminId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('game_config')
      .update({
        value,
        updated_by: adminId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      throw error
    }

    console.log(`[configService] Config "${id}" updated (draft)`)
  } catch (error) {
    console.error(`[configService] Error updating config "${id}":`, error)
    throw error
  }
}

/**
 * Publish all config changes (increments global version)
 * This invalidates all frontend caches
 *
 * @param adminId - Admin user ID
 */
export async function publishConfigs(adminId: string): Promise<void> {
  try {
    // Get current cache version
    const { data: versionData, error: versionError } = await supabase
      .from('game_config')
      .select('value')
      .eq('id', 'config_cache_version')
      .single()

    if (versionError) {
      throw versionError
    }

    const currentVersion = versionData?.value?.version ?? 1
    const newVersion = currentVersion + 1

    // Update cache version config
    const { error: updateError } = await supabase
      .from('game_config')
      .update({
        value: { version: newVersion },
        updated_by: adminId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 'config_cache_version')

    if (updateError) {
      throw updateError
    }

    // Update version on ALL configs
    const { error: bulkUpdateError } = await supabase
      .from('game_config')
      .update({ version: newVersion })
      .neq('id', 'config_cache_version') // Don't update the version config itself again

    if (bulkUpdateError) {
      throw bulkUpdateError
    }

    // Clear local cache
    clearConfigCache()
    currentCacheVersion = newVersion

    console.log(`[configService] Configs published! New version: ${newVersion}`)
  } catch (error) {
    console.error('[configService] Error publishing configs:', error)
    throw error
  }
}

/**
 * Toggle config active status
 *
 * @param id - Config ID
 * @param isActive - New active status
 */
export async function toggleConfigActive(
  id: string,
  isActive: boolean
): Promise<void> {
  try {
    const { error } = await supabase
      .from('game_config')
      .update({ is_active: isActive })
      .eq('id', id)

    if (error) {
      throw error
    }

    // Remove from cache if deactivated
    if (!isActive) {
      configCache.delete(id)
    }

    console.log(`[configService] Config "${id}" ${isActive ? 'activated' : 'deactivated'}`)
  } catch (error) {
    console.error(`[configService] Error toggling config "${id}":`, error)
    throw error
  }
}

// ============================================================================
// Fallback to constants.ts
// ============================================================================

/**
 * Get fallback configuration from constants.ts
 * Used when database is unavailable
 *
 * @param key - Configuration key
 * @returns Fallback configuration value
 */
function getFallbackConfig<K extends ConfigKey>(key: K): ConfigMap[K] {
  console.warn(`[configService] Using fallback for "${key}"`)

  // Map database config keys to constants.ts values
  const fallbacks: Partial<Record<ConfigKey, any>> = {
    daily_streak_rewards: DAILY_STREAK_REWARDS,
    starting_coins: { amount: 1000 },
    level_bet_limits: LEVEL_BET_LIMITS,
    level_xp_thresholds: {
      Amateur: 0,
      'Rising Star': 5000,
      Pro: 15000,
      Elite: 35000,
      Legend: 70000,
      GOAT: 120000,
    },
    tournament_base_costs: {
      amateur: TOURNAMENT_COSTS.amateur.base,
      master: TOURNAMENT_COSTS.master.base,
      apex: TOURNAMENT_COSTS.apex.base,
    },
    tournament_multipliers: {
      flash: TOURNAMENT_COSTS.amateur.multipliers.flash,
      series: TOURNAMENT_COSTS.amateur.multipliers.series,
      season: TOURNAMENT_COSTS.amateur.multipliers.season,
    },
    ticket_expiry_days: {
      amateur: TICKET_RULES.amateur.expiry_days,
      master: TICKET_RULES.master.expiry_days,
      apex: TICKET_RULES.apex.expiry_days,
    },
    ticket_max_quantity: {
      amateur: TICKET_RULES.amateur.max_quantity,
      master: TICKET_RULES.master.max_quantity,
      apex: TICKET_RULES.apex.max_quantity,
    },
    pgs_coefficients: {
      activity: 50,
      accuracy: 120,
      fantasy: 0.5,
      risk: 100,
      badges: 150,
      variety: 40,
    },
    pgs_diminishing_factor: {
      base: 1,
      increment: 0.05,
    },
    pgs_goat_bonus: {
      multiplier: 1.05,
    },
    pgs_inactivity_decay: {
      max_penalty: 0.3,
      days_threshold: 14,
      applies_to_goat: false,
    },
    default_badge_xp: {
      bonus: 150,
    },
    badge_condition_types: [
      'win_streak',
      'total_wins',
      'accuracy_threshold',
      'coins_earned',
      'games_played',
      'custom_query',
    ],
    config_cache_version: {
      version: 1,
    },
  }

  return fallbacks[key] as ConfigMap[K]
}

// ============================================================================
// Exports
// ============================================================================

export const configService = {
  getConfig,
  getConfigByCategory,
  getAllConfigs,
  getConfigsByCategory,
  updateConfig,
  publishConfigs,
  toggleConfigActive,
  clearCache: clearConfigCache,
}
