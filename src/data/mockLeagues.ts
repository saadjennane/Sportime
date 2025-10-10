import { League, LeagueMember } from '../types';

const mockUsers: Record<string, { id: string; username: string; profile_picture_url: string; }> = {
  'mock-user-saad-jennane': { id: 'mock-user-saad-jennane', username: 'saadjennane', profile_picture_url: 'https://i.pravatar.cc/150?u=a042581f4e29026704e' },
  'user-2': { id: 'user-2', username: 'JaneDoe', profile_picture_url: 'https://i.pravatar.cc/150?u=a042581f4e29026704d' },
  'user-3': { id: 'user-3', username: 'JohnSmith', profile_picture_url: 'https://i.pravatar.cc/150?u=a042581f4e29026704c' },
};

const mockMembersLeague1: LeagueMember[] = [
  { role: 'admin', user: mockUsers['mock-user-saad-jennane'] },
  { role: 'member', user: mockUsers['user-2'] },
];

const mockMembersLeague2: LeagueMember[] = [
  { role: 'admin', user: mockUsers['user-3'] },
  { role: 'member', user: mockUsers['mock-user-saad-jennane'] },
  { role: 'member', user: mockUsers['user-2'] },
];

export const mockLeaguesData: League[] = [
  {
    id: 'league-1',
    name: 'The Champions',
    description: 'Weekly predictions on Premier League matches.',
    image_url: null,
    invite_code: 'CHAMP123',
    created_by: 'mock-user-saad-jennane',
    created_at: new Date().toISOString(),
    member_count: 2,
    members: mockMembersLeague1,
  },
  {
    id: 'league-2',
    name: 'La Liga Legends',
    description: 'Who will win the Spanish league?',
    image_url: null,
    invite_code: 'LEGEND456',
    created_by: 'user-3',
    created_at: new Date().toISOString(),
    member_count: 3,
    members: mockMembersLeague2,
  },
];
