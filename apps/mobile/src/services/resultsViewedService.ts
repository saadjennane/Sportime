/**
 * Service to track which games' results have been viewed by the user.
 * Stores in database (challenge_participants.results_viewed_at) for persistence
 * across sessions and devices. Falls back to localStorage if DB update fails.
 *
 * A game moves to "Past Games" only when:
 * 1. end_date has passed
 * 2. AND results_viewed_at is not null (user clicked "View Results")
 */

import { supabase } from './supabase'

const STORAGE_KEY = 'sportime_results_viewed'

/**
 * Get the Set of game IDs whose results have been viewed from localStorage (fallback)
 */
function getViewedResultsFromStorage(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? new Set(JSON.parse(stored)) : new Set()
  } catch {
    return new Set()
  }
}

/**
 * Save viewed results to localStorage (fallback)
 */
function saveViewedResultsToStorage(viewed: Set<string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...viewed]))
}

/**
 * Mark a game's results as viewed in the database
 */
export async function markResultsViewedInDB(
  userId: string,
  challengeId: string
): Promise<boolean> {
  if (!supabase) {
    // Fallback to localStorage
    const viewed = getViewedResultsFromStorage()
    viewed.add(challengeId)
    saveViewedResultsToStorage(viewed)
    return true
  }

  const { error } = await supabase
    .from('challenge_participants')
    .update({ results_viewed_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('challenge_id', challengeId)

  if (error) {
    console.error('[resultsViewedService] Failed to mark results viewed in DB:', error)
    // Fallback to localStorage
    const viewed = getViewedResultsFromStorage()
    viewed.add(challengeId)
    saveViewedResultsToStorage(viewed)
    return false
  }

  return true
}

/**
 * Check if results have been viewed from participant data
 */
export function hasViewedResultsFromParticipant(
  participants: Array<{ challenge_id: string; results_viewed_at: string | null }>,
  challengeId: string
): boolean {
  const entry = participants.find(p => p.challenge_id === challengeId)
  return entry?.results_viewed_at !== null && entry?.results_viewed_at !== undefined
}

// ============================================================================
// Legacy localStorage-based functions (kept for backwards compatibility)
// These will be used as fallback and for initial migration
// ============================================================================

/**
 * Get the Set of game IDs whose results have been viewed
 * @deprecated Use hasViewedResultsFromParticipant with DB data instead
 */
export function getViewedResults(): Set<string> {
  return getViewedResultsFromStorage()
}

/**
 * Mark a game's results as viewed (localStorage only - use markResultsViewedInDB instead)
 * @deprecated Use markResultsViewedInDB instead
 */
export function markResultsViewed(gameId: string): void {
  const viewed = getViewedResultsFromStorage()
  viewed.add(gameId)
  saveViewedResultsToStorage(viewed)
}

/**
 * Check if a game's results have been viewed (localStorage only)
 * @deprecated Use hasViewedResultsFromParticipant with DB data instead
 */
export function hasViewedResults(gameId: string): boolean {
  return getViewedResultsFromStorage().has(gameId)
}

/**
 * Clear all viewed results (useful for testing/debugging)
 */
export function clearViewedResults(): void {
  localStorage.removeItem(STORAGE_KEY)
}
