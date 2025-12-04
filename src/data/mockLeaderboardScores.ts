// This file simulates a database table that would store scores for each user per gameweek.
// This makes it easy to calculate leaderboards based on dynamic date ranges.

type UserScoresByGameWeek = { [gameWeekId: string]: number };
type GameScoresByUser = { [userId: string]: UserScoresByGameWeek };

interface MockScores {
  [gameId: string]: GameScoresByUser;
}

export const mockScores: MockScores = {
  "fantasy-1": {
    "user-1": {
      "gw-past-4": 110,
      "gw-past-3": 95,
      "gw-past-2": 130,
      "gw-past-1": 105,
      "gw0": 125,
      "gw1": 140,
    },
    "user-2": {
      "gw-past-4": 90,
      "gw-past-3": 115,
      "gw-past-2": 100,
      "gw-past-1": 120,
      "gw0": 110,
      "gw1": 130,
    },
    "user-3": {
      "gw-past-4": 100,
      "gw-past-3": 105,
      "gw-past-2": 110,
      "gw-past-1": 115,
      "gw0": 135,
      "gw1": 120,
    },
  },
  // Add scores for other games like 'swipe-1' if needed
};
