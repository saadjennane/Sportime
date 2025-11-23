import { mockMatchStats } from '../data/mockMatchStats';
import { MatchStats } from '../types';

export const getMatchStats = (matchId: string): Promise<MatchStats | null> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // In a real app, you'd fetch based on matchId.
      // For this mock, we always return the same data if the ID matches.
      if (matchId === mockMatchStats.matchId) {
        resolve(mockMatchStats);
      } else {
        // Return null for other matches to show empty/error states
        resolve(null);
      }
    }, 500); // Simulate network delay
  });
};
