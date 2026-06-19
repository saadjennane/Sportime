import { create } from 'zustand';
import { UserSpinState } from '../types';
import { isAfter } from 'date-fns';

interface SpinState {
  userSpinStates: Record<string, UserSpinState>;
}

interface SpinActions {
  initializeUserSpinState: (userId: string) => void;
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
