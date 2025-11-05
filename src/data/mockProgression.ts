import { LevelConfig, Badge, UserBadge } from '../types';

export const mockLevelsConfig: LevelConfig[] = [
  { id: 'level-1', level_name: 'Amateur', min_xp: 0, max_xp: 999, level_icon_url: '🥉' },
  { id: 'level-2', level_name: 'Pro', min_xp: 1000, max_xp: 4999, level_icon_url: '🥈' },
  { id: 'level-3', level_name: 'Expert', min_xp: 5000, max_xp: 9999, level_icon_url: '🥇' },
  { id: 'level-4', level_name: 'Master', min_xp: 10000, max_xp: 19999, level_icon_url: '🏆' },
  { id: 'level-5', level_name: 'Legend', min_xp: 20000, max_xp: 49999, level_icon_url: '👑' },
  { id: 'level-6', level_name: 'GOAT', min_xp: 50000, max_xp: Infinity, level_icon_url: '🐐' },
];

export const mockBadges: Badge[] = [
  {
    id: 'badge-1',
    name: 'First Win',
    description: 'Win your first bet.',
    icon_url: '🎉',
    condition_type: 'wins',
    condition_value: { count: 1 },
    created_at: new Date().toISOString(),
  },
  {
    id: 'badge-2',
    name: 'Challenge Veteran',
    description: 'Join 3 challenges.',
    icon_url: '🎖️',
    condition_type: 'challenges_joined',
    condition_value: { count: 3 },
    created_at: new Date().toISOString(),
  },
  {
    id: 'badge-3',
    name: 'High Roller',
    description: 'Bet more than 1000 coins on a single match.',
    icon_url: '💰',
    condition_type: 'single_bet_amount',
    condition_value: { amount: 1000 },
    created_at: new Date().toISOString(),
  },
  {
    id: 'badge-4',
    name: 'Perfect Day',
    description: 'Win all your bets in a single challenge day.',
    icon_url: '🎯',
    condition_type: 'perfect_day',
    condition_value: {},
    created_at: new Date().toISOString(),
  },
  {
    id: 'badge-5',
    name: 'Underdog',
    description: 'Win a bet with odds greater than 3.5.',
    icon_url: '🚀',
    condition_type: 'odds_win',
    condition_value: { odds: 3.5 },
    created_at: new Date().toISOString(),
  },
];

export const mockUserBadges: UserBadge[] = [
  { id: 'ub-1', user_id: 'guest-id', badge_id: 'badge-1', earned_at: new Date().toISOString() },
  { id: 'ub-2', user_id: 'guest-id', badge_id: 'badge-3', earned_at: new Date().toISOString() },
];
