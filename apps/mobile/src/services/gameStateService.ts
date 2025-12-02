/**
 * Game State Service
 * Centralized logic for determining betting game state, categorization, and CTA
 */

import { parseISO, isValid } from 'date-fns';
import type { SportimeGame, UserChallengeEntry, SwipeMatch } from '../types';

// ============================================================================
// Types
// ============================================================================

export type BettingGameCategory = 'active' | 'awaiting' | 'finished';
export type BettingGameCTA = 'PLACE_BETS' | 'EDIT_BETS' | 'VIEW_GAME' | 'VIEW_RESULTS';

export interface MatchdayInfo {
  day: number;
  firstKickoff: Date;
  allMatchesFinished: boolean;
  matchCount: number;
}

export interface BettingGameState {
  /** Current matchday the user should focus on */
  currentMatchday: MatchdayInfo | null;
  /** Next matchday available after current finishes */
  nextMatchday: MatchdayInfo | null;
  /** Which section to display the game in */
  category: BettingGameCategory;
  /** Call-to-action button text */
  cta: BettingGameCTA;
  /** Deadline for placing bets (first kickoff of current matchday) */
  deadline: Date | null;
  /** Whether bets can be edited */
  isEditable: boolean;
  /** Whether there are results available from previous matchdays */
  hasAvailableResults: boolean;
}

// ============================================================================
// Safe Date Parsing
// ============================================================================

/**
 * Safely parse an ISO date string, returning null if invalid
 */
export function safeParseISO(dateString?: string | null): Date | null {
  if (!dateString) return null;
  try {
    const date = parseISO(dateString);
    return isValid(date) ? date : null;
  } catch {
    return null;
  }
}

/**
 * Safely create a Date from a string, returning null if invalid
 */
export function safeNewDate(dateString?: string | null): Date | null {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

// ============================================================================
// Match Grouping by Day
// ============================================================================

interface MatchWithDay extends SwipeMatch {
  day?: number;
}

/**
 * Group matches by day/matchday number
 * For betting games, matches should have a `day` property (from ChallengeMatch mapping)
 */
function groupMatchesByDay(matches: MatchWithDay[]): Map<number, MatchWithDay[]> {
  const groups = new Map<number, MatchWithDay[]>();

  matches.forEach((match, index) => {
    // Use match.day if available, otherwise infer from index (fallback)
    const day = (match as any).day ?? index + 1;
    if (!groups.has(day)) {
      groups.set(day, []);
    }
    groups.get(day)!.push(match);
  });

  return groups;
}

/**
 * Get matchday info for a specific day
 */
function getMatchdayInfo(day: number, matches: MatchWithDay[]): MatchdayInfo | null {
  if (matches.length === 0) return null;

  const kickoffTimes = matches
    .map(m => safeNewDate(m.kickoffTime))
    .filter((d): d is Date => d !== null);

  if (kickoffTimes.length === 0) return null;

  const firstKickoff = new Date(Math.min(...kickoffTimes.map(d => d.getTime())));
  const allMatchesFinished = matches.every(m => m.result !== undefined);

  return {
    day,
    firstKickoff,
    allMatchesFinished,
    matchCount: matches.length,
  };
}

// ============================================================================
// Main State Calculator
// ============================================================================

/**
 * Calculate the complete state of a betting game
 *
 * Logic:
 * 1. Group matches by matchday
 * 2. Find current matchday (first one not fully finished, or has upcoming matches)
 * 3. Determine category and CTA based on:
 *    - Premier match pas commencé → Play Now (Place/Edit bets)
 *    - Premier match commencé, matchs en cours → Awaiting Results (View Game)
 *    - Tous matchs terminés → Play Now (View Results) puis prochain matchday
 */
export function calculateBettingGameState(
  game: SportimeGame,
  userEntry: UserChallengeEntry | undefined,
  now: Date = new Date()
): BettingGameState {
  const matches = (game.matches || []) as MatchWithDay[];

  // No matches - game is finished or not set up
  if (matches.length === 0) {
    return {
      currentMatchday: null,
      nextMatchday: null,
      category: 'finished',
      cta: 'VIEW_RESULTS',
      deadline: null,
      isEditable: false,
      hasAvailableResults: false,
    };
  }

  // Group matches by day
  const matchesByDay = groupMatchesByDay(matches);
  const sortedDays = Array.from(matchesByDay.keys()).sort((a, b) => a - b);

  // Build matchday infos
  const matchdayInfos: MatchdayInfo[] = [];
  for (const day of sortedDays) {
    const dayMatches = matchesByDay.get(day)!;
    const info = getMatchdayInfo(day, dayMatches);
    if (info) matchdayInfos.push(info);
  }

  if (matchdayInfos.length === 0) {
    return {
      currentMatchday: null,
      nextMatchday: null,
      category: 'finished',
      cta: 'VIEW_RESULTS',
      deadline: null,
      isEditable: false,
      hasAvailableResults: false,
    };
  }

  // Find current matchday:
  // - First matchday where first match hasn't started yet, OR
  // - First matchday where matches are not all finished (live), OR
  // - Last matchday if all are finished (to show results)
  let currentMatchdayIndex = -1;

  for (let i = 0; i < matchdayInfos.length; i++) {
    const info = matchdayInfos[i];
    const hasStarted = info.firstKickoff <= now;

    if (!hasStarted) {
      // Found upcoming matchday
      currentMatchdayIndex = i;
      break;
    }

    if (hasStarted && !info.allMatchesFinished) {
      // Found live matchday
      currentMatchdayIndex = i;
      break;
    }

    if (hasStarted && info.allMatchesFinished) {
      // This matchday is finished - check if there's a next one
      if (i < matchdayInfos.length - 1) {
        // There's a next matchday - check if it's upcoming
        const nextInfo = matchdayInfos[i + 1];
        const nextHasStarted = nextInfo.firstKickoff <= now;

        if (!nextHasStarted) {
          // Current matchday finished, next is upcoming
          // Show "View Results" for current, then user can proceed to next
          currentMatchdayIndex = i;
          break;
        }
        // Otherwise continue to next matchday
      } else {
        // This is the last matchday and it's finished
        currentMatchdayIndex = i;
      }
    }
  }

  // If no matchday found, use the last one
  if (currentMatchdayIndex === -1) {
    currentMatchdayIndex = matchdayInfos.length - 1;
  }

  const currentMatchday = matchdayInfos[currentMatchdayIndex];
  const nextMatchday = currentMatchdayIndex < matchdayInfos.length - 1
    ? matchdayInfos[currentMatchdayIndex + 1]
    : null;

  // Determine state based on current matchday
  const hasStarted = currentMatchday.firstKickoff <= now;
  const allFinished = currentMatchday.allMatchesFinished;

  // Check if user has bets for current matchday
  const dailyEntry = userEntry?.dailyEntries.find(d => d.day === currentMatchday.day);
  const hasUserBets = (dailyEntry?.bets?.length || 0) > 0;

  // Check if there are results available from previous matchdays
  // hasAvailableResults = true if any matchday before the current one is fully finished
  const hasAvailableResults = currentMatchdayIndex > 0 &&
    matchdayInfos.slice(0, currentMatchdayIndex).some(m => m.allMatchesFinished);

  // State 1: Premier match pas encore commencé
  if (!hasStarted) {
    return {
      currentMatchday,
      nextMatchday,
      category: 'active',
      cta: hasUserBets ? 'EDIT_BETS' : 'PLACE_BETS',
      deadline: currentMatchday.firstKickoff,
      isEditable: true,
      hasAvailableResults,
    };
  }

  // State 2: Premier match commencé mais pas tous terminés (live)
  if (hasStarted && !allFinished) {
    return {
      currentMatchday,
      nextMatchday,
      category: 'awaiting',
      cta: 'VIEW_GAME',
      deadline: null,
      isEditable: false,
      hasAvailableResults,
    };
  }

  // State 3: Tous les matchs du matchday sont terminés
  // → Show "View Results" in Play Now section
  // After viewing, if there's a next matchday, it becomes available
  if (hasStarted && allFinished) {
    // If there's a next matchday that hasn't started, show it
    if (nextMatchday && nextMatchday.firstKickoff > now) {
      // Check if user has bets for next matchday
      const nextDailyEntry = userEntry?.dailyEntries.find(d => d.day === nextMatchday.day);
      const hasNextBets = (nextDailyEntry?.bets?.length || 0) > 0;

      return {
        currentMatchday: nextMatchday,
        nextMatchday: currentMatchdayIndex + 2 < matchdayInfos.length
          ? matchdayInfos[currentMatchdayIndex + 2]
          : null,
        category: 'active',
        cta: hasNextBets ? 'EDIT_BETS' : 'PLACE_BETS',
        deadline: nextMatchday.firstKickoff,
        isEditable: true,
        // Previous matchday just finished, so results are available
        hasAvailableResults: true,
      };
    }

    // All matchdays finished or next is also live/finished
    return {
      currentMatchday,
      nextMatchday,
      category: 'active', // Stay in Play Now for "View Results"
      cta: 'VIEW_RESULTS',
      deadline: null,
      isEditable: false,
      hasAvailableResults,
    };
  }

  // Fallback
  return {
    currentMatchday,
    nextMatchday,
    category: 'finished',
    cta: 'VIEW_RESULTS',
    deadline: null,
    isEditable: false,
    hasAvailableResults: false,
  };
}

// ============================================================================
// Helper for checking if game is fully finished
// ============================================================================

/**
 * Check if all matches in a game have results
 */
export function areAllMatchesFinished(game: SportimeGame): boolean {
  const matches = game.matches || [];
  if (matches.length === 0) return true;
  return matches.every(m => m.result !== undefined);
}

/**
 * Get deadline for a betting game (first kickoff time of current playable matchday)
 */
export function getBettingGameDeadline(
  game: SportimeGame,
  userEntry: UserChallengeEntry | undefined,
  now: Date = new Date()
): Date | null {
  const state = calculateBettingGameState(game, userEntry, now);
  return state.deadline;
}
