import { SpinTier, SpinReward, UserSpinState } from '../../types';
import { SPIN_REWARDS, RARE_REWARD_CATEGORIES, PITY_TIMER_THRESHOLD } from '../../config/spinConstants';
import { addDays } from 'date-fns';

/**
 * The core logic for a single wheel spin.
 * This is a pure function that takes the current state and returns the result and the new state.
 */
export const spinWheel = (tier: SpinTier, currentState: UserSpinState): { wonReward: SpinReward, newState: Partial<UserSpinState> } => {
  const baseRewards = SPIN_REWARDS[tier];
  
  // 1. Apply Pity Timer
  const isPityActive = currentState.pityCounter >= PITY_TIMER_THRESHOLD;
  const pityMultiplier = isPityActive ? 1.5 : 1.0;

  // 2. Apply Adaptive Drop Rates
  const adjustedRewards = baseRewards.map(reward => {
    let finalChance = reward.baseChance;
    const adaptiveInfo = currentState.adaptiveMultipliers[reward.category];
    
    if (adaptiveInfo && (!adaptiveInfo.expiresAt || new Date(adaptiveInfo.expiresAt) > new Date())) {
      finalChance *= adaptiveInfo.multiplier;
    }

    if (RARE_REWARD_CATEGORIES[tier].includes(reward.category)) {
      finalChance *= pityMultiplier;
    }
    
    return { ...reward, finalChance };
  });

  // 3. Normalize Probabilities
  const totalChance = adjustedRewards.reduce((sum, r) => sum + r.finalChance, 0);
  let cumulativeChance = 0;
  const normalizedRewards = adjustedRewards.map(r => {
    const normalized = r.finalChance / totalChance;
    cumulativeChance += normalized;
    return { ...r, cumulativeChance };
  });

  // 4. Select Winner
  const roll = Math.random();
  const wonReward = normalizedRewards.find(r => roll < r.cumulativeChance)!;

  // 5. Prepare New State
  const isRareWin = RARE_REWARD_CATEGORIES[tier].includes(wonReward.category);
  const newPityCounter = isRareWin ? 0 : currentState.pityCounter + 1;
  const newMultipliers = { ...currentState.adaptiveMultipliers };

  // Update adaptive multipliers based on win
  switch (wonReward.category) {
    case 'premium':
      newMultipliers['premium'] = { multiplier: 0.5, expiresAt: addDays(new Date(), 7).toISOString() };
      break;
    case 'gift_card':
      newMultipliers['gift_card'] = { multiplier: 0.3, expiresAt: addDays(new Date(), 7).toISOString() };
      break;
    case 'masterpass':
      newMultipliers['masterpass'] = { multiplier: 0.5, expiresAt: addDays(new Date(), 30).toISOString() };
      break;
    case 'extra_spin':
      const lastSpin = currentState.spinHistory[0];
      if (lastSpin?.rewardId.includes('extra_spin')) {
        newMultipliers['extra_spin'] = { multiplier: 0.6 };
      }
      break;
    default:
      // Reset extra_spin multiplier if a different reward was won
      if (newMultipliers['extra_spin']) {
        delete newMultipliers['extra_spin'];
      }
  }

  const newState: Partial<UserSpinState> = {
    pityCounter: newPityCounter,
    adaptiveMultipliers: newMultipliers,
    availableSpins: { ...currentState.availableSpins },
  };

  return { wonReward, newState };
};
