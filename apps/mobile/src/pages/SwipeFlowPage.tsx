/**
 * SwipeFlowPage - Single Container for Swipe Game Flow
 *
 * This is a MINIMAL architecture designed to prevent React Error #310 (infinite re-renders).
 *
 * Rules:
 * - NO useMemo with Map/Set creation
 * - NO complex hook dependencies
 * - Record<string, T> instead of Map
 * - memo() on all child components
 * - Single state object pattern
 */

import React, { useState, useEffect, memo } from 'react';
import { Loader2 } from 'lucide-react';
import type {
  SwipeMatch,
  SwipePrediction,
  SwipePredictionOutcome,
  SwipeLeaderboardEntry,
  Profile,
  UserLeague,
  LeagueMember,
  LeagueGame,
  Game,
} from '../types';
import type { ChallengeMatchday, SwipePredictionRecord } from '../services/swipeGameService';
import * as swipeService from '../services/swipeGameService';
import {
  fixturesToSwipeMatches,
  mapOutcomeToPrediction,
  mapPredictionToOutcome,
  predictionRecordsToSwipePredictions,
} from '../features/swipe/swipeMappers';

// Import child components
import { SwipeCardStack } from './swipe-components/SwipeCardStack';
import { SwipeRecapView } from './swipe-components/SwipeRecapView';
import { SwipeLeaderboardView } from './swipe-components/SwipeLeaderboardView';

// ============================================================================
// TYPES
// ============================================================================

type ViewMode = 'loading' | 'cards' | 'recap' | 'leaderboard' | 'error';

interface Challenge {
  id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  status: string;
  period_type?: 'matchdays' | 'calendar';
}

interface SwipeState {
  view: ViewMode;
  challenge: Challenge | null;
  matchdays: ChallengeMatchday[];
  currentMatchday: ChallengeMatchday | null;
  matches: SwipeMatch[];
  // Record<fixtureId, prediction> - NOT Map!
  predictions: Record<string, SwipePredictionRecord>;
  leaderboard: SwipeLeaderboardEntry[];
  userStats: {
    totalPoints: number;
    totalPredictions: number;
    correctPredictions: number;
    accuracy: number;
  } | null;
  userPosition: number | null;
  error: string | null;
  isSaving: boolean;
  /** True when editing predictions from recap view */
  editMode: boolean;
}

interface SwipeFlowPageProps {
  challengeId: string;
  matchdayId?: string;
  userId: string | null;
  hasSeenSwipeTutorial: boolean;
  onDismissTutorial: (dontShowAgain: boolean) => void;
  onExit: () => void;
  // For linking games to leagues
  profile: Profile;
  userLeagues: UserLeague[];
  leagueMembers: LeagueMember[];
  leagueGames: LeagueGame[];
  onLinkGame: (game: Game) => void;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const INITIAL_STATE: SwipeState = {
  view: 'loading',
  challenge: null,
  matchdays: [],
  currentMatchday: null,
  matches: [],
  predictions: {},
  leaderboard: [],
  userStats: null,
  userPosition: null,
  error: null,
  isSaving: false,
  editMode: false,
};

// ============================================================================
// HELPER FUNCTIONS (outside component to prevent recreation)
// ============================================================================

function arrayToRecord(predictions: SwipePredictionRecord[]): Record<string, SwipePredictionRecord> {
  const record: Record<string, SwipePredictionRecord> = {};
  for (const pred of predictions) {
    record[pred.fixture_id] = pred;
  }
  return record;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const SwipeFlowPage: React.FC<SwipeFlowPageProps> = ({
  challengeId,
  matchdayId: initialMatchdayId,
  userId,
  hasSeenSwipeTutorial,
  onDismissTutorial,
  onExit,
  profile,
  userLeagues,
  leagueMembers,
  leagueGames,
  onLinkGame,
}) => {
  const [state, setState] = useState<SwipeState>(INITIAL_STATE);

  // =========================================================================
  // DATA LOADING
  // =========================================================================

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!challengeId) {
        setState(prev => ({ ...prev, view: 'error', error: 'No challenge ID provided' }));
        return;
      }

      try {
        // Load challenge first
        const challenge = await swipeService.getSwipeChallenge(challengeId);
        if (!isMounted) return;

        if (!challenge) {
          setState(prev => ({ ...prev, view: 'error', error: 'Challenge not found' }));
          return;
        }

        // Load matchdays
        const matchdays = await swipeService.getChallengeMatchdays(challengeId);
        if (!isMounted) return;

        // Determine current matchday
        // Logic: Open on the LAST playable matchday (first non-finished)
        // Sort by date first
        const sortedMatchdays = [...matchdays].sort((a, b) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        // Filter out matchdays without fixtures (empty days)
        const matchdaysWithFixtures = sortedMatchdays.filter(md =>
          md.fixtures_count === undefined || md.fixtures_count > 0
        );

        let currentMatchday: ChallengeMatchday | null = null;
        if (initialMatchdayId) {
          currentMatchday = matchdaysWithFixtures.find(md => md.id === initialMatchdayId) || null;
        }
        if (!currentMatchday && matchdaysWithFixtures.length > 0) {
          // Find the LAST matchday that is NOT finished (= most recent playable)
          // Reverse search to get the latest non-finished matchday
          const playable = [...matchdaysWithFixtures].reverse().find(md => md.status !== 'finished');
          currentMatchday = playable || matchdaysWithFixtures[matchdaysWithFixtures.length - 1]; // All finished -> show last
        }

        if (!currentMatchday) {
          setState(prev => ({
            ...prev,
            view: 'error',
            error: 'No matchdays available for this challenge',
            challenge: {
              id: challenge.id,
              name: challenge.name,
              description: challenge.description,
              start_date: challenge.start_date,
              end_date: challenge.end_date,
              status: challenge.status,
              period_type: challenge.period_type,
            },
          }));
          return;
        }

        // Load matchday fixtures
        const matchdayData = await swipeService.getMatchdayWithFixtures(currentMatchday.id);
        if (!isMounted) return;

        // Extract fixtures from matchday data
        const fixtures =
          matchdayData?.matchday_fixtures?.map((mf: any) => mf.fixture).filter(Boolean) || [];

        // Convert to SwipeMatch format
        const matches = fixturesToSwipeMatches(fixtures);

        // Load user predictions if userId exists
        let predictions: Record<string, SwipePredictionRecord> = {};
        if (userId) {
          const predictionRecords = await swipeService.getUserMatchdayPredictions(
            currentMatchday.id,
            userId
          );
          if (!isMounted) return;
          predictions = arrayToRecord(predictionRecords);
        }

        // Determine initial view - if has predictions, show recap; otherwise cards
        const hasPredictions = Object.keys(predictions).length > 0;
        const initialView: ViewMode = hasPredictions ? 'recap' : 'cards';

        setState({
          view: initialView,
          challenge: {
            id: challenge.id,
            name: challenge.name,
            description: challenge.description,
            start_date: challenge.start_date,
            end_date: challenge.end_date,
            status: challenge.status,
            period_type: challenge.period_type,
          },
          matchdays: matchdaysWithFixtures, // Only include matchdays that have fixtures
          currentMatchday,
          matches,
          predictions,
          leaderboard: [],
          userStats: null,
          userPosition: null,
          error: null,
          isSaving: false,
          editMode: false,
        });
      } catch (err: any) {
        if (!isMounted) return;
        console.error('[SwipeFlowPage] Error loading data:', err);
        setState(prev => ({
          ...prev,
          view: 'error',
          error: err.message || 'Failed to load game data',
        }));
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [challengeId, initialMatchdayId, userId]);

  // =========================================================================
  // HANDLERS (plain functions, not useCallback - memo on children handles it)
  // =========================================================================

  function handleSwipe(matchId: string, prediction: SwipePredictionOutcome) {
    if (!state.currentMatchday || !userId) return;

    const match = state.matches.find(m => m.id === matchId);
    if (!match) return;

    // Optimistic update
    const dbPrediction = mapOutcomeToPrediction(prediction);
    const optimisticRecord: SwipePredictionRecord = {
      id: `temp-${matchId}`,
      challenge_id: challengeId,
      matchday_id: state.currentMatchday.id,
      user_id: userId,
      fixture_id: matchId,
      prediction: dbPrediction,
      odds_at_prediction: {
        home: match.odds.teamA,
        draw: match.odds.draw,
        away: match.odds.teamB,
      },
      points_earned: 0,
      is_correct: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setState(prev => ({
      ...prev,
      predictions: {
        ...prev.predictions,
        [matchId]: optimisticRecord,
      },
    }));

    // Save to DB (fire and forget with error handling)
    swipeService
      .savePrediction({
        challengeId,
        matchdayId: state.currentMatchday!.id,
        userId,
        fixtureId: matchId,
        prediction: dbPrediction,
        odds: {
          home: match.odds.teamA,
          draw: match.odds.draw,
          away: match.odds.teamB,
        },
      })
      .then(savedRecord => {
        // Update with real record
        setState(prev => ({
          ...prev,
          predictions: {
            ...prev.predictions,
            [matchId]: savedRecord,
          },
        }));
      })
      .catch(err => {
        console.error('[SwipeFlowPage] Error saving prediction:', err);
        // Could show toast here, but keep optimistic update
      });
  }

  function handleSwipeComplete() {
    // All cards swiped - go to recap, reset edit mode
    setState(prev => ({ ...prev, view: 'recap', editMode: false }));
  }

  function handleGoToCards() {
    // Coming from recap - enable edit mode to show all cards
    setState(prev => ({ ...prev, view: 'cards', editMode: true }));
  }

  function handleGoToRecap() {
    setState(prev => ({ ...prev, view: 'recap', editMode: false }));
  }

  async function handleGoToLeaderboard() {
    setState(prev => ({ ...prev, view: 'loading' }));

    try {
      const leaderboard = await swipeService.getChallengeLeaderboard(challengeId);

      let userStats = null;
      let userPosition = null;

      if (userId) {
        userStats = await swipeService.getUserChallengeStats(challengeId, userId);
        const userEntry = leaderboard.find(e => e.userId === userId);
        userPosition = userEntry?.rank || null;
      }

      setState(prev => ({
        ...prev,
        view: 'leaderboard',
        leaderboard,
        userStats,
        userPosition,
      }));
    } catch (err: any) {
      console.error('[SwipeFlowPage] Error loading leaderboard:', err);
      setState(prev => ({
        ...prev,
        view: 'leaderboard',
        leaderboard: [],
        error: 'Failed to load leaderboard',
      }));
    }
  }

  async function handleSelectMatchday(matchdayId: string) {
    const matchday = state.matchdays.find(md => md.id === matchdayId);
    if (!matchday) return;

    setState(prev => ({ ...prev, view: 'loading', currentMatchday: matchday }));

    try {
      const matchdayData = await swipeService.getMatchdayWithFixtures(matchdayId);
      const fixtures =
        matchdayData?.matchday_fixtures?.map((mf: any) => mf.fixture).filter(Boolean) || [];
      const matches = fixturesToSwipeMatches(fixtures);

      let predictions: Record<string, SwipePredictionRecord> = {};
      if (userId) {
        const predictionRecords = await swipeService.getUserMatchdayPredictions(matchdayId, userId);
        predictions = arrayToRecord(predictionRecords);
      }

      setState(prev => ({
        ...prev,
        view: 'recap',
        currentMatchday: matchday,
        matches,
        predictions,
      }));
    } catch (err: any) {
      console.error('[SwipeFlowPage] Error loading matchday:', err);
      setState(prev => ({
        ...prev,
        view: 'recap',
        error: 'Failed to load matchday',
      }));
    }
  }

  // =========================================================================
  // RENDER
  // =========================================================================

  // Loading state
  if (state.view === 'loading') {
    return (
      <div className="fixed inset-0 bg-deep-navy flex flex-col items-center justify-center z-40">
        <Loader2 className="animate-spin text-electric-blue" size={48} />
        <p className="mt-4 text-text-secondary font-semibold">Loading...</p>
      </div>
    );
  }

  // Error state
  if (state.view === 'error') {
    return (
      <div className="fixed inset-0 bg-deep-navy flex flex-col items-center justify-center z-40">
        <div className="text-center p-6 bg-navy-accent border border-white/10 rounded-2xl shadow-lg max-w-sm mx-4">
          <p className="text-text-primary font-semibold text-lg">Error</p>
          <p className="text-text-secondary text-sm mt-2">{state.error || 'Something went wrong'}</p>
          <button
            onClick={onExit}
            className="mt-4 px-6 py-3 bg-electric-blue text-white rounded-xl font-semibold w-full hover:bg-electric-blue/80"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Cards view (swiping)
  if (state.view === 'cards') {
    return (
      <SwipeCardStack
        matches={state.matches}
        predictions={state.predictions}
        hasSeenTutorial={hasSeenSwipeTutorial}
        onDismissTutorial={onDismissTutorial}
        onSwipe={handleSwipe}
        onComplete={handleSwipeComplete}
        onExit={state.editMode ? handleGoToRecap : onExit}
        editMode={state.editMode}
      />
    );
  }

  // Recap view
  if (state.view === 'recap') {
    return (
      <SwipeRecapView
        challenge={state.challenge}
        matchdays={state.matchdays}
        currentMatchday={state.currentMatchday}
        matches={state.matches}
        predictions={state.predictions}
        onBack={onExit}
        onEditPicks={handleGoToCards}
        onViewLeaderboard={handleGoToLeaderboard}
        onSelectMatchday={handleSelectMatchday}
        onUpdatePrediction={handleSwipe}
        onLinkGame={onLinkGame}
        profile={profile}
        userLeagues={userLeagues}
        leagueMembers={leagueMembers}
        leagueGames={leagueGames}
      />
    );
  }

  // Leaderboard view
  if (state.view === 'leaderboard') {
    return (
      <SwipeLeaderboardView
        challenge={state.challenge}
        leaderboard={state.leaderboard}
        userStats={state.userStats}
        userPosition={state.userPosition}
        currentUserId={userId}
        onBack={handleGoToRecap}
        userLeagues={userLeagues}
        leagueMembers={leagueMembers}
        leagueGames={leagueGames}
      />
    );
  }

  // Fallback
  return null;
};

export default SwipeFlowPage;
