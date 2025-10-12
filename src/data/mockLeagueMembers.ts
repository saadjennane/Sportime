import { LeagueMember } from '../types';

export const mockLeagueMembers: LeagueMember[] = [
    // League 1
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
    },
    // League 2
    {
        id: 'lm_004',
        league_id: 'l_002',
        user_id: 'user-2',
        role: 'admin',
        joined_at: new Date().toISOString(),
    },
    {
        id: 'lm_005',
        league_id: 'l_002',
        user_id: 'user-1',
        role: 'member',
        joined_at: new Date().toISOString(),
    }
];
