import { SPIN_REWARDS, RARE_REWARD_CATEGORIES, PITY_TIMER_THRESHOLD, PITY_MULTIPLIER } from '../../config/spinConstants';
import { SpinReward, SpinTier, UserSpinState } from '../../types';

export function spinWheel(
  tier: SpinTier,
  userState: UserSpinState
): { reward: SpinReward; wasPity: boolean; finalChances: Record<string, number> } {
  const rewards = SPIN_REWARDS[tier];
  const rareCategories = new Set(RARE_REWARD_CATEGORIES[tier]);

  const pityActive = userState.pityCounter >= PITY_TIMER_THRESHOLD;

  // 1. Apply adaptive and pity multipliers
  const adjustedChances = rewards.map(reward => {
    let chance = reward.baseChance;
    
    // Apply adaptive drop rate multiplier
    const adaptiveMultiplier = userState.adaptiveMultipliers[reward.category]?.multiplier || 1.0;
    chance *= adaptiveMultiplier;

    // Apply pity timer multiplier for rare rewards
    if (pityActive && rareCategories.has(reward.category)) {
      chance *= PITY_MULTIPLIER;
    }
    
    return { ...reward, adjustedChance: chance };
  });

  // 2. Normalize probabilities to sum to 1
  const totalChance = adjustedChances.reduce((sum, reward) => sum + reward.adjustedChance, 0);
  const normalizedRewards = adjustedChances.map(reward => ({
    ...reward,
    normalizedChance: reward.adjustedChance / totalChance,
  }));

  // 3. Select a reward
  let random = Math.random();
  let selectedReward: SpinReward | null = null;

  for (const reward of normalizedRewards) {
    if (random < reward.normalizedChance) {
      selectedReward = reward;
      break;
    }
    random -= reward.normalizedChance;
  }

  // Fallback in case of floating point inaccuracies
  if (!selectedReward) {
    selectedReward = normalizedRewards[normalizedRewards.length - 1];
  }

  const finalChances = normalizedRewards.reduce((acc, r) => ({...acc, [r.id]: r.normalizedChance}), {});

  return { reward: selectedReward, wasPity: pityActive, finalChances };
}
