import { Profile, UserBadge } from '../types';

export const mockUserProfile: Profile = {
  id: 'mock-user-saad-jennane',
  email: 'saadjennane@gmail.com',
  username: 'saadjennane',
  profile_picture_url: 'https://i.pravatar.cc/150?u=a042581f4e29026704e',
  coins_balance: 50000,
  created_at: new Date().toISOString(),
  is_guest: false,
  level: 'Pro',
  xp: 2500,
  is_admin: true,
};

export const mockUserBadgesData: UserBadge[] = [
  { id: 'ub-1', user_id: 'mock-user-saad-jennane', badge_id: 'badge-1', earned_at: new Date().toISOString() },
  { id: 'ub-2', user_id: 'mock-user-saad-jennane', badge_id: 'badge-3', earned_at: new Date().toISOString() },
];
