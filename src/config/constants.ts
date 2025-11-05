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

export const STREAK_RESET_THRESHOLD_HOURS = 24;

const DEFAULT_LEVEL_BET_LIMIT = 500;

export const LEVEL_BET_LIMITS: Record<string, number | null> = {
  Rookie: 500,
  'Rising Star': 1000,
  Pro: 2000,
  Elite: 5000,
  Legend: 15000,
  Master: 40000,
  GOAT: null, // no limit
}

export function getLevelBetLimit(level?: string | null): number | null {
  if (!level) return DEFAULT_LEVEL_BET_LIMIT
  const normalized = level.trim()
  if (!normalized) return DEFAULT_LEVEL_BET_LIMIT

  if (Object.prototype.hasOwnProperty.call(LEVEL_BET_LIMITS, normalized)) {
    return LEVEL_BET_LIMITS[normalized]
  }

  const lower = normalized.toLowerCase()
  switch (lower) {
    case 'rookie':
      return LEVEL_BET_LIMITS.Rookie
    case 'rising_star':
    case 'rising star':
      return LEVEL_BET_LIMITS['Rising Star']
    case 'pro':
      return LEVEL_BET_LIMITS.Pro
    case 'elite':
    case 'expert':
      return LEVEL_BET_LIMITS.Elite
    case 'legend':
      return LEVEL_BET_LIMITS.Legend
    case 'master':
      return LEVEL_BET_LIMITS.Master
    case 'goat':
      return LEVEL_BET_LIMITS.GOAT
    default:
      return DEFAULT_LEVEL_BET_LIMIT
  }
}

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
