/**
 * Game State Service
 * Centralized logic for determining game state, categorization, and CTA
 * Supports ALL game types (betting, prediction, fantasy) and ALL period types (matchdays, calendar)
 */

import { parseISO, isValid } from 'date-fns';
import type { SportimeGame, UserChallengeEntry, SwipeMatch, UserFantasyTeam } from '../types';

// ============================================================================
// Types
// ============================================================================

export type BettingGameCategory = 'active' | 'awaiting' | 'finished';
export type BettingGameCTA = 'PLACE_BETS' | 'EDIT_BETS' | 'VIEW_GAME' | 'VIEW_RESULTS';

// New unified types for ALL game types
export type GameCategory = 'active' | 'awaiting' | 'finished';
export type GameCTA = 'PLACE_BETS' | 'EDIT_BETS' | 'MAKE_PREDICTIONS' | 'SELECT_TEAM' | 'COMPLETE_TEAM' | 'VIEW_GAME' | 'VIEW_RESULTS';

export interface GameState {
  /** Which section to display the game in */
  category: GameCategory;
  /** Call-to-action button text */
  cta: GameCTA;
  /** Deadline for placing bets/predictions (first kickoff of current group) */
  deadline: Date | null;
  /** Current group key ("3" for matchdays, "2025-12-05" for calendar) */
  currentGroupKey: string | null;
  /** Whether there's a next group after the current one */
  hasNextGroup: boolean;
}

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
 * Parse a date-only string (YYYY-MM-DD) as end of day in LOCAL time.
 * This avoids timezone issues where "2025-12-06" parsed as UTC midnight
 * becomes Dec 5 in western timezones.
 *
 * Use this when comparing end_date to determine if a game has finished.
 */
export function parseEndDateLocal(dateString?: string | null): Date | null {
  if (!dateString) return null;
  try {
    // Extract YYYY-MM-DD part (handles both "2025-12-06" and "2025-12-06T00:00:00Z")
    const datePart = dateString.split('T')[0];
    const [year, month, day] = datePart.split('-').map(Number);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    // Create date at end of day in LOCAL time
    return new Date(year, month - 1, day, 23, 59, 59, 999);
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
  now: Date = new Date(),
  endDate?: string | null
): BettingGameState {
  // Check if ALL matches in the game are finished (have results)
  const allGameMatchesFinished = areAllMatchesFinished(game);
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
          // Use the NEXT matchday so deadline shows the correct upcoming date
          currentMatchdayIndex = i + 1;
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
  // Matchday en cours = TOUJOURS Awaiting Results (même si prochain matchday existe)
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
  if (hasStarted && allFinished) {
    // If there's a next matchday that hasn't started, show it in Play Now
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

    // No next matchday available - check if ALL matches in the game are finished
    if (allGameMatchesFinished) {
      // All matches finished → View Results (will go to Past Games after viewing)
      return {
        currentMatchday,
        nextMatchday,
        category: 'active',
        cta: 'VIEW_RESULTS',
        deadline: null,
        isEditable: false,
        hasAvailableResults,
      };
    }

    // Not all matches finished yet → stay in Awaiting Results with View Game
    return {
      currentMatchday,
      nextMatchday,
      category: 'awaiting',
      cta: 'VIEW_GAME',
      deadline: null,
      isEditable: false,
      hasAvailableResults: true,
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
  const state = calculateBettingGameState(game, userEntry, now, game.end_date);
  return state.deadline;
}

// ============================================================================
// UNIFIED GAME STATE CALCULATOR
// Supports ALL game types (betting, prediction, fantasy) and ALL period types
// ============================================================================

/**
 * Group matches by period_type
 * - For 'calendar': Group by date (YYYY-MM-DD)
 * - For 'matchdays': Group by day/matchday number
 */
function groupMatchesByPeriodType(
  matches: SwipeMatch[],
  periodType: string
): Map<string, SwipeMatch[]> {
  const groups = new Map<string, SwipeMatch[]>();

  for (const match of matches) {
    let key: string;

    if (periodType === 'calendar') {
      // Group by date (YYYY-MM-DD)
      key = match.kickoffTime?.split('T')[0] ?? 'unknown';
    } else {
      // Group by matchday number
      key = String((match as any).day ?? 1);
    }

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(match);
  }

  return groups;
}

/**
 * Check if a group is "play complete" (no more actions possible)
 * - For prediction games: complete when all matches have STARTED (can't predict anymore)
 * - For betting/fantasy: complete when all matches have RESULTS (FT)
 */
function isGroupPlayComplete(
  matches: SwipeMatch[],
  gameType: string,
  now: Date
): boolean {
  if (gameType === 'prediction') {
    // For prediction: complete = all matches have started (kickoff <= now)
    return matches.every(m => {
      const kickoff = m.kickoffTime ? new Date(m.kickoffTime) : null;
      return kickoff && kickoff <= now;
    });
  }
  // For betting/fantasy: complete = all matches have a result
  return matches.every(m => m.result !== undefined);
}

/**
 * Get the default CTA based on game type
 */
function getDefaultCTA(
  gameType: string,
  userEntry?: UserChallengeEntry,
  userFantasyTeam?: UserFantasyTeam
): GameCTA {
  switch (gameType?.toLowerCase()) {
    case 'betting':
      // Check if user has bets
      const hasBets = userEntry?.dailyEntries?.some(d => (d.bets?.length || 0) > 0);
      return hasBets ? 'EDIT_BETS' : 'PLACE_BETS';
    case 'prediction':
      return 'MAKE_PREDICTIONS';
    case 'fantasy':
    case 'fantasy-live':
      // Check if user has a team
      if (!userFantasyTeam) return 'SELECT_TEAM';
      // Check if team is complete (11 starters)
      const hasCompleteTeam = userFantasyTeam.starters?.length === 11;
      return hasCompleteTeam ? 'VIEW_GAME' : 'COMPLETE_TEAM';
    default:
      return 'VIEW_GAME';
  }
}

/**
 * Calculate the complete state of ANY game type (betting, prediction, fantasy)
 * Works with BOTH period types (matchdays and calendar)
 *
 * Logic:
 * 1. Group matches by period_type (calendar = by date, matchdays = by day number)
 * 2. Find the next playable group (first group not fully finished)
 * 3. Determine category and CTA based on:
 *    - First match not started → Play Now (Place bets / Make predictions / Select team)
 *    - First match started but not all finished → Awaiting Results (View Game)
 *    - All finished + next group exists → Play Now (for next group)
 *    - All finished + no next group → Finished (View Results)
 */
export function calculateGameState(
  game: SportimeGame,
  userEntry: UserChallengeEntry | undefined,
  userFantasyTeam: UserFantasyTeam | undefined,
  now: Date = new Date()
): GameState {
  const periodType = game.period_type ?? 'matchdays';
  const gameType = game.game_type ?? 'betting';
  const matches = game.matches || [];

  // Game is finished when ALL matches have results (completed)
  if (areAllMatchesFinished(game) && matches.length > 0) {
    return {
      category: 'finished',
      cta: 'VIEW_RESULTS',
      deadline: null,
      currentGroupKey: null,
      hasNextGroup: false,
    };
  }

  // No matches → active (waiting for config or just joined)
  if (matches.length === 0) {
    return {
      category: 'active',
      cta: getDefaultCTA(gameType, userEntry, userFantasyTeam),
      deadline: null,
      currentGroupKey: null,
      hasNextGroup: false,
    };
  }

  // Group matches by period_type
  const groups = groupMatchesByPeriodType(matches, periodType);

  // Sort group keys properly:
  // - For matchdays: sort numerically (1, 2, 3...)
  // - For calendar: sort alphabetically (2025-12-04, 2025-12-05...)
  const sortedGroupKeys = Array.from(groups.keys()).sort((a, b) => {
    if (periodType === 'calendar') {
      return a.localeCompare(b);
    }
    return parseInt(a) - parseInt(b);
  });

  // Find the next playable group (first group not fully finished)
  let currentGroupKey: string | null = null;
  let nextGroupKey: string | null = null;

  for (let i = 0; i < sortedGroupKeys.length; i++) {
    const key = sortedGroupKeys[i];
    const groupMatches = groups.get(key)!;
    const allFinished = isGroupPlayComplete(groupMatches, gameType, now);

    if (!allFinished) {
      currentGroupKey = key;
      nextGroupKey = sortedGroupKeys[i + 1] ?? null;
      break;
    }
  }

  // If all groups are finished, use the last one
  if (!currentGroupKey) {
    currentGroupKey = sortedGroupKeys[sortedGroupKeys.length - 1];
  }

  const currentMatches = groups.get(currentGroupKey!)!;
  const kickoffTimes = currentMatches
    .map(m => m.kickoffTime ? new Date(m.kickoffTime).getTime() : null)
    .filter((t): t is number => t !== null);

  const firstKickoff = kickoffTimes.length > 0 ? Math.min(...kickoffTimes) : null;
  const hasStarted = firstKickoff ? firstKickoff <= now.getTime() : false;
  const allFinished = isGroupPlayComplete(currentMatches, gameType, now);

  // State 1: First match not started → active
  if (!hasStarted) {
    return {
      category: 'active',
      cta: getDefaultCTA(gameType, userEntry, userFantasyTeam),
      deadline: firstKickoff ? new Date(firstKickoff) : null,
      currentGroupKey,
      hasNextGroup: !!nextGroupKey,
    };
  }

  // State 2: Matches in progress (started but not all finished) → awaiting
  if (hasStarted && !allFinished) {
    return {
      category: 'awaiting',
      cta: 'VIEW_GAME',
      deadline: null,
      currentGroupKey,
      hasNextGroup: !!nextGroupKey,
    };
  }

  // State 3: All finished - check if there's a next group
  if (hasStarted && allFinished && nextGroupKey) {
    const nextMatches = groups.get(nextGroupKey)!;
    const nextKickoffTimes = nextMatches
      .map(m => m.kickoffTime ? new Date(m.kickoffTime).getTime() : null)
      .filter((t): t is number => t !== null);
    const nextFirstKickoff = nextKickoffTimes.length > 0 ? Math.min(...nextKickoffTimes) : null;

    // Check if next group has started
    const nextHasStarted = nextFirstKickoff ? nextFirstKickoff <= now.getTime() : false;

    if (nextHasStarted) {
      // Next group has started - check if it's finished
      const nextAllFinished = isGroupPlayComplete(nextMatches, gameType, now);
      if (!nextAllFinished) {
        // Next group is in progress
        return {
          category: 'awaiting',
          cta: 'VIEW_GAME',
          deadline: null,
          currentGroupKey: nextGroupKey,
          hasNextGroup: sortedGroupKeys.indexOf(nextGroupKey) < sortedGroupKeys.length - 1,
        };
      }
      // If next group is also finished, continue looking for a playable group
      // This is handled by the loop above
    }

    // Next group hasn't started yet → active (for next group)
    return {
      category: 'active',
      cta: getDefaultCTA(gameType, userEntry, userFantasyTeam),
      deadline: nextFirstKickoff ? new Date(nextFirstKickoff) : null,
      currentGroupKey: nextGroupKey,
      hasNextGroup: sortedGroupKeys.indexOf(nextGroupKey) < sortedGroupKeys.length - 1,
    };
  }

  // All finished, no next group → check end_date
  // If end_date not passed, stay in awaiting (game still technically active)
  if (!endDate || endDate >= now) {
    return {
      category: 'awaiting',
      cta: 'VIEW_GAME',
      deadline: null,
      currentGroupKey,
      hasNextGroup: false,
    };
  }

  // All finished + end_date passed → finished
  return {
    category: 'finished',
    cta: 'VIEW_RESULTS',
    deadline: null,
    currentGroupKey,
    hasNextGroup: false,
  };
}

/**
 * Get deadline for ANY game type (betting, prediction, fantasy)
 * Uses the unified calculateGameState function
 */
export function getGameDeadline(
  game: SportimeGame,
  userEntry: UserChallengeEntry | undefined,
  userFantasyTeam: UserFantasyTeam | undefined,
  now: Date = new Date()
): Date | null {
  const state = calculateGameState(game, userEntry, userFantasyTeam, now);
  return state.deadline;
}
