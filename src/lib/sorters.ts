import { SwipeLeaderboardEntry } from '../types';

type SortableEntry = {
  total_points: number;
  nb_correct_picks: number;
  first_submission_ts: number;
  player_name: string;
};

export function sortByPredictionRanking(a: SortableEntry, b: SortableEntry): number {
  // 1. Total points (descending)
  if (b.total_points !== a.total_points) {
    return b.total_points - a.total_points;
  }

  // 2. Number of correct picks (descending)
  if (b.nb_correct_picks !== a.nb_correct_picks) {
    return b.nb_correct_picks - a.nb_correct_picks;
  }

  // 3. First submission timestamp (ascending)
  if (a.first_submission_ts !== b.first_submission_ts) {
    return a.first_submission_ts - b.first_submission_ts;
  }

  // 4. Player name (alphabetical fallback)
  return a.player_name.localeCompare(b.player_name);
}
