/**
 * Swipe Game Features
 *
 * Export all swipe game store, selectors, actions, and utilities
 */

// Store
export { useSwipeStore } from '../../store/swipeStore';

// Selectors (with shallow equality)
export {
  useSwipeGameData,
  useSwipePredictionsData,
  useSwipeLeaderboardData,
  useSwipeLoadingStates,
  useSwipeError,
  useSwipeContext,
  useHasPrediction,
  usePredictionFor,
} from './useSwipeSelectors';

// Actions (stable references)
export {
  useSwipeActions,
  useSavePrediction,
  useSelectMatchday,
  useInitSwipe,
  useResetSwipe,
} from './useSwipeActions';

// Mappers and utilities
export * from './swipeMappers';

// Service (re-export for convenience)
export * as swipeService from '../../services/swipeGameService';
