/**
 * Seasonal Rewards Service
 *
 * Handles the distribution of prizes for seasonal game winners.
 * Integrates with the main reward distribution system to ensure
 * proper notifications and tracking.
 */

import { supabase } from './supabase';
import { RewardItem } from '../types';

export interface SeasonalWinner {
  user_id: string;
  rank: number;
  username: string;
  score: number;
  reward_distributed: RewardItem;
  success: boolean;
  error?: string;
}

export interface SeasonalDistributionResult {
  success: boolean;
  winners: SeasonalWinner[];
  errors: string[];
}

/**
 * Distributes prizes to top N players for a seasonal game within a period
 */
export async function distributeSeasonalPrizes(
  gameId: string,
  periodStart: string,
  periodEnd: string,
  topN: number,
  reward: RewardItem
): Promise<SeasonalDistributionResult> {
  try {
    // Call the database function
    const { data, error } = await supabase.rpc('distribute_seasonal_prizes', {
      p_game_id: gameId,
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_top_n: topN,
      p_reward: {
        type: reward.type,
        value: reward.value,
        tier: reward.tier,
      },
    });

    if (error) {
      console.error('[seasonalRewardsService] Error distributing prizes:', error);
      return {
        success: false,
        winners: [],
        errors: [error.message],
      };
    }

    if (!data || data.length === 0) {
      return {
        success: true,
        winners: [],
        errors: ['No winners found for the specified period'],
      };
    }

    // Parse results
    const winners: SeasonalWinner[] = data.map((row: any) => ({
      user_id: row.out_user_id,
      rank: row.out_rank,
      username: row.out_username,
      score: row.out_score,
      reward_distributed: row.out_reward_distributed,
      success: row.out_success,
      error: row.out_error,
    }));

    const errors = winners
      .filter(w => !w.success && w.error)
      .map(w => w.error!);

    const allSuccessful = winners.every(w => w.success);

    console.log(`[seasonalRewardsService] Distributed prizes to ${winners.length} winners`, {
      successful: winners.filter(w => w.success).length,
      failed: winners.filter(w => !w.success).length,
    });

    return {
      success: allSuccessful,
      winners,
      errors,
    };
  } catch (err) {
    console.error('[seasonalRewardsService] Unexpected error:', err);
    return {
      success: false,
      winners: [],
      errors: [err instanceof Error ? err.message : 'Unknown error'],
    };
  }
}

/**
 * Creates a celebration announcement for seasonal winners
 */
export async function createSeasonalCelebration(
  gameId: string,
  periodStart: string,
  periodEnd: string,
  message: string,
  winners: SeasonalWinner[]
): Promise<{ success: boolean; celebrationId?: string; error?: string }> {
  try {
    // Format winners for the function
    const winnersData = winners.map(w => ({
      user_id: w.user_id,
      rank: w.rank,
      username: w.username,
      score: w.score,
      reward: w.reward_distributed,
    }));

    const { data: celebrationId, error } = await supabase.rpc('create_seasonal_celebration', {
      p_game_id: gameId,
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_message: message,
      p_winners: winnersData,
    });

    if (error) {
      console.error('[seasonalRewardsService] Error creating celebration:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log('[seasonalRewardsService] Created celebration:', celebrationId);

    return {
      success: true,
      celebrationId,
    };
  } catch (err) {
    console.error('[seasonalRewardsService] Unexpected error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Complete seasonal distribution: distribute prizes and create celebration
 */
export async function completeSeasonalDistribution(
  gameId: string,
  periodStart: string,
  periodEnd: string,
  topN: number,
  reward: RewardItem,
  message: string
): Promise<SeasonalDistributionResult & { celebrationId?: string }> {
  // First, distribute prizes
  const distributionResult = await distributeSeasonalPrizes(
    gameId,
    periodStart,
    periodEnd,
    topN,
    reward
  );

  if (!distributionResult.success || distributionResult.winners.length === 0) {
    return distributionResult;
  }

  // Then create celebration
  const celebrationResult = await createSeasonalCelebration(
    gameId,
    periodStart,
    periodEnd,
    message,
    distributionResult.winners
  );

  if (!celebrationResult.success) {
    return {
      ...distributionResult,
      errors: [
        ...distributionResult.errors,
        `Failed to create celebration: ${celebrationResult.error}`,
      ],
    };
  }

  return {
    ...distributionResult,
    celebrationId: celebrationResult.celebrationId,
  };
}
