/**
 * Swipe Game Selectors
 *
 * Optimized selectors for the swipe store that prevent unnecessary re-renders.
 * Uses Zustand's shallow comparison to detect changes.
 */

import { useSwipeStore } from '../../store/swipeStore';
import { shallow } from 'zustand/shallow';

/**
 * Select game data (challenge, matchdays, current matchday, matches)
 */
export function useSwipeGameData() {
  return useSwipeStore(
    state => ({
      challenge: state.challenge,
      matchdays: state.matchdays,
      currentMatchday: state.currentMatchday,
      matches: state.matches,
      matchesByDate: state.matchesByDate,
      isLoading: state.isLoadingGame,
      error: state.error,
      hasJoined: state.hasJoined,
    }),
    shallow
  );
}

/**
 * Select predictions data
 */
export function useSwipePredictionsData() {
  return useSwipeStore(
    state => ({
      predictions: state.predictions,
      predictionRecords: state.predictionRecords,
      isLoading: state.isLoadingPredictions,
      isSaving: state.isSaving,
    }),
    shallow
  );
}

/**
 * Select leaderboard data
 */
export function useSwipeLeaderboardData() {
  return useSwipeStore(
    state => ({
      leaderboard: state.leaderboard,
      matchdayLeaderboard: state.matchdayLeaderboard,
      userPosition: state.userPosition,
      userStats: state.userStats,
      isLoading: state.isLoadingLeaderboard,
    }),
    shallow
  );
}

/**
 * Select loading states only (lightweight selector)
 */
export function useSwipeLoadingStates() {
  return useSwipeStore(
    state => ({
      isLoadingGame: state.isLoadingGame,
      isLoadingPredictions: state.isLoadingPredictions,
      isLoadingLeaderboard: state.isLoadingLeaderboard,
      isSaving: state.isSaving,
    }),
    shallow
  );
}

/**
 * Select error state only
 */
export function useSwipeError() {
  return useSwipeStore(state => state.error);
}

/**
 * Select challenge ID and user ID (context)
 */
export function useSwipeContext() {
  return useSwipeStore(
    state => ({
      challengeId: state.challengeId,
      userId: state.userId,
    }),
    shallow
  );
}

/**
 * Check if a specific fixture has a prediction
 */
export function useHasPrediction(fixtureId: string): boolean {
  return useSwipeStore(state =>
    state.predictions.some(p => p.matchId === fixtureId)
  );
}

/**
 * Get prediction for a specific fixture
 */
export function usePredictionFor(fixtureId: string) {
  return useSwipeStore(state =>
    state.predictions.find(p => p.matchId === fixtureId)
  );
}
