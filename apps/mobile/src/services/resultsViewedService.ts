/**
 * Service to track which games' results have been viewed by the user.
 * Uses localStorage to persist the state across sessions.
 *
 * A game moves to "Past Games" only when:
 * 1. All matches have results
 * 2. AND the user has clicked "View Results"
 */

const STORAGE_KEY = 'sportime_results_viewed';

/**
 * Get the Set of game IDs whose results have been viewed
 */
export function getViewedResults(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

/**
 * Mark a game's results as viewed
 */
export function markResultsViewed(gameId: string): void {
  const viewed = getViewedResults();
  viewed.add(gameId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...viewed]));
}

/**
 * Check if a game's results have been viewed
 */
export function hasViewedResults(gameId: string): boolean {
  return getViewedResults().has(gameId);
}

/**
 * Clear all viewed results (useful for testing/debugging)
 */
export function clearViewedResults(): void {
  localStorage.removeItem(STORAGE_KEY);
}
