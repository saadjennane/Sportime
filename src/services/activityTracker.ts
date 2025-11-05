/**
 * Activity Tracker Service
 *
 * Tracks user activity in real-time to enable accurate XP calculations.
 * Automatically updates last_active_date and activity logs in Supabase.
 *
 * Usage:
 *   import { trackActivity, trackPrediction, trackBet } from './services/activityTracker';
 *
 *   // General activity
 *   await trackActivity(userId);
 *
 *   // Specific actions
 *   await trackPrediction(userId, isCorrect);
 *   await trackBet(userId, betAmount, winAmount, odds);
 */

import { supabase } from './supabase';

// Debounce map to prevent excessive DB calls
const activityDebounceMap = new Map<string, number>();
const DEBOUNCE_DELAY = 5 * 60 * 1000; // 5 minutes

function logTrackerError(context: string, error: any) {
  if (!error) return;
  if (error.code === '42501' || error.code === 'PGRST116') {
    // RLS / no rows — safe to ignore for guest users
    return;
  }
  console.error(`[ActivityTracker] Error ${context}:`, error);
}

/**
 * Validate if a string is a valid UUID v4 format
 */
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Check if we should debounce this activity call
 */
function shouldDebounce(userId: string, activityType: string): boolean {
  const key = `${userId}:${activityType}`;
  const lastCall = activityDebounceMap.get(key);
  const now = Date.now();

  if (lastCall && now - lastCall < DEBOUNCE_DELAY) {
    return true; // Debounce this call
  }

  activityDebounceMap.set(key, now);
  return false;
}

/**
 * Track general user activity
 * Updates last_active_date and increments daily activity counter
 */
export async function trackActivity(userId: string): Promise<void> {
  if (!userId || !isValidUUID(userId)) return;

  // Debounce to avoid excessive calls
  if (shouldDebounce(userId, 'general')) {
    return;
  }

  try {
    const { error } = await supabase.rpc('track_user_activity', {
      p_user_id: userId,
    });

    logTrackerError('tracking activity', error);
  } catch (err) {
    console.error('[ActivityTracker] Exception tracking activity:', err);
  }
}

/**
 * Track a prediction made by the user
 */
export async function trackPrediction(
  userId: string,
  isCorrect?: boolean | null
): Promise<void> {
  if (!userId || !isValidUUID(userId)) return;

  try {
    const { error } = await supabase.rpc('track_prediction', {
      p_user_id: userId,
      p_is_correct: isCorrect,
    });

    logTrackerError('tracking prediction', error);
  } catch (err) {
    console.error('[ActivityTracker] Exception tracking prediction:', err);
  }
}

/**
 * Track a bet placed by the user
 */
export async function trackBet(
  userId: string,
  betAmount: number,
  winAmount: number = 0,
  odds: number = 0
): Promise<void> {
  if (!userId || !isValidUUID(userId)) return;

  try {
    const { error } = await supabase.rpc('track_bet', {
      p_user_id: userId,
      p_bet_amount: betAmount,
      p_win_amount: winAmount,
      p_odds: odds,
    });

    logTrackerError('tracking bet', error);
  } catch (err) {
    console.error('[ActivityTracker] Exception tracking bet:', err);
  }
}

/**
 * Track a fantasy game played
 */
export async function trackFantasyGame(
  userId: string,
  score: number
): Promise<void> {
  if (!userId || !isValidUUID(userId)) return;

  try {
    const { error } = await supabase.rpc('track_fantasy_game', {
      p_user_id: userId,
      p_score: score,
    });

    logTrackerError('tracking fantasy game', error);
  } catch (err) {
    console.error('[ActivityTracker] Exception tracking fantasy game:', err);
  }
}

/**
 * Track a game type played (for variety metric)
 */
export async function trackGameType(
  userId: string,
  gameType: string
): Promise<void> {
  if (!userId || !isValidUUID(userId)) return;

  try {
    const { error } = await supabase.rpc('track_game_type', {
      p_user_id: userId,
      p_game_type: gameType,
    });

    logTrackerError('tracking game type', error);
  } catch (err) {
    console.error('[ActivityTracker] Exception tracking game type:', err);
  }
}

/**
 * Get user's weekly activity summary
 */
export async function getUserWeeklyActivity(userId: string) {
  if (!userId || !isValidUUID(userId)) return null;

  try {
    const { data, error } = await supabase
      .from('user_activity_logs')
      .select('*')
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      console.error('[ActivityTracker] Error fetching activity:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('[ActivityTracker] Exception fetching activity:', err);
    return null;
  }
}

/**
 * Get user progression summary including XP, level, and decay status
 */
export async function getUserProgressionSummary(userId: string) {
  if (!userId || !isValidUUID(userId)) return null;

  try {
    const { data, error } = await supabase.rpc('get_user_progression_summary', {
      p_user_id: userId,
    });

    if (error) {
      console.error('[ActivityTracker] Error fetching progression summary:', error);
      return null;
    }

    return data && data.length > 0 ? data[0] : null;
  } catch (err) {
    console.error('[ActivityTracker] Exception fetching progression summary:', err);
    return null;
  }
}
