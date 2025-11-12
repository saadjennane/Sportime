import { supabase } from './supabase';
import { SpinTier, SpinReward, UserSpinState, SpinResult } from '../types';
import { SPIN_REWARDS, ADAPTIVE_RULES, PITY_TIMER_THRESHOLD, PITY_MULTIPLIER, RARE_REWARD_CATEGORIES } from '../config/spinConstants';
import { grantTicket } from './ticketService';
import { addXpToUser } from './progressionService';

// =====================================================
// CORE SPIN STATE FUNCTIONS
// =====================================================

/**
 * Get or create user spin state from Supabase
 */
export async function getUserSpinState(userId: string): Promise<UserSpinState> {
  const { data, error } = await supabase
    .rpc('get_user_spin_state', { p_user_id: userId })
    .single();

  if (error) {
    console.error('Error fetching spin state:', error);
    throw new Error(`Failed to fetch spin state: ${error.message}`);
  }

  return {
    userId: data.out_user_id,
    pityCounter: data.out_pity_counter,
    adaptiveMultipliers: data.out_adaptive_multipliers || {},
    availableSpins: data.out_available_spins || {
      free: 0,
      amateur: 0,
      master: 0,
      apex: 0,
      premium: 0,
    },
    lastFreeSpinAt: data.out_last_free_spin_at ? new Date(data.out_last_free_spin_at) : null,
    freeSpinStreak: data.out_free_spin_streak,
    updatedAt: new Date(data.out_updated_at),
  };
}

/**
 * Get spin history for a user
 */
export async function getSpinHistory(userId: string, limit: number = 10): Promise<SpinResult[]> {
  const { data, error } = await supabase
    .rpc('get_spin_history', {
      p_user_id: userId,
      p_limit: limit
    });

  if (error) {
    console.error('Error fetching spin history:', error);
    throw new Error(`Failed to fetch spin history: ${error.message}`);
  }

  return (data || []).map((record: any) => ({
    rewardId: record.reward_id,
    rewardLabel: record.reward_label,
    rewardCategory: record.reward_category,
    rewardValue: record.reward_value,
    wasPity: record.was_pity,
    finalChances: record.final_chances,
    timestamp: new Date(record.created_at),
  }));
}

/**
 * Add or remove available spins for a tier
 */
export async function updateAvailableSpins(
  userId: string,
  tier: SpinTier,
  delta: number
): Promise<Record<SpinTier, number>> {
  const { data, error } = await supabase
    .rpc('update_available_spins', {
      p_user_id: userId,
      p_tier: tier,
      p_delta: delta,
    });

  if (error) {
    console.error('Error updating available spins:', error);
    throw new Error(`Failed to update available spins: ${error.message}`);
  }

  return data as Record<SpinTier, number>;
}

/**
 * Claim daily free spin (24h cooldown)
 */
export async function claimDailyFreeSpin(userId: string): Promise<{
  success: boolean;
  message: string;
  spinsGranted: number;
  nextAvailableAt: Date | null;
}> {
  const { data, error } = await supabase
    .rpc('claim_daily_free_spin', { p_user_id: userId })
    .single();

  if (error) {
    console.error('Error claiming free spin:', error);
    throw new Error(`Failed to claim free spin: ${error.message}`);
  }

  return {
    success: data.success,
    message: data.message,
    spinsGranted: data.spins_granted,
    nextAvailableAt: data.next_available_at ? new Date(data.next_available_at) : null,
  };
}

// =====================================================
// SPIN PROBABILITY CALCULATIONS
// =====================================================

/**
 * Calculate final probabilities with pity timer and adaptive multipliers
 */
function calculateFinalProbabilities(
  rewards: SpinReward[],
  pityCounter: number,
  adaptiveMultipliers: Record<string, { multiplier: number; expiresAt: string }>
): { reward: SpinReward; finalChance: number }[] {
  const now = new Date();

  // Apply pity multiplier to rare rewards
  let adjustedRewards = rewards.map(reward => {
    let finalChance = reward.baseChance;

    // Pity timer: boost rare rewards when counter reaches threshold
    if (pityCounter >= PITY_TIMER_THRESHOLD) {
      const rareCategories = RARE_REWARD_CATEGORIES[reward.id.split('_')[1] as SpinTier] || [];
      if (rareCategories.some(cat => reward.category.includes(cat) || reward.id.includes(cat))) {
        finalChance *= PITY_MULTIPLIER;
      }
    }

    // Adaptive multipliers: reduce chance for recently won categories
    const multiplierData = adaptiveMultipliers[reward.category];
    if (multiplierData) {
      const expiresAt = new Date(multiplierData.expiresAt);
      if (expiresAt > now) {
        finalChance *= multiplierData.multiplier;
      }
    }

    return { reward, finalChance };
  });

  // Normalize probabilities to sum to 1.0
  const total = adjustedRewards.reduce((sum, r) => sum + r.finalChance, 0);
  adjustedRewards = adjustedRewards.map(r => ({
    ...r,
    finalChance: r.finalChance / total,
  }));

  return adjustedRewards;
}

/**
 * Weighted random selection
 */
function selectReward(
  adjustedRewards: { reward: SpinReward; finalChance: number }[]
): { reward: SpinReward; finalChance: number } {
  const random = Math.random();
  let cumulative = 0;

  for (const item of adjustedRewards) {
    cumulative += item.finalChance;
    if (random <= cumulative) {
      return item;
    }
  }

  // Fallback to last reward (should never happen with proper normalization)
  return adjustedRewards[adjustedRewards.length - 1];
}

// =====================================================
// REWARD GRANTING
// =====================================================

/**
 * Grant reward to user based on category
 */
async function grantSpinReward(userId: string, reward: SpinReward): Promise<void> {
  const { category, id, label } = reward;

  try {
    // Handle different reward types
    if (category === 'ticket') {
      // Extract tier from reward id (e.g., "ticket_amateur" -> "amateur")
      const tierMatch = id.match(/ticket_(\w+)/);
      if (tierMatch) {
        const tier = tierMatch[1] as 'amateur' | 'master' | 'apex';
        await grantTicket(userId, tier, 7); // 7 days expiry
      }
    } else if (category === 'spin') {
      // Grant additional spins
      const tierMatch = id.match(/extra_spin_(\w+)/) || ['', 'amateur'];
      const tier = (tierMatch[1] || 'amateur') as SpinTier;
      await updateAvailableSpins(userId, tier, 1);
    } else if (category === 'xp') {
      // Extract XP amount from label (e.g., "XP +50" -> 50)
      const xpMatch = label.match(/\+(\d+)/);
      if (xpMatch) {
        const xpAmount = parseInt(xpMatch[1], 10);
        await addXpToUser(userId, xpAmount);
      }
    } else if (category === 'masterpass') {
      // PLACEHOLDER: Give 5000 coins instead of MasterPass
      const { addCoins } = await import('./coinService');
      await addCoins(userId, 5000, 'spin_wheel', {
        reward_id: id,
        reward_label: label,
        placeholder: 'masterpass_not_implemented',
        message: 'MasterPass reward (5000 coins placeholder)'
      });
      console.log(`MasterPass reward converted to 5000 coins placeholder for user ${userId}`);
    } else if (category === 'premium') {
      // PLACEHOLDER: Give 5000 coins instead of Premium
      const { addCoins } = await import('./coinService');
      await addCoins(userId, 5000, 'spin_wheel', {
        reward_id: id,
        reward_label: label,
        placeholder: 'premium_not_implemented',
        message: 'Premium subscription reward (5000 coins placeholder)'
      });
      console.log(`Premium reward converted to 5000 coins placeholder for user ${userId}`);
    } else if (category === 'gift_card') {
      // PLACEHOLDER: Give 5000 coins instead of Gift Card
      const { addCoins } = await import('./coinService');
      await addCoins(userId, 5000, 'spin_wheel', {
        reward_id: id,
        reward_label: label,
        placeholder: 'giftcard_not_implemented',
        message: 'Gift card reward (5000 coins placeholder)'
      });
      console.log(`Gift card reward converted to 5000 coins placeholder for user ${userId}`);
    }
  } catch (error) {
    console.error('Error granting reward:', error);
    throw new Error(`Failed to grant reward ${id}: ${error}`);
  }
}

// =====================================================
// MAIN SPIN FUNCTION
// =====================================================

/**
 * Perform a spin for a user
 * This is the main entry point for spinning the wheel
 */
export async function performSpin(userId: string, tier: SpinTier): Promise<SpinResult> {
  // 1. Get current spin state
  const spinState = await getUserSpinState(userId);

  // 2. Check if user has available spins for this tier
  const availableCount = spinState.availableSpins[tier] || 0;
  if (availableCount <= 0) {
    throw new Error(`No available ${tier} spins`);
  }

  // 3. Get rewards for this tier
  const tierRewards = SPIN_REWARDS[tier];
  if (!tierRewards || tierRewards.length === 0) {
    throw new Error(`No rewards configured for tier ${tier}`);
  }

  // 4. Clean expired multipliers
  const { data: cleanedMultipliers, error: cleanError } = await supabase
    .rpc('clean_expired_multipliers', { p_user_id: userId });

  if (cleanError) {
    console.warn('Failed to clean expired multipliers:', cleanError);
  }

  const activeMultipliers = cleanedMultipliers || spinState.adaptiveMultipliers;

  // 5. Calculate final probabilities
  const adjustedRewards = calculateFinalProbabilities(
    tierRewards,
    spinState.pityCounter,
    activeMultipliers
  );

  // 6. Select reward
  const { reward, finalChance } = selectReward(adjustedRewards);

  // 7. Determine if this was a pity trigger
  const wasPity = spinState.pityCounter >= PITY_TIMER_THRESHOLD &&
    (RARE_REWARD_CATEGORIES[tier] || []).some(cat =>
      reward.category.includes(cat) || reward.id.includes(cat)
    );

  // 8. Update pity counter (reset if rare, increment otherwise)
  const shouldResetPity = wasPity || reward.category === 'gift_card' || reward.category === 'premium';
  await supabase.rpc('update_pity_counter', {
    p_user_id: userId,
    p_reset: shouldResetPity,
  });

  // 9. Update adaptive multipliers if rare reward
  if (ADAPTIVE_RULES[reward.category]) {
    const rule = ADAPTIVE_RULES[reward.category];
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + rule.durationDays);

    await supabase.rpc('update_adaptive_multipliers', {
      p_user_id: userId,
      p_category: reward.category,
      p_expires_at: expiresAt.toISOString(),
    });
  }

  // 10. Consume spin
  await updateAvailableSpins(userId, tier, -1);

  // 11. Record spin in history
  const finalChancesRecord = adjustedRewards.reduce((acc, r) => {
    acc[r.reward.id] = r.finalChance;
    return acc;
  }, {} as Record<string, number>);

  await supabase.rpc('record_spin', {
    p_user_id: userId,
    p_tier: tier,
    p_reward_id: reward.id,
    p_reward_label: reward.label,
    p_reward_category: reward.category,
    p_reward_value: reward.value || null,
    p_was_pity: wasPity,
    p_final_chances: finalChancesRecord,
  });

  // 12. Grant reward to user
  await grantSpinReward(userId, reward);

  // 13. Return result
  return {
    rewardId: reward.id,
    rewardLabel: reward.label,
    rewardCategory: reward.category,
    rewardValue: reward.value,
    wasPity,
    finalChances: finalChancesRecord,
    timestamp: new Date(),
  };
}

// =====================================================
// ADMIN/TESTING FUNCTIONS
// =====================================================

/**
 * Manually add spins for testing or admin purposes
 */
export async function addSpinsForTesting(
  userId: string,
  spins: Partial<Record<SpinTier, number>>
): Promise<void> {
  for (const [tier, count] of Object.entries(spins)) {
    if (count && count > 0) {
      await updateAvailableSpins(userId, tier as SpinTier, count);
    }
  }
}

/**
 * Reset user spin state (for testing)
 */
export async function resetSpinState(userId: string): Promise<void> {
  // Reset pity counter
  await supabase.rpc('update_pity_counter', {
    p_user_id: userId,
    p_reset: true,
  });

  // Clear adaptive multipliers
  const { error } = await supabase
    .from('user_spin_states')
    .update({
      adaptive_multipliers: {},
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Error resetting spin state:', error);
    throw new Error(`Failed to reset spin state: ${error.message}`);
  }
}
