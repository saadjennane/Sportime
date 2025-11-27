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
  tier?: 'rookie' | 'pro' | 'elite' | 'amateur' | 'master' | 'apex'
  duration_type?: 'daily' | 'mini-series' | 'seasonal' | 'flash' | 'series' | 'season'
  minimum_level?: string
  minimum_players?: number
  maximum_players?: number
  required_badges?: string[]
  requires_subscription?: boolean
  period_type?: 'matchdays' | 'calendar'
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
        tier: params.tier ?? 'rookie',
        duration_type: params.duration_type ?? 'daily',
        minimum_players: params.minimum_players ?? 0,
        maximum_players: params.maximum_players ?? 0,
        period_type: params.period_type ?? 'matchdays',
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
      challenge_leagues!inner(
        league:fb_leagues(*)
      )
    `)
    .eq('id', challengeId)
    .eq('game_type', 'prediction')
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
 * Get all matchdays for a challenge
 */
export async function getChallengeMatchdays(challengeId: string): Promise<ChallengeMatchday[]> {
  const { data, error } = await supabase
    .from('challenge_matchdays')
    .select('*')
    .eq('challenge_id', challengeId)
    .order('date', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get specific matchday with fixtures
 */
export async function getMatchdayWithFixtures(matchdayId: string) {
  const { data, error } = await supabase
    .from('challenge_matchdays')
    .select(`
      *,
      matchday_fixtures!inner(
        fixture:fb_fixtures!inner(
          id,
          api_id,
          date,
          status,
          goals_home,
          goals_away,
          league:fb_leagues(id, name, logo),
          home:fb_teams!fb_fixtures_home_team_id_fkey(id, name, logo),
          away:fb_teams!fb_fixtures_away_team_id_fkey(id, name, logo),
          odds:odds!odds_fixture_id_fkey(home_win, draw, away_win, bookmaker_name)
        )
      )
    `)
    .eq('id', matchdayId)
    .single();

  if (error) throw error;
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
 * Save or update a prediction
 */
export async function savePrediction(params: {
  challengeId: string;
  matchdayId: string;
  userId: string;
  fixtureId: string;
  prediction: 'home' | 'draw' | 'away';
  odds: { home: number; draw: number; away: number };
}) {
  const { data, error } = await supabase
    .from('swipe_predictions')
    .upsert({
      challenge_id: params.challengeId,
      matchday_id: params.matchdayId,
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
 */
export async function getUserMatchdayPredictions(
  matchdayId: string,
  userId: string
): Promise<SwipePredictionRecord[]> {
  const { data, error } = await supabase
    .from('swipe_predictions')
    .select('*')
    .eq('matchday_id', matchdayId)
    .eq('user_id', userId);

  if (error) throw error;
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
 */
export async function hasCompletedMatchday(
  matchdayId: string,
  userId: string
): Promise<boolean> {
  // Get total fixtures in matchday
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
