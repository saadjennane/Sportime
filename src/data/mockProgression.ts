/**
 * Mock Progression Data (Stub)
 *
 * NOTE: Progression system (levels, badges, XP) is now managed via Supabase.
 * This stub file exists only for backward compatibility with App.tsx.
 */

import { LevelConfig, Badge, UserBadge } from '../types';

export const mockLevelsConfig: LevelConfig[] = [
  { level: 1, name: 'Rookie', minXP: 0, maxXP: 99, betLimit: 100, color: '#9CA3AF' },
  { level: 2, name: 'Rising Star', minXP: 100, maxXP: 499, betLimit: 500, color: '#60A5FA' },
  { level: 3, name: 'Pro', minXP: 500, maxXP: 1499, betLimit: 2000, color: '#34D399' },
  { level: 4, name: 'Elite', minXP: 1500, maxXP: 3999, betLimit: 5000, color: '#FBBF24' },
  { level: 5, name: 'Legend', minXP: 4000, maxXP: 9999, betLimit: 10000, color: '#F59E0B' },
  { level: 6, name: 'Master', minXP: 10000, maxXP: 24999, betLimit: 25000, color: '#8B5CF6' },
  { level: 7, name: 'GOAT', minXP: 25000, maxXP: Infinity, betLimit: null, color: '#EC4899' },
];

export const mockBadges: Badge[] = [];

export const mockUserBadges: UserBadge[] = [];
