import { TournamentType, TicketTier } from '../types';

export const DAILY_STREAK_REWARDS: Record<number, { coins?: number; ticket?: TournamentType }> = {
  1: { coins: 100 },
  2: { coins: 200 },
  3: { coins: 300 },
  4: { coins: 500 },
  5: { coins: 500 },
  6: { coins: 500 },
  7: { ticket: 'amateur' }
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

export const TICKET_RULES: Record<TicketTier, { expiry_days: number; max_quantity: number }> = {
  amateur: { expiry_days: 30, max_quantity: 5 },
  master: { expiry_days: 45, max_quantity: 3 },
  apex: { expiry_days: 60, max_quantity: 2 },
};

const BASE_MULTIPLIERS = {
  flash: 1,
  series: 2,
  season: 4,
} as const;

const createCostEntry = (base: number) => ({
  base,
  multipliers: { ...BASE_MULTIPLIERS },
});

export const TOURNAMENT_COSTS: Record<TournamentType, { base: number; multipliers: Record<keyof typeof BASE_MULTIPLIERS, number> }> = {
  amateur: createCostEntry(2000),
  master: createCostEntry(10000),
  apex: createCostEntry(20000),
};

const TIER_ALIASES: Record<string, TournamentType> = {
  rookie: 'amateur',
  pro: 'master',
  elite: 'apex',
  amateurs: 'amateur',
  masters: 'master',
  elites: 'apex',
};

const DURATION_ALIASES: Record<string, keyof typeof BASE_MULTIPLIERS> = {
  daily: 'flash',
  matchday: 'flash',
  'mini-series': 'series',
  mini_series: 'series',
  series: 'series',
  seasonal: 'season',
  season: 'season',
};

export function normalizeTournamentTier(value?: string | null): TournamentType | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  if (TIER_ALIASES[lower]) return TIER_ALIASES[lower];
  if (lower === 'amateur' || lower === 'master' || lower === 'apex') {
    return lower as TournamentType;
  }
  return undefined;
}

export function normalizeDurationType(value?: string | null): keyof typeof BASE_MULTIPLIERS | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  if (DURATION_ALIASES[lower]) return DURATION_ALIASES[lower];
  if (lower === 'flash' || lower === 'series' || lower === 'season') {
    return lower as keyof typeof BASE_MULTIPLIERS;
  }
  return undefined;
}

// ============================================================================
// Fantasy Game Constants
// ============================================================================

/**
 * Default Fantasy Game ID for Sportime Fantasy Season 1
 * This ID matches the seed data in supabase/migrations/20251114000004_fantasy_seed.sql
 */
export const FANTASY_GAME_ID = 'fantasy-test-1';
