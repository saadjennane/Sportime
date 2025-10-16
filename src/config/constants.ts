import { TournamentType } from '../types';

export const DAILY_STREAK_REWARDS: Record<number, { coins?: number; ticket?: TournamentType }> = {
  1: { coins: 100 },
  2: { coins: 200 },
  3: { coins: 300 },
  4: { coins: 500 },
  5: { coins: 500 },
  6: { coins: 500 },
  7: { ticket: 'rookie' }
};

export const STREAK_RESET_THRESHOLD_HOURS = 48;

export const LEVEL_BET_LIMITS: Record<string, number | null> = {
  Amateur: 500,
  Pro: 1000,
  Expert: 2000,
  Master: 5000,
  Legend: 10000,
  GOAT: null, // no limit
};

export const TICKET_RULES: Record<TournamentType, { expiry_days: number; max_quantity: number }> = {
  rookie: { expiry_days: 30, max_quantity: 5 },
  pro: { expiry_days: 45, max_quantity: 3 },
  elite: { expiry_days: 60, max_quantity: 2 },
};

export const TOURNAMENT_COSTS: Record<TournamentType, { base: number; multipliers: Record<string, number> }> = {
  rookie: { base: 2000, multipliers: { matchday: 1, "mini-series": 2, season: 4 } },
  pro: { base: 10000, multipliers: { matchday: 1, "mini-series": 2, season: 4 } },
  elite: { base: 20000, multipliers: { matchday: 1, "mini-series": 2, season: 4 } },
};
