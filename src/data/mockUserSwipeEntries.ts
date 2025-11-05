import { UserSwipeEntry } from '../types';

export const mockUserSwipeEntries: UserSwipeEntry[] = [
  {
    user_id: 'user-1',
    matchDayId: 'swipe-1',
    predictions: [],
    submitted_at: null,
  },
  {
    user_id: 'user-1',
    matchDayId: 'swipe-2',
    predictions: [
      { matchId: 'sm-uuid-1', prediction: 'teamA' },
      { matchId: 'sm-uuid-2', prediction: 'draw' },
      { matchId: 'sm-uuid-3', prediction: 'teamB' },
      { matchId: 'sm-uuid-4', prediction: 'teamA' },
      { matchId: 'sm-uuid-5', prediction: 'teamB' },
    ],
    submitted_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];
