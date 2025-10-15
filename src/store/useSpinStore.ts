import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { UserSpinState, SpinResult, SpinTelemetryLog, SpinTier } from '../types';
import { logSpin } from '../utils/spinTelemetry';
import { spinWheel } from '../modules/spin/SpinEngine';
import { useMockStore } from './useMockStore';

interface SpinStoreState {
  userSpinStates: Record<string, UserSpinState>;
  spinTelemetry: SpinTelemetryLog[];
}

interface SpinStoreActions {
  getUserSpinState: (userId: string) => UserSpinState;
  updateUserSpinState: (userId: string, updates: Partial<UserSpinState>) => void;
  addSpinToHistory: (userId: string, result: SpinResult) => void;
  logSpinTelemetry: (log: SpinTelemetryLog) => void;
  performSpin: (tier: SpinTier, userId: string) => SpinResult;
  tickAdaptiveCooldowns: (userId: string) => void;
}

const initialUserSpinState = (userId: string): UserSpinState => ({
  userId,
  adaptiveMultipliers: {},
  pityCounter: 0,
  spinHistory: [],
  availableSpins: { rookie: 1, pro: 1, elite: 1 },
});

export const useSpinStore = create<SpinStoreState & SpinStoreActions>((set, get) => ({
  userSpinStates: {},
  spinTelemetry: [],

  getUserSpinState: (userId) => {
    const state = get().userSpinStates[userId];
    if (!state) {
      return initialUserSpinState(userId);
    }
    return state;
  },

  updateUserSpinState: (userId, updates) => {
    const currentState = get().getUserSpinState(userId);
    const newState = { ...currentState, ...updates };
    set(state => ({
      userSpinStates: {
        ...state.userSpinStates,
        [userId]: newState,
      },
    }));
  },

  addSpinToHistory: (userId, result) => {
    const userState = get().getUserSpinState(userId);
    const newHistory = [result, ...userState.spinHistory].slice(0, 10);
    get().updateUserSpinState(userId, { spinHistory: newHistory });
  },

  logSpinTelemetry: (log) => {
    set(state => ({
      spinTelemetry: [...state.spinTelemetry, log],
    }));
    logSpin(log); // Also log to external utility
  },

  performSpin: (tier, userId) => {
    const { getUserSpinState, updateUserSpinState, logSpinTelemetry, addSpinToHistory } = get();
    const { addTicket, addXp, grantPremium } = useMockStore.getState();

    const userState = getUserSpinState(userId);
    
    if (userState.availableSpins[tier] <= 0) {
      throw new Error(`No available spins for ${tier} tier.`);
    }

    const { wonReward, newState } = spinWheel(tier, userState);
    
    // Grant reward
    if (wonReward.id.startsWith('ticket_')) {
      const ticketType = wonReward.id.replace('ticket_', '').replace('_upgrade', '') as 'rookie' | 'pro' | 'elite';
      addTicket(userId, ticketType);
    } else if (wonReward.id.startsWith('boost_')) {
      const xpAmount = parseInt(wonReward.id.replace('boost_', ''));
      addXp(userId, xpAmount);
    } else if (wonReward.id.startsWith('premium_')) {
      const days = parseInt(wonReward.id.replace('premium_', '').replace('d', ''));
      grantPremium(userId, days);
    } else if (wonReward.id === 'extra_spin_rookie') {
      newState.availableSpins.rookie += 1;
    } else if (wonReward.id === 'extra_spin_pro') {
      newState.availableSpins.pro += 1;
    } else if (wonReward.id === 'extra_spin_elite') {
      newState.availableSpins.elite += 1;
    }

    newState.availableSpins[tier] -= 1;
    
    updateUserSpinState(userId, newState);

    const spinResult: SpinResult = {
      id: uuidv4(),
      tier,
      rewardId: wonReward.id,
      rewardLabel: wonReward.label,
      timestamp: new Date().toISOString(),
      wasPity: userState.pityCounter >= 10,
    };

    addSpinToHistory(userId, spinResult);
    
    logSpinTelemetry({
      user_id: userId,
      wheel_tier: tier,
      outcome: wonReward.id,
      rarity_flag: newState.pityCounter === 0, // Pity counter resets on rare win
      multipliers: {}, // Simplified for now
      pity_active: userState.pityCounter >= 10,
      inventory_snapshot: { spins: newState.availableSpins },
      timestamp: spinResult.timestamp,
    });
    
    return spinResult;
  },

  tickAdaptiveCooldowns: (userId) => {
    const userState = get().getUserSpinState(userId);
    const newMultipliers = { ...userState.adaptiveMultipliers };
    let changed = false;

    for (const key in newMultipliers) {
      const item = newMultipliers[key];
      if (item.expiresAt && new Date(item.expiresAt) < new Date()) {
        delete newMultipliers[key];
        changed = true;
      } else {
        // Simplified daily recovery logic
        if (item.multiplier < 1.0) {
          if (key === 'masterpass') {
            item.multiplier = Math.min(1.0, item.multiplier + 0.02);
          } else {
            item.multiplier = Math.min(1.0, item.multiplier + 0.1);
          }
          changed = true;
        }
      }
    }

    if (changed) {
      get().updateUserSpinState(userId, { adaptiveMultipliers: newMultipliers });
    }
  },
}));
