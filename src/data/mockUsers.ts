import { Profile } from '../types';

export const mockUser: Profile = {
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

// In a real mock setup, you might have more users.
export const mockUsers: Profile[] = [mockUser];
