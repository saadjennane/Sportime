import { UserChallengeEntry } from '../types';

export const mockUserChallengeEntries: UserChallengeEntry[] = [
  {
    user_id: 'user-1',
    challengeId: 'challenge-1',
    entryMethod: 'coins',
    dailyEntries: [
      {
        day: 1,
        bets: [
          { challengeMatchId: 'cm-1-1', prediction: 'teamA', amount: 500 },
          { challengeMatchId: 'cm-1-2', prediction: 'draw', amount: 500 },
        ],
        booster: { type: 'x2', matchId: 'cm-1-1' },
      },
      {
        day: 2,
        bets: [
          { challengeMatchId: 'cm-1-3', prediction: 'teamA', amount: 1000 },
        ],
      },
    ],
  },
  {
    user_id: 'user-1',
    challengeId: 'challenge-3',
    entryMethod: 'coins',
    dailyEntries: [
      {
        day: 1,
        bets: [
          { challengeMatchId: 'cm-3-1', prediction: 'draw', amount: 1000 },
        ],
      },
      {
        day: 2,
        bets: [
          { challengeMatchId: 'cm-3-2', prediction: 'teamB', amount: 1000 },
        ],
      },
    ],
  },
];
