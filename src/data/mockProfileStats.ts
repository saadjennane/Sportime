import { UserProfileStatsData } from '../types';

export const mockStats: UserProfileStatsData = {
  username: "SJ",
  predictionsTotal: 500,
  predictionsCorrect: 200,
  hotPerformanceIndex: 2.13, // average HPI over last 10 active days
  bestHotDay: { date: "2025-01-19", hpi: 2.85, correct: 10, total: 12 },
  streak: 3,
  averageBetCoins: 82,
  riskIndex: 7.8, // 1–10 scale (variance-based)
  gamesPlayed: 148,
  podiums: { gold: 4, silver: 6, bronze: 10 },
  trophies: 8,
  badges: ["Analyst", "Hot Streak", "Bold Player"],
  mostPlayedLeague: "La Liga",
  mostPlayedTeam: "Chelsea FC",
  favoriteGameType: "Prediction",
  last10DaysAccuracy: 0.73, // used for trend visualization
};
