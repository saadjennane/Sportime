import { UserLeague } from '../types';

export const mockUserLeagues: UserLeague[] = [
    {
        id: 'l_001',
        name: 'The Winners Circle',
        description: 'A league for elite predictors who never miss.',
        image_url: 'https://i.imgur.com/8c3S3T7.png',
        invite_code: 'WINNERS',
        created_by: 'user-1',
        created_at: new Date().toISOString(),
        season_start_date: '2025-08-01T00:00:00.000Z',
        season_end_date: '2026-05-30T00:00:00.000Z',
    },
    {
        id: 'l_002',
        name: 'Casa Fans',
        description: 'For the real ones.',
        image_url: 'https://i.imgur.com/plJWpL3.png',
        invite_code: 'CASAFANS',
        created_by: 'user-2',
        created_at: new Date().toISOString(),
        season_start_date: '2025-08-01T00:00:00.000Z',
        season_end_date: '2026-05-30T00:00:00.000Z',
    }
];
