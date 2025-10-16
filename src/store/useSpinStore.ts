import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { SpinTier, UserSpinState, SpinResult } from '../types';
import { spinWheel } from '../modules/spin/SpinEngine';
import { ADAPTIVE_RULES, RARE_REWARD_CATEGORIES } from '../config/spinConstants';
import { addDays, isAfter } from 'date-fns';
import { useMockStore } from './useMockStore';

interface SpinState {
  userSpinStates: Record<string, UserSpinState>;
}

interface SpinActions {
  initializeUserSpinState: (userId: string) => void;
  performSpin: (userId: string, tier: SpinTier) => SpinResult | null;
  updateUserSpinState: (userId: string, updates: Partial<UserSpinState>) => void;
  tickAdaptiveMultipliers: (userId: string) => void;
}

export const initialUserSpinState = (userId: string): UserSpinState => ({
  userId,
  adaptiveMultipliers: {},
  pityCounter: 0,
  spinHistory: [],
  availableSpins: { rookie: 1, pro: 1, elite: 1 },
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

  performSpin: (userId, tier) => {
    const state = get();
    const userState = state.userSpinStates[userId];
    if (!userState || userState.availableSpins[tier] <= 0) {
      return null;
    }

    // Perform the spin
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

    // Apply other rewards via the main store
    const { addTicket, addXp, grantPremium } = useMockStore.getState();
    if (reward.id.startsWith('ticket_')) {
      addTicket(userId, reward.id.replace('ticket_', '') as TournamentType);
    } else if (reward.id.startsWith('boost_')) {
      addXp(userId, parseInt(reward.id.replace('boost_', '')));
    } else if (reward.id.startsWith('premium_')) {
      grantPremium(userId, parseInt(reward.id.replace('premium_', '').replace('d', '')));
    }

    const spinResult: SpinResult = {
      id: uuidv4(),
      tier,
      rewardId: reward.id,
      rewardLabel: reward.label,
      timestamp: new Date().toISOString(),
      wasPity,
    };

    // Update user state
    const updatedUserState: UserSpinState = {
      ...userState,
      pityCounter: newPityCounter,
      adaptiveMultipliers: newMultipliers,
      spinHistory: [spinResult, ...userState.spinHistory.slice(0, 9)],
      availableSpins: newAvailableSpins,
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
