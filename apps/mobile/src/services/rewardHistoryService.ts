/**
 * Reward History Service
 *
 * Handles fetching and displaying user's complete reward history
 * from all sources (challenges, seasonal, manual fulfillments).
 */

import { supabase } from './supabase';
import { RewardType, RewardStatus, RewardItem } from '../types';

export interface RewardHistoryItem {
  id: string;
  reward_type: RewardType;
  reward_value: RewardItem | Record<string, any>;
  reward_tier?: string;
  source_type: string;
  source_id?: string;
  source_name: string;
  status: RewardStatus;
  earned_at: string;
  fulfilled_at?: string;
  fulfillment_details?: Record<string, any>;
}

export interface RewardStats {
  total_rewards: number;
  total_coins: number;
  total_xp: number;
  total_tickets: number;
  total_spins: number;
  total_giftcards: number;
  total_custom: number;
  pending_fulfillments: number;
}

export interface RewardHistoryFilters {
  reward_type?: string;
  status?: string;
}

/**
 * Get user's reward history with optional filtering
 */
export async function getUserRewardHistory(
  userId: string,
  limit: number = 50,
  offset: number = 0,
  filters?: RewardHistoryFilters
): Promise<{ success: boolean; rewards: RewardHistoryItem[]; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('get_user_reward_history', {
      p_user_id: userId,
      p_limit: limit,
      p_offset: offset,
      p_reward_type: filters?.reward_type || null,
      p_status: filters?.status || null,
    });

    if (error) {
      console.error('[rewardHistoryService] Error fetching reward history:', error);
      return {
        success: false,
        rewards: [],
        error: error.message,
      };
    }

    return {
      success: true,
      rewards: data || [],
    };
  } catch (err) {
    console.error('[rewardHistoryService] Unexpected error:', err);
    return {
      success: false,
      rewards: [],
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Get aggregated statistics about user's rewards
 */
export async function getUserRewardStats(
  userId: string
): Promise<{ success: boolean; stats?: RewardStats; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('get_user_reward_stats', {
      p_user_id: userId,
    });

    if (error) {
      console.error('[rewardHistoryService] Error fetching reward stats:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      stats: data as RewardStats,
    };
  } catch (err) {
    console.error('[rewardHistoryService] Unexpected error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Format reward value for display
 */
export function formatRewardValue(reward: RewardHistoryItem): string {
  switch (reward.reward_type) {
    case 'coins':
    case 'xp':
      return `${reward.reward_value.value || reward.reward_value} ${reward.reward_type}`;
    case 'ticket':
    case 'spin':
      return `${reward.reward_tier || 'Standard'} ${reward.reward_type}`;
    case 'premium_3d':
      return '3 Days Premium';
    case 'premium_7d':
      return '7 Days Premium';
    case 'giftcard':
      return `Gift Card (${reward.reward_value.value || 'N/A'})`;
    case 'masterpass':
      return 'MasterPass';
    case 'custom':
      return reward.reward_value.name || 'Custom Reward';
    default:
      return reward.reward_type;
  }
}

/**
 * Get reward type icon/color
 */
export function getRewardTypeStyle(rewardType: string): { icon: string; color: string } {
  switch (rewardType) {
    case 'coins':
      return { icon: '💰', color: 'text-warm-yellow bg-warm-yellow/20' };
    case 'xp':
      return { icon: '⚡', color: 'text-electric-blue bg-electric-blue/20' };
    case 'ticket':
      return { icon: '🎫', color: 'text-lime-glow bg-lime-glow/20' };
    case 'spin':
      return { icon: '🎡', color: 'text-neon-cyan bg-neon-cyan/20' };
    case 'premium_3d':
    case 'premium_7d':
      return { icon: '👑', color: 'text-warm-yellow bg-warm-yellow/20' };
    case 'giftcard':
      return { icon: '🎁', color: 'text-hot-red bg-hot-red/20' };
    case 'masterpass':
      return { icon: '🔑', color: 'text-purple-400 bg-purple-400/20' };
    case 'custom':
      return { icon: '✨', color: 'text-text-primary bg-navy-accent' };
    default:
      return { icon: '🎉', color: 'text-text-secondary bg-disabled' };
  }
}

/**
 * Get status badge style
 */
export function getStatusStyle(status: string): { color: string; label: string } {
  switch (status) {
    case 'fulfilled':
      return { color: 'text-lime-glow bg-lime-glow/20', label: 'Fulfilled' };
    case 'pending':
      return { color: 'text-warm-yellow bg-warm-yellow/20', label: 'Pending' };
    case 'processing':
      return { color: 'text-electric-blue bg-electric-blue/20', label: 'Processing' };
    case 'failed':
      return { color: 'text-hot-red bg-hot-red/20', label: 'Failed' };
    case 'cancelled':
      return { color: 'text-text-disabled bg-disabled', label: 'Cancelled' };
    default:
      return { color: 'text-text-secondary bg-navy-accent', label: status };
  }
}
