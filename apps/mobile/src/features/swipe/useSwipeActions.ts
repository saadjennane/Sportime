/**
 * Swipe Game Actions Hook
 *
 * Provides stable action references that NEVER change.
 * This is the key to preventing re-render cascades.
 */

import { useSwipeStore } from '../../store/swipeStore';
import { shallow } from 'zustand/shallow';

/**
 * Get all swipe actions with stable references.
 *
 * These functions are created once in the store and never recreated,
 * so they won't cause re-renders when used in dependencies.
 */
export function useSwipeActions() {
  return useSwipeStore(
    state => ({
      initSwipe: state.initSwipe,
      selectMatchday: state.selectMatchday,
      savePrediction: state.savePrediction,
      loadLeaderboard: state.loadLeaderboard,
      loadMatchdayLeaderboard: state.loadMatchdayLeaderboard,
      joinGame: state.joinGame,
      refresh: state.refresh,
      reset: state.reset,
    }),
    shallow
  );
}

/**
 * Get only the save prediction action (for SwipeCard component)
 */
export function useSavePrediction() {
  return useSwipeStore(state => state.savePrediction);
}

/**
 * Get only the select matchday action
 */
export function useSelectMatchday() {
  return useSwipeStore(state => state.selectMatchday);
}

/**
 * Get only the init action
 */
export function useInitSwipe() {
  return useSwipeStore(state => state.initSwipe);
}

/**
 * Get only the reset action (for cleanup)
 */
export function useResetSwipe() {
  return useSwipeStore(state => state.reset);
}
