/**
 * Swipe Game Service
 *
 * Handles all business logic for swipe predictions games including:
 * - Creating and managing multi-day challenges
 * - Managing daily matchdays
 * - Saving and updating predictions
 * - Calculating points
 * - Generating leaderboards
 */

import { supabase } from './supabase';
import type {
  SwipeMatch,
  SwipePrediction,
  SwipePredictionOutcome,
  SwipeLeaderboardEntry
} from '../types';
import { detectAndSyncMissingOdds } from './oddsSyncService';

// ============================================================================
// HELPER: Fetch fixtures directly from fb_fixtures
// ============================================================================

interface FetchedFixture {
  id: string;
  date: string;
  status: string | null;
  round: string | null;
  goals_home: number | null;
  goals_away: number | null;
  home: { id: string; name: string; logo_url: string | null } | null;
  away: { id: string; name: string; logo_url: string | null } | null;
  odds: Array<{ home_win: number; draw: number; away_win: number; bookmaker_name: string }> | null;
  league: { id: string; name: string; logo: string | null } | null;
}

interface FetchedChallenge {
  id: string;
  start_date: string;
  end_date: string;
  rules: Record<string, any> | null;
  created_at?: string;
  challenge_leagues: Array<{ league_id: string }> | null;
}

/**
 * Fetch fixtures directly from fb_fixtures for a challenge
 * This replaces the old logic that depended on challenge_matchdays being created manually
 */
async function fetchFixturesForChallenge(challengeId: string): Promise<{
  challenge: FetchedChallenge;
  fixtures: FetchedFixture[];
}> {
  // 1. Get challenge with leagues
  const { data: challenge, error: challengeError } = await supabase
    .from('challenges')
    .select(`
      id, start_date, end_date, rules, created_at,
      challenge_leagues(league_id)
    `)
    .eq('id', challengeId)
    .single();

  if (challengeError || !challenge) {
    console.error('[swipeGameService] Failed to fetch challenge:', challengeError);
    throw new Error('Challenge not found');
  }

  const leagueIds = challenge.challenge_leagues?.map((cl: { league_id: string }) => cl.league_id) ?? [];

  if (leagueIds.length === 0) {
    console.warn('[swipeGameService] No leagues found for challenge', challengeId);
    return { challenge: challenge as FetchedChallenge, fixtures: [] };
  }

  // Normalize dates to ensure we include all matches within the day range
  // If end_date is just a date (e.g., "2024-12-21"), we want to include all matches that day
  const startDate = challenge.start_date;
  const endDate = challenge.end_date.includes('T')
    ? challenge.end_date
    : `${challenge.end_date}T23:59:59Z`;

  const rules = challenge.rules ?? {};
  const periodType = (rules.period_type as string) ?? 'matchdays';

  console.log(`[swipeGameService] Fetching fixtures for challenge ${challengeId}, leagues: ${leagueIds.join(', ')} (${periodType} mode)`);
  console.log(`[swipeGameService] Date range: ${startDate} to ${endDate}`);

  let fixtures: FetchedFixture[] | null = null;
  let fixturesError: Error | null = null;

  if (periodType === 'matchdays') {
    // For matchday mode: first find rounds that have at least one match in the date range,
    // then fetch ALL matches from those rounds (even if some matches are outside the date range)
    // This ensures complete matchdays are shown

    // Step 1: Find rounds that have at least one match in the date range
    const { data: roundsInRange, error: roundsError } = await supabase
      .from('fb_fixtures')
      .select('round')
      .in('league_id', leagueIds)
      .gte('date', startDate)
      .lte('date', endDate)
      .not('round', 'is', null);

    if (roundsError) {
      console.error('[swipeGameService] Failed to fetch rounds:', roundsError);
      fixturesError = roundsError;
    } else if (roundsInRange && roundsInRange.length > 0) {
      // Get unique rounds
      const uniqueRounds = [...new Set(roundsInRange.map(r => r.round).filter(Boolean))] as string[];
      console.log(`[swipeGameService] Found ${uniqueRounds.length} matchdays in date range: ${uniqueRounds.join(', ')}`);

      // Step 2: Fetch ALL fixtures from those rounds (no date filter)
      const { data: allFixtures, error: allFixturesError } = await supabase
        .from('fb_fixtures')
        .select(`
          id, date, status, round, goals_home, goals_away,
          home:fb_teams!fb_fixtures_home_team_id_fkey(id, name, logo_url),
          away:fb_teams!fb_fixtures_away_team_id_fkey(id, name, logo_url),
          odds:fb_odds(home_win, draw, away_win, bookmaker_name),
          league:fb_leagues(id, name, logo)
        `)
        .in('league_id', leagueIds)
        .in('round', uniqueRounds)
        .order('date', { ascending: true });

      fixtures = allFixtures as FetchedFixture[] | null;
      fixturesError = allFixturesError;
      console.log(`[swipeGameService] Fetched ${fixtures?.length ?? 0} total fixtures from ${uniqueRounds.length} matchdays`);
    }
  } else {
    // For calendar mode: just fetch fixtures within the date range
    const { data, error } = await supabase
      .from('fb_fixtures')
      .select(`
        id, date, status, round, goals_home, goals_away,
        home:fb_teams!fb_fixtures_home_team_id_fkey(id, name, logo_url),
        away:fb_teams!fb_fixtures_away_team_id_fkey(id, name, logo_url),
        odds:fb_odds(home_win, draw, away_win, bookmaker_name),
        league:fb_leagues(id, name, logo)
      `)
      .in('league_id', leagueIds)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    fixtures = data as FetchedFixture[] | null;
    fixturesError = error;
  }

  if (fixturesError) {
    console.error('[swipeGameService] Failed to fetch fixtures:', fixturesError);
    return { challenge: challenge as FetchedChallenge, fixtures: [] };
  }

  console.log(`[swipeGameService] Found ${fixtures?.length ?? 0} fixtures`);

  return {
    challenge: challenge as FetchedChallenge,
    fixtures: (fixtures ?? []) as FetchedFixture[]
  };
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ChallengeMatchday {
  id: string;
  challenge_id: string;
  date: string;
  status: 'upcoming' | 'active' | 'finished';
  deadline: string | null;
  created_at: string;
  updated_at: string;
  fixtures_count?: number; // Number of fixtures linked to this matchday
}

export interface MatchdayFixture {
  id: string;
  matchday_id: string;
  fixture_id: string;
}

export interface SwipePredictionRecord {
  id: string;
  challenge_id: string;
  matchday_id: string;
  user_id: string;
  fixture_id: string;
  prediction: 'home' | 'draw' | 'away';
  odds_at_prediction: {
    home: number;
    draw: number;
    away: number;
  };
  points_earned: number;
  is_correct: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface MatchdayParticipant {
  id: string;
  matchday_id: string;
  user_id: string;
  predictions_made: number;
  points_earned: number;
  correct_predictions: number;
  is_complete: boolean;
}

// ============================================================================
// CHALLENGE MANAGEMENT
// ============================================================================

/**
 * Create a new swipe game challenge
 */
export async function createSwipeChallenge(params: {
  name: string
  description?: string
  league_id: string
  start_date: string
  end_date: string
  entry_cost: number
  prizes?: any
  game_type?: 'betting' | 'prediction' | 'fantasy'
  tier?: 'amateur' | 'master' | 'apex'
  duration_type?: 'daily' | 'mini-series' | 'seasonal'
  minimum_level?: string
  minimum_players?: number
  maximum_players?: number
  required_badges?: string[]
  requires_subscription?: boolean
}) {
  const { data: challenge, error } = await supabase
    .from('challenges')
    .insert({
      name: params.name,
      description: params.description,
      game_type: params.game_type ?? 'prediction',
      format: 'leaderboard',
      sport: 'football',
      start_date: params.start_date,
      end_date: params.end_date,
      entry_cost: params.entry_cost,
      prizes: params.prizes,
      entry_conditions: {
        minimum_level: params.minimum_level ?? null,
        required_badges: params.required_badges ?? [],
        requires_subscription: params.requires_subscription ?? false,
      },
      rules: {
        tier: params.tier ?? 'amateur',
        duration_type: params.duration_type ?? 'daily',
        minimum_players: params.minimum_players ?? 0,
        maximum_players: params.maximum_players ?? 0,
      },
      status: 'upcoming',
    })
    .select()
    .single();

  if (error) throw error;

  // Link challenge to league
  await supabase.from('challenge_leagues').insert({
    challenge_id: challenge.id,
    league_id: params.league_id,
  });

  // Store swipe-specific configuration snapshot
  const swipeConfig = {
    tier: params.tier ?? 'rookie',
    duration_type: params.duration_type ?? 'daily',
    minimum_level: params.minimum_level ?? null,
    minimum_players: params.minimum_players ?? 0,
    maximum_players: params.maximum_players ?? 0,
    required_badges: params.required_badges ?? [],
    requires_subscription: params.requires_subscription ?? false,
    entry_cost: params.entry_cost,
  }

  await supabase
    .from('challenge_configs')
    .upsert(
      {
        challenge_id: challenge.id,
        config_type: 'swipe',
        config_data: swipeConfig,
      },
      { onConflict: 'challenge_id,config_type' }
    )

  return challenge;
}

/**
 * Get challenge details with league info
 */
export async function getSwipeChallenge(challengeId: string) {
  const { data, error } = await supabase
    .from('challenges')
    .select(`
      *,
      challenge_leagues(
        league:fb_leagues(*)
      )
    `)
    .eq('id', challengeId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Join a swipe challenge
 */
export async function joinSwipeChallenge(challengeId: string, userId: string) {
  const { data, error } = await supabase
    .from('challenge_participants')
    .insert({
      challenge_id: challengeId,
      user_id: userId,
      points: 0,
      rank: null,
    })
    .select()
    .single();

  if (error) {
    // Check if already joined
    if (error.code === '23505') {
      return { alreadyJoined: true };
    }
    throw error;
  }

  return { data, alreadyJoined: false };
}

/**
 * Check if user has joined a challenge
 */
export async function hasJoinedChallenge(challengeId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('challenge_participants')
    .select('id')
    .eq('challenge_id', challengeId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

// ============================================================================
// MATCHDAY MANAGEMENT
// ============================================================================

/**
 * Create or get matchday for a specific date within a challenge
 */
export async function getOrCreateMatchday(
  challengeId: string,
  date: string // Format: YYYY-MM-DD
): Promise<ChallengeMatchday> {
  // Try to get existing matchday
  const { data: existing, error: fetchError } = await supabase
    .from('challenge_matchdays')
    .select('*')
    .eq('challenge_id', challengeId)
    .eq('date', date)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (existing) return existing;

  // Create new matchday
  const { data: newMatchday, error: createError } = await supabase
    .from('challenge_matchdays')
    .insert({
      challenge_id: challengeId,
      date,
      status: 'upcoming',
    })
    .select()
    .single();

  if (createError) throw createError;
  return newMatchday;
}

/**
 * Get all matchdays for a challenge with fixtures count
 * REFACTORED: Now fetches directly from fb_fixtures instead of challenge_matchdays
 * This ensures matches appear even if matchdays weren't created manually in admin
 */
export async function getChallengeMatchdays(challengeId: string): Promise<ChallengeMatchday[]> {
  const { challenge, fixtures } = await fetchFixturesForChallenge(challengeId);

  if (fixtures.length === 0) {
    console.log('[swipeGameService] No fixtures found for challenge', challengeId);
    return [];
  }

  const rules = challenge.rules ?? {};
  const periodType = (rules.period_type as 'matchdays' | 'calendar') ?? 'matchdays';

  console.log(`[swipeGameService] Grouping ${fixtures.length} fixtures by ${periodType}`);

  // Group fixtures by round (matchdays) or date (calendar)
  const groupedFixtures = new Map<string, FetchedFixture[]>();

  for (const fixture of fixtures) {
    const key = periodType === 'calendar'
      ? fixture.date.split('T')[0]  // Group by date (YYYY-MM-DD)
      : fixture.round ?? 'unknown';  // Group by round (e.g., "Regular Season - 17")

    if (!groupedFixtures.has(key)) {
      groupedFixtures.set(key, []);
    }
    groupedFixtures.get(key)!.push(fixture);
  }

  // Convert to ChallengeMatchday format
  const matchdays: ChallengeMatchday[] = [];

  // Sort keys by earliest fixture date in each group
  const sortedEntries = Array.from(groupedFixtures.entries())
    .map(([key, groupFixtures]) => ({
      key,
      groupFixtures,
      earliestDate: groupFixtures.reduce(
        (min, f) => f.date < min ? f.date : min,
        groupFixtures[0].date
      )
    }))
    .sort((a, b) => a.earliestDate.localeCompare(b.earliestDate));

  for (const { key, groupFixtures, earliestDate } of sortedEntries) {
    // Determine status based on fixtures
    // Include postponed/cancelled statuses as "finished" for matchday progression purposes
    const finishedStatuses = ['FT', 'AET', 'PEN', 'AWARDED', 'W.O', 'CANC', 'ABD', 'PST', 'POSTP', 'TBD'];
    const allPlayed = groupFixtures.every(f =>
      finishedStatuses.includes((f.status ?? '').toUpperCase())
    );
    const anyStarted = groupFixtures.some(f =>
      new Date(f.date) <= new Date()
    );

    matchdays.push({
      id: key,  // Use key as virtual ID (round or date)
      challenge_id: challengeId,
      date: earliestDate,
      status: allPlayed ? 'finished' : anyStarted ? 'active' : 'upcoming',
      deadline: earliestDate,
      created_at: challenge.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
      fixtures_count: groupFixtures.length,
    });
  }

  console.log(`[swipeGameService] Created ${matchdays.length} virtual matchdays`);
  return matchdays;
}

/**
 * Get specific matchday with fixtures
 * REFACTORED: Now accepts matchdayKey (round or date) and challengeId
 * instead of a UUID matchdayId from challenge_matchdays table
 */
export async function getMatchdayWithFixtures(matchdayKey: string, challengeId?: string) {
  // If challengeId is provided, use the new fb_fixtures-based approach
  if (challengeId) {
    const { challenge, fixtures } = await fetchFixturesForChallenge(challengeId);

    const rules = challenge.rules ?? {};
    const periodType = (rules.period_type as 'matchdays' | 'calendar') ?? 'matchdays';

    // Filter fixtures for this matchday
    const matchdayFixtures = fixtures.filter(f => {
      const key = periodType === 'calendar'
        ? f.date.split('T')[0]
        : f.round ?? 'unknown';
      return key === matchdayKey;
    });

    console.log(`[swipeGameService] getMatchdayWithFixtures: Found ${matchdayFixtures.length} fixtures for key "${matchdayKey}"`);

    // Detect and sync missing odds (fire and forget)
    const fixturesForOddsCheck = matchdayFixtures.map(f => ({
      id: f.id,
      league_id: f.league?.id,
      odds: f.odds,
    })).filter(f => f.id && f.league_id);

    if (fixturesForOddsCheck.length > 0) {
      detectAndSyncMissingOdds(fixturesForOddsCheck).catch(err => {
        console.error('[swipeGameService] Error detecting missing odds:', err);
      });
    }

    // Build response in expected format
    return {
      id: matchdayKey,
      challenge_id: challengeId,
      date: matchdayFixtures[0]?.date ?? new Date().toISOString(),
      status: 'active' as const,
      deadline: matchdayFixtures[0]?.date ?? null,
      created_at: challenge.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
      matchday_fixtures: matchdayFixtures.map(f => ({
        fixture_id: f.id,
        fixture: {
          id: f.id,
          api_id: null,
          date: f.date,
          status: f.status,
          round: f.round,
          goals_home: f.goals_home,
          goals_away: f.goals_away,
          league: f.league,
          home: f.home,
          away: f.away,
          odds: f.odds,
        }
      }))
    };
  }

  // Fallback to old behavior for backwards compatibility (if only matchdayId is provided)
  // This can be removed once all callers pass challengeId
  console.warn('[swipeGameService] getMatchdayWithFixtures called without challengeId, using legacy query');
  const { data, error } = await supabase
    .from('challenge_matchdays')
    .select(`
      *,
      matchday_fixtures(
        fixture_id,
        fixture:fb_fixtures(
          id,
          api_id,
          date,
          status,
          round,
          goals_home,
          goals_away,
          league:fb_leagues(id, name, logo),
          home:fb_teams!fb_fixtures_home_team_id_fkey(id, name, logo_url),
          away:fb_teams!fb_fixtures_away_team_id_fkey(id, name, logo_url),
          odds:fb_odds(home_win, draw, away_win, bookmaker_name)
        )
      )
    `)
    .eq('id', matchdayKey)
    .single();

  if (error) {
    console.error('Error fetching matchday:', error);
    throw error;
  }

  // Detect and sync missing odds (fire and forget)
  const legacyFixtures = data?.matchday_fixtures?.map((mf: any) => ({
    id: mf.fixture?.id,
    league_id: mf.fixture?.league?.id,
    odds: mf.fixture?.odds,
  })).filter((f: any) => f.id) || [];

  if (legacyFixtures.length > 0) {
    detectAndSyncMissingOdds(legacyFixtures).catch(err => {
      console.error('[swipeGameService] Error detecting missing odds:', err);
    });
  }

  return data;
}

/**
 * Link fixtures to a matchday
 */
export async function linkFixturesToMatchday(matchdayId: string, fixtureIds: string[]) {
  const links = fixtureIds.map(fixtureId => ({
    matchday_id: matchdayId,
    fixture_id: fixtureId,
  }));

  const { error } = await supabase
    .from('matchday_fixtures')
    .insert(links);

  if (error) throw error;
}

/**
 * Update matchday deadline (usually first kickoff time)
 */
export async function updateMatchdayDeadline(matchdayId: string, deadline: string) {
  const { error } = await supabase
    .from('challenge_matchdays')
    .update({ deadline })
    .eq('id', matchdayId);

  if (error) throw error;
}

/**
 * Update matchday status
 */
export async function updateMatchdayStatus(
  matchdayId: string,
  status: 'upcoming' | 'active' | 'finished'
) {
  const { error } = await supabase
    .from('challenge_matchdays')
    .update({ status })
    .eq('id', matchdayId);

  if (error) throw error;
}

// ============================================================================
// PREDICTIONS MANAGEMENT
// ============================================================================

/**
 * Generate a deterministic UUID from a string
 * This creates a consistent UUID for virtual matchday IDs (round or date strings)
 */
function generateDeterministicUUID(input: string): string {
  // Simple hash function to create a deterministic UUID-like string
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Convert to positive number and pad to create UUID format
  const positiveHash = Math.abs(hash);
  const hexHash = positiveHash.toString(16).padStart(12, '0');

  // Create a valid UUID v4-like format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // Using '4' for version and '8' for variant
  return `${hexHash.slice(0, 8)}-${hexHash.slice(0, 4)}-4${hexHash.slice(1, 4)}-8${hexHash.slice(0, 3)}-${hexHash.padEnd(12, '0').slice(0, 12)}`;
}

/**
 * Save or update a prediction
 * Validates that the match has not started before allowing the prediction
 * REFACTORED: Handles virtual matchday IDs (round or date strings) by generating deterministic UUIDs
 */
export async function savePrediction(params: {
  challengeId: string;
  matchdayId: string;
  userId: string;
  fixtureId: string;
  prediction: 'home' | 'draw' | 'away';
  odds: { home: number; draw: number; away: number };
}) {
  // Backend validation: Check if match has already started
  const { data: fixture, error: fixtureError } = await supabase
    .from('fb_fixtures')
    .select('date')
    .eq('id', params.fixtureId)
    .single();

  if (fixtureError) {
    console.warn('[savePrediction] Could not verify fixture kickoff time:', fixtureError);
    // Continue anyway - the frontend should have already validated
  } else if (fixture && new Date(fixture.date) <= new Date()) {
    throw new Error('Cannot save prediction - match has already started');
  }

  // Check if matchdayId is a valid UUID or a virtual ID (round/date string)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let matchdayUUID = params.matchdayId;

  if (!uuidRegex.test(params.matchdayId)) {
    // Virtual matchday ID - generate deterministic UUID from challengeId + matchdayKey
    matchdayUUID = generateDeterministicUUID(`${params.challengeId}:${params.matchdayId}`);
    console.log(`[savePrediction] Generated deterministic UUID for matchday "${params.matchdayId}": ${matchdayUUID}`);
  }

  const { data, error } = await supabase
    .from('swipe_predictions')
    .upsert({
      challenge_id: params.challengeId,
      matchday_id: matchdayUUID,
      user_id: params.userId,
      fixture_id: params.fixtureId,
      prediction: params.prediction,
      odds_at_prediction: params.odds,
    }, {
      onConflict: 'challenge_id,user_id,fixture_id'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get user predictions for a matchday
 * REFACTORED: Now accepts challengeId + fixtureIds instead of matchday_id UUID
 * This works with the new fb_fixtures-based approach where matchday IDs are virtual strings
 */
export async function getUserMatchdayPredictions(
  matchdayKey: string,
  userId: string,
  challengeId?: string,
  fixtureIds?: string[]
): Promise<SwipePredictionRecord[]> {
  // If challengeId and fixtureIds are provided, use the new approach
  if (challengeId && fixtureIds && fixtureIds.length > 0) {
    const { data, error } = await supabase
      .from('swipe_predictions')
      .select('*')
      .eq('challenge_id', challengeId)
      .eq('user_id', userId)
      .in('fixture_id', fixtureIds);

    if (error) throw error;
    return data || [];
  }

  // Fallback: Try to use matchdayKey as UUID (legacy approach)
  // This will fail for virtual matchday IDs but allows gradual migration
  const { data, error } = await supabase
    .from('swipe_predictions')
    .select('*')
    .eq('matchday_id', matchdayKey)
    .eq('user_id', userId);

  if (error) {
    // If error is about invalid UUID, return empty array (no predictions yet)
    if (error.message?.includes('invalid input syntax for type uuid')) {
      console.warn('[swipeGameService] getUserMatchdayPredictions: matchdayKey is not a UUID, returning empty predictions');
      return [];
    }
    throw error;
  }
  return data || [];
}

/**
 * Get all user predictions for a challenge
 */
export async function getUserChallengePredictions(
  challengeId: string,
  userId: string
): Promise<SwipePredictionRecord[]> {
  const { data, error } = await supabase
    .from('swipe_predictions')
    .select('*')
    .eq('challenge_id', challengeId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get all predictions for a specific fixture (for leaderboard)
 */
export async function getFixturePredictions(fixtureId: string): Promise<SwipePredictionRecord[]> {
  const { data, error } = await supabase
    .from('swipe_predictions')
    .select('*')
    .eq('fixture_id', fixtureId);

  if (error) throw error;
  return data || [];
}

/**
 * Check if user has made all predictions for a matchday
 * REFACTORED: Now accepts optional challengeId and fixtureIds for fb_fixtures-based approach
 */
export async function hasCompletedMatchday(
  matchdayId: string,
  userId: string,
  challengeId?: string,
  fixtureIds?: string[]
): Promise<boolean> {
  // If fixtureIds are provided, use the new approach
  if (challengeId && fixtureIds && fixtureIds.length > 0) {
    // Get user's predictions for these fixtures
    const { count: userPredictions, error: predictionsError } = await supabase
      .from('swipe_predictions')
      .select('*', { count: 'exact', head: true })
      .eq('challenge_id', challengeId)
      .eq('user_id', userId)
      .in('fixture_id', fixtureIds);

    if (predictionsError) throw predictionsError;

    return (userPredictions || 0) >= fixtureIds.length;
  }

  // Fallback: Legacy approach using matchday_fixtures table
  const { count: totalFixtures, error: fixturesError } = await supabase
    .from('matchday_fixtures')
    .select('*', { count: 'exact', head: true })
    .eq('matchday_id', matchdayId);

  if (fixturesError) throw fixturesError;

  // Get user's prediction count
  const { count: userPredictions, error: predictionsError } = await supabase
    .from('swipe_predictions')
    .select('*', { count: 'exact', head: true })
    .eq('matchday_id', matchdayId)
    .eq('user_id', userId);

  if (predictionsError) throw predictionsError;

  return (userPredictions || 0) >= (totalFixtures || 0);
}

// ============================================================================
// POINTS CALCULATION
// ============================================================================

/**
 * Calculate and update points for a finished fixture
 */
export async function calculatePointsForFixture(fixtureId: string) {
  // Get fixture result
  const { data: fixture, error: fixtureError } = await supabase
    .from('fb_fixtures')
    .select('id, status, goals_home, goals_away')
    .eq('id', fixtureId)
    .single();

  if (fixtureError) throw fixtureError;
  if (fixture.status !== 'FT') return; // Only calculate for finished matches

  // Determine result
  let result: 'home' | 'draw' | 'away';
  if (fixture.goals_home > fixture.goals_away) {
    result = 'home';
  } else if (fixture.goals_home < fixture.goals_away) {
    result = 'away';
  } else {
    result = 'draw';
  }

  // Get all predictions for this fixture
  const predictions = await getFixturePredictions(fixtureId);

  // Update each prediction
  for (const pred of predictions) {
    const isCorrect = pred.prediction === result;
    const points = isCorrect
      ? Math.round(pred.odds_at_prediction[pred.prediction] * 100)
      : 0;

    await supabase
      .from('swipe_predictions')
      .update({
        is_correct: isCorrect,
        points_earned: points,
      })
      .eq('id', pred.id);
  }

  // The triggers will automatically update matchday_participants and challenge_participants
}

// ============================================================================
// LEADERBOARD
// ============================================================================

/**
 * Get challenge leaderboard (cumulative across all matchdays)
 */
export async function getChallengeLeaderboard(
  challengeId: string
): Promise<SwipeLeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('challenge_participants')
    .select(`
      user_id,
      points,
      rank,
      created_at,
      user:users!inner(username, avatar_url)
    `)
    .eq('challenge_id', challengeId)
    .order('points', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data || []).map((entry, index) => ({
    rank: index + 1,
    username: entry.user.username || 'Unknown',
    points: entry.points,
    userId: entry.user_id,
    correct_picks: 0, // Will be calculated from matchday_participants
    submission_timestamp: new Date(entry.created_at).getTime(),
  }));
}

/**
 * Get matchday leaderboard (single day)
 */
export async function getMatchdayLeaderboard(
  matchdayId: string
): Promise<SwipeLeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('matchday_participants')
    .select(`
      user_id,
      points_earned,
      correct_predictions,
      created_at,
      user:users!inner(username, avatar_url)
    `)
    .eq('matchday_id', matchdayId)
    .order('points_earned', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data || []).map((entry, index) => ({
    rank: index + 1,
    username: entry.user.username || 'Unknown',
    points: entry.points_earned,
    userId: entry.user_id,
    correct_picks: entry.correct_predictions,
    submission_timestamp: new Date(entry.created_at).getTime(),
  }));
}

/**
 * Update leaderboard ranks for a challenge
 */
export async function updateChallengeRanks(challengeId: string) {
  const { data: participants, error } = await supabase
    .from('challenge_participants')
    .select('id, user_id, points, created_at')
    .eq('challenge_id', challengeId)
    .order('points', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) throw error;

  // Update ranks
  for (let i = 0; i < participants.length; i++) {
    await supabase
      .from('challenge_participants')
      .update({ rank: i + 1 })
      .eq('id', participants[i].id);
  }
}

// ============================================================================
// STATS & ANALYTICS
// ============================================================================

/**
 * Get user stats for a challenge
 */
export async function getUserChallengeStats(challengeId: string, userId: string) {
  const { data: participant, error: participantError } = await supabase
    .from('challenge_participants')
    .select('points, rank')
    .eq('challenge_id', challengeId)
    .eq('user_id', userId)
    .maybeSingle();

  if (participantError) throw participantError;

  // Get matchday stats
  const { data: matchdayStats, error: matchdayError } = await supabase
    .from('matchday_participants')
    .select(`
      predictions_made,
      points_earned,
      correct_predictions,
      matchday:challenge_matchdays!inner(challenge_id)
    `)
    .eq('user_id', userId)
    .eq('matchday.challenge_id', challengeId);

  if (matchdayError) throw matchdayError;

  const totalPredictions = matchdayStats?.reduce((sum, day) => sum + day.predictions_made, 0) || 0;
  const totalCorrect = matchdayStats?.reduce((sum, day) => sum + day.correct_predictions, 0) || 0;

  return {
    totalPoints: participant?.points || 0,
    rank: participant?.rank || null,
    totalPredictions,
    correctPredictions: totalCorrect,
    accuracy: totalPredictions > 0 ? (totalCorrect / totalPredictions) * 100 : 0,
    matchdaysCompleted: matchdayStats?.length || 0,
  };
}

export default {
  // Challenge
  createSwipeChallenge,
  getSwipeChallenge,
  joinSwipeChallenge,
  hasJoinedChallenge,

  // Matchdays
  getOrCreateMatchday,
  getChallengeMatchdays,
  getMatchdayWithFixtures,
  linkFixturesToMatchday,
  updateMatchdayDeadline,
  updateMatchdayStatus,

  // Predictions
  savePrediction,
  getUserMatchdayPredictions,
  getUserChallengePredictions,
  getFixturePredictions,
  hasCompletedMatchday,

  // Points
  calculatePointsForFixture,

  // Leaderboard
  getChallengeLeaderboard,
  getMatchdayLeaderboard,
  updateChallengeRanks,

  // Stats
  getUserChallengeStats,
};
