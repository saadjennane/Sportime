/**
 * Canonical user level taxonomy (progression / XP) — single source of truth.
 * Order matters: index = rank (Rookie = 0 … GOAT = 6).
 * NB: distinct from challenge TIERS (Amateur/Master/Apex = ticket tiers).
 */
export const USER_LEVELS = [
  'Rookie',
  'Rising Star',
  'Pro',
  'Elite',
  'Legend',
  'Master',
  'GOAT',
] as const;

export type UserLevel = (typeof USER_LEVELS)[number];

// Legacy / alternate spellings seen across the app & DB -> canonical name.
const LEVEL_ALIASES: Record<string, UserLevel> = {
  rookie: 'Rookie',
  'rising star': 'Rising Star',
  rising_star: 'Rising Star',
  pro: 'Pro',
  elite: 'Elite',
  expert: 'Elite', // legacy alias
  amateur: 'Rookie', // legacy eligibility alias -> lowest level
  legend: 'Legend',
  master: 'Master',
  goat: 'GOAT',
};

export function normalizeLevel(value?: string | null): UserLevel {
  if (!value) return 'Rookie';
  const k = value.toLowerCase().trim();
  return LEVEL_ALIASES[k] ?? (USER_LEVELS.find((l) => l.toLowerCase() === k) ?? 'Rookie');
}

/** 0-based rank in the hierarchy (Rookie = 0 … GOAT = 6). */
export function levelRank(value?: string | null): number {
  return USER_LEVELS.indexOf(normalizeLevel(value));
}
