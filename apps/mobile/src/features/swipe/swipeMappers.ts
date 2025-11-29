/**
 * Swipe Game Data Mappers
 *
 * Transforms data from Supabase fixtures format to SwipeMatch format
 * and handles all data conversions for the swipe prediction game
 */

import type { SwipeMatch, SwipePredictionOutcome, SwipePrediction } from '../../types';
import type { SwipePredictionRecord } from '../../services/swipeGameService';

// ============================================================================
// TEAM EMOJI MAPPING
// ============================================================================

/**
 * Get emoji for a team
 * Falls back to country flag or default soccer ball
 */
export function getTeamEmoji(teamName: string, country?: string): string {
  // Team-specific emojis
  const teamEmojis: Record<string, string> = {
    // Premier League
    'Manchester City': '🔵',
    'Manchester United': '🔴',
    'Liverpool': '⚽',
    'Arsenal': '🔴',
    'Chelsea': '🔵',
    'Tottenham': '⚪',
    'Newcastle': '⚫',
    'Aston Villa': '🦁',

    // La Liga
    'Real Madrid': '👑',
    'Barcelona': '🔵',
    'Atletico Madrid': '🔴',
    'Sevilla': '⚪',
    'Valencia': '🦇',

    // Bundesliga
    'Bayern Munich': '🔴',
    'Borussia Dortmund': '🟡',
    'RB Leipzig': '⚪',

    // Serie A
    'Juventus': '⚫',
    'Inter': '🔵',
    'Milan': '🔴',
    'Napoli': '🔵',
    'Roma': '🟡',

    // Ligue 1
    'PSG': '🔵',
    'Paris Saint Germain': '🔵',
    'Paris Saint-Germain': '🔵',
    'Monaco': '🔴',
    'AS Monaco': '🔴',
    'Lyon': '⚪',
    'Olympique Lyonnais': '⚪',
    'Marseille': '⚪',
    'Olympique Marseille': '⚪',

    // Short names variations
    'Man City': '🔵',
    'Man United': '🔴',
  };

  // Check for exact team name match
  const exactMatch = teamEmojis[teamName];
  if (exactMatch) return exactMatch;

  // Check for partial match
  const partialMatch = Object.keys(teamEmojis).find(key =>
    teamName.toLowerCase().includes(key.toLowerCase()) ||
    key.toLowerCase().includes(teamName.toLowerCase())
  );
  if (partialMatch) return teamEmojis[partialMatch];

  // Country flags as fallback
  if (country) {
    const countryEmojis: Record<string, string> = {
      'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
      'Spain': '🇪🇸',
      'Germany': '🇩🇪',
      'Italy': '🇮🇹',
      'France': '🇫🇷',
      'Portugal': '🇵🇹',
      'Netherlands': '🇳🇱',
      'Belgium': '🇧🇪',
      'Brazil': '🇧🇷',
      'Argentina': '🇦🇷',
    };
    return countryEmojis[country] || '⚽';
  }

  // Default
  return '⚽';
}

// ============================================================================
// FIXTURE TO SWIPE MATCH CONVERSION
// ============================================================================

export interface FixtureData {
  id: string;
  api_id?: number;
  date: string;
  status: string;
  goals_home: number | null;
  goals_away: number | null;
  home: {
    id: string;
    name: string;
    logo?: string;
  };
  away: {
    id: string;
    name: string;
    logo?: string;
  };
  odds?: {
    home_win: number;
    draw: number;
    away_win: number;
    bookmaker_name?: string;
  }[];
}

/**
 * Determine match result from goals
 */
export function determineResult(
  goalsHome: number | null,
  goalsAway: number | null
): SwipePredictionOutcome | undefined {
  if (goalsHome === null || goalsAway === null) return undefined;

  if (goalsHome > goalsAway) return 'teamA'; // Home wins (teamA in swipe context)
  if (goalsHome < goalsAway) return 'teamB'; // Away wins (teamB in swipe context)
  return 'draw';
}

/**
 * Map prediction from database format to UI format
 */
export function mapPredictionToOutcome(prediction: 'home' | 'draw' | 'away'): SwipePredictionOutcome {
  switch (prediction) {
    case 'home': return 'teamA';
    case 'away': return 'teamB';
    case 'draw': return 'draw';
  }
}

/**
 * Map prediction from UI format to database format
 */
export function mapOutcomeToPrediction(outcome: SwipePredictionOutcome): 'home' | 'draw' | 'away' {
  switch (outcome) {
    case 'teamA': return 'home';
    case 'teamB': return 'away';
    case 'draw': return 'draw';
  }
}

/**
 * Get best odds from multiple bookmakers with reasonable defaults
 * Default odds (1.5, 3.5, 2.5) represent typical balanced match odds
 */
function getBestOdds(oddsArray?: Array<{ home_win: number; draw: number; away_win: number }>) {
  // Reasonable default odds if none available
  const DEFAULT_ODDS = { home: 1.5, draw: 3.5, away: 2.5 };

  if (!oddsArray || oddsArray.length === 0) {
    console.warn('No odds available, using defaults');
    return DEFAULT_ODDS;
  }

  // Take first odds (should be prioritized bookmaker from query)
  const odds = oddsArray[0];

  // Validate each odds value - must be > 1.0 to be realistic
  return {
    home: odds.home_win && odds.home_win > 1.0 ? odds.home_win : DEFAULT_ODDS.home,
    draw: odds.draw && odds.draw > 1.0 ? odds.draw : DEFAULT_ODDS.draw,
    away: odds.away_win && odds.away_win > 1.0 ? odds.away_win : DEFAULT_ODDS.away,
  };
}

/**
 * Convert fixture data to SwipeMatch format
 */
export function fixtureToSwipeMatch(
  fixture: FixtureData,
  userPrediction?: SwipePredictionRecord
): SwipeMatch {
  const odds = getBestOdds(fixture.odds);

  // Determine if match is finished and get result
  const isFinished = fixture.status === 'FT' || fixture.status === 'finished';
  const result = isFinished
    ? determineResult(fixture.goals_home, fixture.goals_away)
    : undefined;

  return {
    id: fixture.id,
    teamA: {
      name: fixture.home.name,
      logo: fixture.home.logo,
      emoji: getTeamEmoji(fixture.home.name),
    },
    teamB: {
      name: fixture.away.name,
      logo: fixture.away.logo,
      emoji: getTeamEmoji(fixture.away.name),
    },
    kickoffTime: fixture.date,
    odds: {
      teamA: odds.home,
      draw: odds.draw,
      teamB: odds.away,
    },
    result,
  };
}

/**
 * Convert array of fixtures to SwipeMatch array with predictions
 */
export function fixturesToSwipeMatches(
  fixtures: FixtureData[],
  predictions: SwipePredictionRecord[] = []
): SwipeMatch[] {
  // Create a map of fixture_id -> prediction for quick lookup
  const predictionMap = new Map(
    predictions.map(p => [p.fixture_id, p])
  );

  return fixtures.map(fixture =>
    fixtureToSwipeMatch(fixture, predictionMap.get(fixture.id))
  );
}

// ============================================================================
// PREDICTION CONVERSIONS
// ============================================================================

/**
 * Convert database prediction record to UI SwipePrediction format
 */
export function predictionRecordToSwipePrediction(
  record: SwipePredictionRecord
): SwipePrediction {
  return {
    matchId: record.fixture_id,
    prediction: mapPredictionToOutcome(record.prediction),
  };
}

/**
 * Convert array of prediction records to SwipePrediction array
 */
export function predictionRecordsToSwipePredictions(
  records: SwipePredictionRecord[]
): SwipePrediction[] {
  return records.map(predictionRecordToSwipePrediction);
}

// ============================================================================
// ODDS FORMATTING
// ============================================================================

/**
 * Format odds for display
 */
export function formatOdds(odds: number): string {
  return odds.toFixed(2);
}

/**
 * Calculate potential points from odds
 */
export function calculatePotentialPoints(odds: number): number {
  return Math.round(odds * 100);
}

/**
 * Format points for display
 */
export function formatPoints(points: number): string {
  if (points >= 1000) {
    return `${(points / 1000).toFixed(1)}k`;
  }
  return points.toString();
}

// ============================================================================
// MATCH STATUS HELPERS
// ============================================================================

/**
 * Check if match has started
 */
export function hasMatchStarted(kickoffTime: string): boolean {
  return new Date(kickoffTime) <= new Date();
}

/**
 * Check if predictions are locked for a match
 */
export function arePredictionsLocked(kickoffTime: string): boolean {
  return hasMatchStarted(kickoffTime);
}

/**
 * Get time until kickoff in minutes
 */
export function getMinutesUntilKickoff(kickoffTime: string): number {
  const now = new Date();
  const kickoff = new Date(kickoffTime);
  const diff = kickoff.getTime() - now.getTime();
  return Math.floor(diff / 1000 / 60);
}

/**
 * Check if match is finished
 */
export function isMatchFinished(status: string): boolean {
  return status === 'FT' || status === 'finished';
}

// ============================================================================
// MATCHDAY HELPERS
// ============================================================================

/**
 * Get matchday date in YYYY-MM-DD format
 */
export function getMatchdayDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

/**
 * Format matchday date for display
 */
export function formatMatchdayDate(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Check if date is today
 */
export function isToday(date: string): boolean {
  const today = new Date();
  const checkDate = new Date(date);
  return (
    today.getDate() === checkDate.getDate() &&
    today.getMonth() === checkDate.getMonth() &&
    today.getFullYear() === checkDate.getFullYear()
  );
}

/**
 * Group fixtures by date
 */
export function groupFixturesByDate(fixtures: FixtureData[]): Map<string, FixtureData[]> {
  const groups = new Map<string, FixtureData[]>();

  for (const fixture of fixtures) {
    const date = getMatchdayDate(fixture.date);
    const existing = groups.get(date) || [];
    groups.set(date, [...existing, fixture]);
  }

  return groups;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate that user can make prediction
 */
export function canMakePrediction(
  kickoffTime: string,
  deadline?: string | null
): { canPredict: boolean; reason?: string } {
  if (deadline && new Date() > new Date(deadline)) {
    return { canPredict: false, reason: 'Deadline has passed' };
  }

  if (hasMatchStarted(kickoffTime)) {
    return { canPredict: false, reason: 'Match has already started' };
  }

  return { canPredict: true };
}

/**
 * Validate odds data
 */
export function validateOdds(odds: { home: number; draw: number; away: number }): boolean {
  return (
    odds.home > 0 &&
    odds.draw > 0 &&
    odds.away > 0 &&
    !isNaN(odds.home) &&
    !isNaN(odds.draw) &&
    !isNaN(odds.away)
  );
}

export default {
  // Team helpers
  getTeamEmoji,

  // Fixture conversions
  fixtureToSwipeMatch,
  fixturesToSwipeMatches,
  determineResult,

  // Prediction conversions
  mapPredictionToOutcome,
  mapOutcomeToPrediction,
  predictionRecordToSwipePrediction,
  predictionRecordsToSwipePredictions,

  // Formatting
  formatOdds,
  calculatePotentialPoints,
  formatPoints,

  // Match status
  hasMatchStarted,
  arePredictionsLocked,
  getMinutesUntilKickoff,
  isMatchFinished,

  // Matchday helpers
  getMatchdayDate,
  formatMatchdayDate,
  isToday,
  groupFixturesByDate,

  // Validation
  canMakePrediction,
  validateOdds,
};
