/**
 * Live Game Config Service (Admin)
 *
 * Handles administration of Live Betting Game configuration:
 * - Level limits (entry max, slots max)
 * - Free mode rewards
 */

import { supabase } from './supabase';

// =============================================
// TYPES
// =============================================

export interface LevelConfig {
  id: string;
  levelName: string;
  levelOrder: number;
  minXp: number;
  maxXp: number | null;
  entryMax: number | null;
  slotsMax: number | null;
  isActive: boolean;
  updatedAt?: string;
}

export interface FreeRewardConfig {
  id: string;
  minPlayers: number;
  maxPlayers: number | null;
  topX: number;
  isActive: boolean;
  tiers: RewardTier[];
}

export interface RewardTier {
  id?: string;
  freeRewardId?: string;
  rank: number;
  rewardType: 'coins' | 'xp' | 'ticket' | 'spin';
  rewardAmount: number;
  rewardTier?: 'amateur' | 'master' | 'apex' | null;
}

// =============================================
// LEVEL CONFIG
// =============================================

/**
 * Get all level configurations
 */
export async function getLevelConfigs(): Promise<LevelConfig[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('live_game_level_config')
    .select('*')
    .order('level_order', { ascending: true });

  if (error) {
    console.error('[liveGameConfigService] Error fetching level configs:', error);
    return [];
  }

  return data.map(mapLevelConfigFromDb);
}

/**
 * Update a level configuration
 */
export async function updateLevelConfig(
  id: string,
  updates: Partial<Omit<LevelConfig, 'id' | 'levelName' | 'levelOrder'>>
): Promise<boolean> {
  if (!supabase) return false;

  const dbUpdates: any = {};
  if (updates.minXp !== undefined) dbUpdates.min_xp = updates.minXp;
  if (updates.maxXp !== undefined) dbUpdates.max_xp = updates.maxXp;
  if (updates.entryMax !== undefined) dbUpdates.entry_max = updates.entryMax;
  if (updates.slotsMax !== undefined) dbUpdates.slots_max = updates.slotsMax;
  if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;

  const { error } = await supabase
    .from('live_game_level_config')
    .update(dbUpdates)
    .eq('id', id);

  if (error) {
    console.error('[liveGameConfigService] Error updating level config:', error);
    return false;
  }

  return true;
}

/**
 * Reset level configs to defaults
 */
export async function resetLevelConfigsToDefaults(): Promise<boolean> {
  if (!supabase) return false;

  const defaults = [
    { level_name: 'rookie', min_xp: 0, max_xp: 99, entry_max: 500, slots_max: 2 },
    { level_name: 'rising_star', min_xp: 100, max_xp: 499, entry_max: 1000, slots_max: 3 },
    { level_name: 'pro', min_xp: 500, max_xp: 1499, entry_max: 2000, slots_max: 4 },
    { level_name: 'elite', min_xp: 1500, max_xp: 3999, entry_max: 5000, slots_max: 5 },
    { level_name: 'legend', min_xp: 4000, max_xp: 9999, entry_max: 10000, slots_max: 6 },
    { level_name: 'master', min_xp: 10000, max_xp: 24999, entry_max: 25000, slots_max: 8 },
    { level_name: 'goat', min_xp: 25000, max_xp: null, entry_max: null, slots_max: null },
  ];

  for (const config of defaults) {
    const { error } = await supabase
      .from('live_game_level_config')
      .update({
        min_xp: config.min_xp,
        max_xp: config.max_xp,
        entry_max: config.entry_max,
        slots_max: config.slots_max,
        is_active: true,
      })
      .eq('level_name', config.level_name);

    if (error) {
      console.error('[liveGameConfigService] Error resetting level config:', error);
      return false;
    }
  }

  return true;
}

// =============================================
// FREE REWARDS CONFIG
// =============================================

/**
 * Get all free reward configurations with their tiers
 */
export async function getFreeRewardConfigs(): Promise<FreeRewardConfig[]> {
  if (!supabase) return [];

  const { data: rewards, error: rewardsError } = await supabase
    .from('live_game_free_rewards')
    .select('*')
    .order('min_players', { ascending: true });

  if (rewardsError) {
    console.error('[liveGameConfigService] Error fetching reward configs:', rewardsError);
    return [];
  }

  const { data: tiers, error: tiersError } = await supabase
    .from('live_game_reward_tiers')
    .select('*')
    .order('rank', { ascending: true });

  if (tiersError) {
    console.error('[liveGameConfigService] Error fetching reward tiers:', tiersError);
  }

  return rewards.map((reward: any) => ({
    id: reward.id,
    minPlayers: reward.min_players,
    maxPlayers: reward.max_players,
    topX: reward.top_x,
    isActive: reward.is_active,
    tiers: (tiers || [])
      .filter((tier: any) => tier.free_reward_id === reward.id)
      .map(mapRewardTierFromDb),
  }));
}

/**
 * Update a free reward configuration
 */
export async function updateFreeRewardConfig(
  id: string,
  updates: Partial<Omit<FreeRewardConfig, 'id' | 'tiers'>>
): Promise<boolean> {
  if (!supabase) return false;

  const dbUpdates: any = {};
  if (updates.minPlayers !== undefined) dbUpdates.min_players = updates.minPlayers;
  if (updates.maxPlayers !== undefined) dbUpdates.max_players = updates.maxPlayers;
  if (updates.topX !== undefined) dbUpdates.top_x = updates.topX;
  if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;

  const { error } = await supabase
    .from('live_game_free_rewards')
    .update(dbUpdates)
    .eq('id', id);

  if (error) {
    console.error('[liveGameConfigService] Error updating reward config:', error);
    return false;
  }

  return true;
}

/**
 * Create a new free reward tier
 */
export async function createFreeRewardConfig(config: {
  minPlayers: number;
  maxPlayers: number | null;
  topX: number;
}): Promise<FreeRewardConfig | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('live_game_free_rewards')
    .insert({
      min_players: config.minPlayers,
      max_players: config.maxPlayers,
      top_x: config.topX,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('[liveGameConfigService] Error creating reward config:', error);
    return null;
  }

  return {
    id: data.id,
    minPlayers: data.min_players,
    maxPlayers: data.max_players,
    topX: data.top_x,
    isActive: data.is_active,
    tiers: [],
  };
}

/**
 * Delete a free reward configuration
 */
export async function deleteFreeRewardConfig(id: string): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase
    .from('live_game_free_rewards')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[liveGameConfigService] Error deleting reward config:', error);
    return false;
  }

  return true;
}

// =============================================
// REWARD TIERS
// =============================================

/**
 * Add a reward tier to a free reward config
 */
export async function addRewardTier(
  freeRewardId: string,
  tier: Omit<RewardTier, 'id' | 'freeRewardId'>
): Promise<RewardTier | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('live_game_reward_tiers')
    .insert({
      free_reward_id: freeRewardId,
      rank: tier.rank,
      reward_type: tier.rewardType,
      reward_amount: tier.rewardAmount,
      reward_tier: tier.rewardTier || null,
    })
    .select()
    .single();

  if (error) {
    console.error('[liveGameConfigService] Error adding reward tier:', error);
    return null;
  }

  return mapRewardTierFromDb(data);
}

/**
 * Update a reward tier
 */
export async function updateRewardTier(
  id: string,
  updates: Partial<Omit<RewardTier, 'id' | 'freeRewardId'>>
): Promise<boolean> {
  if (!supabase) return false;

  const dbUpdates: any = {};
  if (updates.rank !== undefined) dbUpdates.rank = updates.rank;
  if (updates.rewardType !== undefined) dbUpdates.reward_type = updates.rewardType;
  if (updates.rewardAmount !== undefined) dbUpdates.reward_amount = updates.rewardAmount;
  if (updates.rewardTier !== undefined) dbUpdates.reward_tier = updates.rewardTier;

  const { error } = await supabase
    .from('live_game_reward_tiers')
    .update(dbUpdates)
    .eq('id', id);

  if (error) {
    console.error('[liveGameConfigService] Error updating reward tier:', error);
    return false;
  }

  return true;
}

/**
 * Delete a reward tier
 */
export async function deleteRewardTier(id: string): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase
    .from('live_game_reward_tiers')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[liveGameConfigService] Error deleting reward tier:', error);
    return false;
  }

  return true;
}

// =============================================
// HELPERS
// =============================================

function mapLevelConfigFromDb(data: any): LevelConfig {
  return {
    id: data.id,
    levelName: data.level_name,
    levelOrder: data.level_order,
    minXp: data.min_xp,
    maxXp: data.max_xp,
    entryMax: data.entry_max,
    slotsMax: data.slots_max,
    isActive: data.is_active,
    updatedAt: data.updated_at,
  };
}

function mapRewardTierFromDb(data: any): RewardTier {
  return {
    id: data.id,
    freeRewardId: data.free_reward_id,
    rank: data.rank,
    rewardType: data.reward_type,
    rewardAmount: data.reward_amount,
    rewardTier: data.reward_tier,
  };
}

// Export all functions
export const liveGameConfigService = {
  // Level Config
  getLevelConfigs,
  updateLevelConfig,
  resetLevelConfigsToDefaults,

  // Free Rewards
  getFreeRewardConfigs,
  updateFreeRewardConfig,
  createFreeRewardConfig,
  deleteFreeRewardConfig,

  // Reward Tiers
  addRewardTier,
  updateRewardTier,
  deleteRewardTier,
};

export default liveGameConfigService;
