/**
 * Reward Fulfillment Service
 *
 * Handles manual fulfillment of rewards that require human intervention
 * (gift cards, masterpass, custom rewards).
 */

import { supabase } from './supabase';
import { RewardItem, RewardType, RewardStatus, FulfillmentMethod } from '../types';

export interface RewardFulfillment {
  id: string;
  user_id: string;
  username: string;
  email: string;
  reward_type: RewardType;
  reward_value: RewardItem;
  status: RewardStatus;
  source_type: string;
  source_id?: string;
  fulfillment_method?: FulfillmentMethod;
  fulfillment_details?: Record<string, any>;
  admin_notes?: string;
  processed_by?: string;
  created_at: string;
  updated_at: string;
  fulfilled_at?: string;
  days_pending: number;
}

export interface FulfillRewardParams {
  fulfillmentId: string;
  fulfillmentMethod: FulfillmentMethod;
  fulfillmentDetails: Record<string, any>; // codes, links, etc.
  adminNotes?: string;
  processedBy?: string;
}

/**
 * Get all pending fulfillments (admin only)
 */
export async function getPendingFulfillments(
  limit: number = 50,
  offset: number = 0
): Promise<{ success: boolean; fulfillments: RewardFulfillment[]; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('get_pending_fulfillments', {
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      console.error('[rewardFulfillmentService] Error fetching pending fulfillments:', error);
      return {
        success: false,
        fulfillments: [],
        error: error.message,
      };
    }

    return {
      success: true,
      fulfillments: data || [],
    };
  } catch (err) {
    console.error('[rewardFulfillmentService] Unexpected error:', err);
    return {
      success: false,
      fulfillments: [],
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Get fulfillments for a specific user
 */
export async function getUserFulfillments(
  userId: string
): Promise<{ success: boolean; fulfillments: RewardFulfillment[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('reward_fulfillments')
      .select(`
        *,
        users!inner(username, email)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[rewardFulfillmentService] Error fetching user fulfillments:', error);
      return {
        success: false,
        fulfillments: [],
        error: error.message,
      };
    }

    // Transform data
    const fulfillments = (data || []).map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      username: row.users.username,
      email: row.users.email,
      reward_type: row.reward_type,
      reward_value: row.reward_value,
      status: row.status,
      source_type: row.source_type,
      source_id: row.source_id,
      fulfillment_method: row.fulfillment_method,
      fulfillment_details: row.fulfillment_details,
      admin_notes: row.admin_notes,
      processed_by: row.processed_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      fulfilled_at: row.fulfilled_at,
      days_pending: Math.floor(
        (new Date().getTime() - new Date(row.created_at).getTime()) / (1000 * 60 * 60 * 24)
      ),
    }));

    return {
      success: true,
      fulfillments,
    };
  } catch (err) {
    console.error('[rewardFulfillmentService] Unexpected error:', err);
    return {
      success: false,
      fulfillments: [],
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Fulfill a reward (admin only)
 */
export async function fulfillReward(
  params: FulfillRewardParams
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('fulfill_reward', {
      p_fulfillment_id: params.fulfillmentId,
      p_fulfillment_method: params.fulfillmentMethod,
      p_fulfillment_details: params.fulfillmentDetails,
      p_admin_notes: params.adminNotes || null,
      p_processed_by: params.processedBy || null,
    });

    if (error) {
      console.error('[rewardFulfillmentService] Error fulfilling reward:', error);
      return {
        success: false,
        message: 'Failed to fulfill reward',
        error: error.message,
      };
    }

    const result = data as { success: boolean; message: string };

    if (!result.success) {
      return {
        success: false,
        message: result.message,
      };
    }

    console.log('[rewardFulfillmentService] Successfully fulfilled reward:', params.fulfillmentId);

    return {
      success: true,
      message: result.message,
    };
  } catch (err) {
    console.error('[rewardFulfillmentService] Unexpected error:', err);
    return {
      success: false,
      message: 'Unexpected error occurred',
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Update fulfillment status (admin only)
 */
export async function updateFulfillmentStatus(
  fulfillmentId: string,
  status: RewardStatus,
  adminNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: any = { status, updated_at: new Date().toISOString() };
    if (adminNotes) {
      updateData.admin_notes = adminNotes;
    }

    const { error } = await supabase
      .from('reward_fulfillments')
      .update(updateData)
      .eq('id', fulfillmentId);

    if (error) {
      console.error('[rewardFulfillmentService] Error updating fulfillment status:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log('[rewardFulfillmentService] Updated fulfillment status:', fulfillmentId, status);

    return {
      success: true,
    };
  } catch (err) {
    console.error('[rewardFulfillmentService] Unexpected error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Get fulfillment statistics (admin only)
 */
export async function getFulfillmentStats(): Promise<{
  success: boolean;
  stats?: {
    pending: number;
    processing: number;
    fulfilled: number;
    failed: number;
    total: number;
  };
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('reward_fulfillments')
      .select('status');

    if (error) {
      console.error('[rewardFulfillmentService] Error fetching fulfillment stats:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    const stats = {
      pending: 0,
      processing: 0,
      fulfilled: 0,
      failed: 0,
      total: data?.length || 0,
    };

    data?.forEach((row: any) => {
      if (row.status in stats) {
        stats[row.status as keyof typeof stats]++;
      }
    });

    return {
      success: true,
      stats,
    };
  } catch (err) {
    console.error('[rewardFulfillmentService] Unexpected error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
