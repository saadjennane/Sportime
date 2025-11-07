import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { SpinTier, UserSpinState, SpinResult, TournamentType } from '../types';
import { spinWheel } from '../modules/spin/SpinEngine';
import { ADAPTIVE_RULES, RARE_REWARD_CATEGORIES } from '../config/spinConstants';
import { addDays, isAfter } from 'date-fns';
import { useMockStore } from './useMockStore';
import { addCoins } from '../services/coinService';
import { USE_SUPABASE } from '../config/env';
import { performSpin as performSupabaseSpin } from '../services/spinService';

interface SpinState {
  userSpinStates: Record<string, UserSpinState>;
}

interface SpinActions {
  initializeUserSpinState: (userId: string) => void;
  performSpin: (userId: string, tier: SpinTier) => Promise<SpinResult | null>;
  updateUserSpinState: (userId: string, updates: Partial<UserSpinState>) => void;
  tickAdaptiveMultipliers: (userId: string) => void;
}

export const initialUserSpinState = (userId: string): UserSpinState => ({
  userId,
  adaptiveMultipliers: {},
  pityCounter: 0,
  availableSpins: {
    free: 0,
    amateur: 1,
    master: 1,
    apex: 1,
    premium: 0,
  },
  lastFreeSpinAt: null,
  freeSpinStreak: 0,
  updatedAt: new Date(),
});

export const useSpinStore = create<SpinState & SpinActions>((set, get) => ({
  userSpinStates: {},

  initializeUserSpinState: (userId) => {
    set(state => {
      if (state.userSpinStates[userId]) {
        return state; // Already initialized
      }
      return {
        userSpinStates: {
          ...state.userSpinStates,
          [userId]: initialUserSpinState(userId),
        },
      };
    });
  },

  performSpin: async (userId, tier) => {
    const state = get();
    const userState = state.userSpinStates[userId];

    if (!userState || userState.availableSpins[tier] <= 0) {
      return null;
    }

    // Use Supabase if enabled
    if (USE_SUPABASE) {
      try {
        const result = await performSupabaseSpin(userId, tier);

        // The Supabase service already handles everything:
        // - Pity timer logic
        // - Adaptive multipliers
        // - Reward granting (tickets, coins, XP, etc.)
        // - History recording
        // - State updates

        return result;
      } catch (error) {
        console.error('[SpinWheel] Supabase spin failed:', error);
        return null;
      }
    }

    // Fallback to local mock logic
    const { reward, wasPity } = spinWheel(tier, userState);

    // Update state based on the reward
    let newPityCounter = userState.pityCounter + 1;
    let newMultipliers = { ...userState.adaptiveMultipliers };
    const rareCategories = new Set(RARE_REWARD_CATEGORIES[tier]);

    if (rareCategories.has(reward.category)) {
      newPityCounter = 0; // Reset pity timer on rare win
    }

    if (ADAPTIVE_RULES[reward.category]) {
      const rule = ADAPTIVE_RULES[reward.category];
      newMultipliers[reward.category] = {
        multiplier: rule.multiplier,
        expiresAt: addDays(new Date(), rule.durationDays).toISOString(),
      };
    }

    // Handle "Extra Spin" reward
    let newAvailableSpins = { ...userState.availableSpins };
    if (reward.id === 'extra_spin') {
      newAvailableSpins[tier] += 1;
    } else {
      newAvailableSpins[tier] -= 1;
    }

    // Apply other rewards via the main store or services
    const { addTicket, addXp, grantPremium } = useMockStore.getState();
    if (reward.id.startsWith('ticket_')) {
      const tierMap: Record<string, TournamentType> = {
        amateur: 'amateur',
        master: 'master',
        apex: 'apex',
      };
      const ticketTier = reward.id.replace('ticket_', '');
      if (tierMap[ticketTier]) {
        addTicket(userId, tierMap[ticketTier]);
      }
    } else if (reward.id.startsWith('boost_')) {
      addXp(userId, parseInt(reward.id.replace('boost_', '')));
    } else if (reward.id.startsWith('premium_')) {
      grantPremium(userId, parseInt(reward.id.replace('premium_', '').replace('d', '')));
    } else if (reward.id.startsWith('coins_')) {
      const amount = parseInt(reward.id.replace('coins_', ''));
      addCoins(userId, amount, 'spin_wheel', { tier, reward_id: reward.id }).catch((error) => {
        console.error('[SpinWheel] Failed to add coins:', error);
      });
    }

    const spinResult: SpinResult = {
      rewardId: reward.id,
      rewardLabel: reward.label,
      rewardCategory: reward.category,
      rewardValue: reward.value?.toString(),
      wasPity,
      finalChances: {},
      timestamp: new Date(),
    };

    // Update user state
    const updatedUserState: UserSpinState = {
      ...userState,
      pityCounter: newPityCounter,
      adaptiveMultipliers: newMultipliers,
      availableSpins: newAvailableSpins,
      lastFreeSpinAt: userState.lastFreeSpinAt,
      freeSpinStreak: userState.freeSpinStreak,
      updatedAt: new Date(),
    };

    set({
      userSpinStates: {
        ...state.userSpinStates,
        [userId]: updatedUserState,
      },
    });

    return spinResult;
  },

  updateUserSpinState: (userId, updates) => {
    set(state => ({
      userSpinStates: {
        ...state.userSpinStates,
        [userId]: {
          ...state.userSpinStates[userId],
          ...updates,
        },
      },
    }));
  },

  tickAdaptiveMultipliers: (userId) => {
    const state = get();
    const userState = state.userSpinStates[userId];
    if (!userState) return;

    const now = new Date();
    const newMultipliers = { ...userState.adaptiveMultipliers };
    let hasChanged = false;

    for (const key in newMultipliers) {
      const entry = newMultipliers[key];
      if (entry.expiresAt && isAfter(now, new Date(entry.expiresAt))) {
        delete newMultipliers[key];
        hasChanged = true;
      }
    }

    if (hasChanged) {
      state.updateUserSpinState(userId, { adaptiveMultipliers: newMultipliers });
    }
  },
}));
