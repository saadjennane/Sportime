import { LeagueMember } from '../types';

export const mockLeagueMembers: LeagueMember[] = [
    {
        id: 'lm_001',
        league_id: 'l_001',
        user_id: 'user-1',
        role: 'admin',
        joined_at: new Date().toISOString(),
    },
    {
        id: 'lm_002',
        league_id: 'l_001',
        user_id: 'user-2',
        role: 'member',
        joined_at: new Date().toISOString(),
    },
    {
        id: 'lm_003',
        league_id: 'l_001',
        user_id: 'user-3',
        role: 'member',
        joined_at: new Date().toISOString(),
    }
];
