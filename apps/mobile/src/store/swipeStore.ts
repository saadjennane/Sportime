/**
 * Swipe Game Store (Zustand)
 *
 * Centralized state management for swipe prediction games.
 * Eliminates circular dependencies between hooks that caused React Error #310.
 *
 * Key benefits:
 * - Single source of truth for all swipe-related state
 * - Actions are stable references (never recreated)
 * - Selectors with shallow equality prevent unnecessary re-renders
 */

import { create } from 'zustand';
import * as swipeService from '../services/swipeGameService';
import {
  fixturesToSwipeMatches,
  predictionRecordsToSwipePredictions,
  mapOutcomeToPrediction,
  groupFixturesByDate,
} from '../features/swipe/swipeMappers';
import type { FixtureData } from '../features/swipe/swipeMappers';
import type {
  SwipeMatch,
  SwipeMatchDay,
  SwipePrediction,
  SwipePredictionOutcome,
  SwipeLeaderboardEntry,
} from '../types';
import type {
  ChallengeMatchday,
  SwipePredictionRecord,
} from '../services/swipeGameService';

// ============================================================================
// STATE TYPES
// ============================================================================

interface SwipeState {
  // Challenge data
  challenge: SwipeMatchDay | null;
  matchdays: ChallengeMatchday[];
  currentMatchday: ChallengeMatchday | null;
  matches: SwipeMatch[];
  matchesByDate: Map<string, SwipeMatch[]>;

  // Predictions
  predictions: SwipePrediction[];
  predictionRecords: SwipePredictionRecord[];

  // Leaderboard
  leaderboard: SwipeLeaderboardEntry[];
  matchdayLeaderboard: SwipeLeaderboardEntry[];
  userPosition: number | null;
  userStats: {
    totalPoints: number;
    rank: number | null;
    totalPredictions: number;
    correctPredictions: number;
    accuracy: number;
    matchdaysCompleted: number;
  } | null;

  // Loading states
  isLoadingGame: boolean;
  isLoadingPredictions: boolean;
  isLoadingLeaderboard: boolean;
  isSaving: boolean;

  // Errors
  error: Error | null;

  // Context
  challengeId: string | null;
  userId: string | null;
  hasJoined: boolean;
}

interface SwipeActions {
  // Initialize the store for a challenge
  initSwipe: (
    challengeId: string,
    userId: string | null,
    matchdayId?: string
  ) => Promise<void>;

  // Matchday selection
  selectMatchday: (matchdayId: string) => Promise<void>;

  // Predictions
  savePrediction: (
    fixtureId: string,
    prediction: SwipePredictionOutcome,
    odds: { teamA: number; draw: number; teamB: number }
  ) => Promise<void>;

  // Leaderboard
  loadLeaderboard: () => Promise<void>;
  loadMatchdayLeaderboard: (matchdayId: string) => Promise<void>;

  // Join game
  joinGame: () => Promise<void>;

  // Refresh
  refresh: () => Promise<void>;

  // Cleanup
  reset: () => void;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: SwipeState = {
  challenge: null,
  matchdays: [],
  currentMatchday: null,
  matches: [],
  matchesByDate: new Map(),
  predictions: [],
  predictionRecords: [],
  leaderboard: [],
  matchdayLeaderboard: [],
  userPosition: null,
  userStats: null,
  isLoadingGame: false,
  isLoadingPredictions: false,
  isLoadingLeaderboard: false,
  isSaving: false,
  error: null,
  challengeId: null,
  userId: null,
  hasJoined: false,
};

// ============================================================================
// STORE
// ============================================================================

export const useSwipeStore = create<SwipeState & SwipeActions>((set, get) => ({
  ...initialState,

  // --------------------------------------------------------------------------
  // Initialize the store for a challenge
  // --------------------------------------------------------------------------
  initSwipe: async (challengeId, userId, matchdayId) => {
    // Skip if already initialized for same challenge/user
    const state = get();
    if (
      state.challengeId === challengeId &&
      state.userId === userId &&
      state.challenge !== null
    ) {
      // If just matchday changed, select it
      if (matchdayId && matchdayId !== state.currentMatchday?.id) {
        await get().selectMatchday(matchdayId);
      }
      return;
    }

    set({
      isLoadingGame: true,
      isLoadingPredictions: true,
      error: null,
      challengeId,
      userId,
    });

    try {
      // 1. Load challenge data
      const challengeData = await swipeService.getSwipeChallenge(challengeId);
      const leagueData = challengeData.challenge_leagues?.[0]?.league;

      const challenge: SwipeMatchDay = {
        id: challengeData.id,
        name: challengeData.name,
        description: challengeData.description || '',
        league_id: leagueData?.id,
        league_name: leagueData?.name || '',
        league_logo: leagueData?.logo || '',
        start_date: challengeData.start_date,
        end_date: challengeData.end_date,
        game_type: 'prediction',
        tier: 'free',
        entry_cost: challengeData.entry_cost || 0,
        rewards: challengeData.prizes || [],
        matches: [],
        status: challengeData.status,
      };

      // 2. Load matchdays
      const matchdaysData = await swipeService.getChallengeMatchdays(challengeId);

      // 3. Check if user has joined
      let hasJoined = false;
      if (userId) {
        hasJoined = await swipeService.hasJoinedChallenge(challengeId, userId);
      }

      set({
        challenge,
        matchdays: matchdaysData,
        hasJoined,
      });

      // 4. Select and load matchday
      if (matchdaysData.length > 0) {
        let selectedMatchday: ChallengeMatchday;

        if (matchdayId) {
          selectedMatchday =
            matchdaysData.find(md => md.id === matchdayId) || matchdaysData[0];
        } else {
          // Select first active/upcoming matchday
          selectedMatchday =
            matchdaysData.find(md => md.status !== 'finished') ||
            matchdaysData[matchdaysData.length - 1];
        }

        // Load matchday with fixtures
        const matchdayData = await swipeService.getMatchdayWithFixtures(
          selectedMatchday.id
        );

        if (matchdayData) {
          const matchdayFixtures = matchdayData.matchday_fixtures || [];
          const fixtures = matchdayFixtures
            .map((mf: any) => mf.fixture)
            .filter(Boolean) as FixtureData[];

          // Get user predictions if logged in
          let predictions: SwipePredictionRecord[] = [];
          if (userId) {
            predictions = await swipeService.getUserMatchdayPredictions(
              selectedMatchday.id,
              userId
            );
          }

          // Transform to SwipeMatch format
          const swipeMatches = fixturesToSwipeMatches(fixtures, predictions);
          const uiPredictions = predictionRecordsToSwipePredictions(predictions);

          // Group by date
          const fixturesByDate = groupFixturesByDate(fixtures);
          const matchesByDateMap = new Map<string, SwipeMatch[]>();
          const predictionsByFixtureId = new Map(
            predictions.map(p => [p.fixture_id, p])
          );

          for (const [date, dateFixtures] of fixturesByDate.entries()) {
            const datePredictions = dateFixtures
              .map(f => predictionsByFixtureId.get(f.id))
              .filter(Boolean) as SwipePredictionRecord[];
            matchesByDateMap.set(
              date,
              fixturesToSwipeMatches(dateFixtures, datePredictions)
            );
          }

          set({
            currentMatchday: matchdayData,
            matches: swipeMatches,
            matchesByDate: matchesByDateMap,
            predictions: uiPredictions,
            predictionRecords: predictions,
          });
        }
      } else {
        set({
          currentMatchday: null,
          matches: [],
          matchesByDate: new Map(),
        });
      }
    } catch (err) {
      console.error('Error initializing swipe store:', err);
      set({ error: err as Error });
    } finally {
      set({
        isLoadingGame: false,
        isLoadingPredictions: false,
      });
    }
  },

  // --------------------------------------------------------------------------
  // Select a different matchday
  // --------------------------------------------------------------------------
  selectMatchday: async (matchdayId) => {
    const { userId } = get();

    set({
      isLoadingGame: true,
      isLoadingPredictions: true,
      error: null,
    });

    try {
      const matchdayData = await swipeService.getMatchdayWithFixtures(matchdayId);

      if (!matchdayData) {
        set({ error: new Error('Matchday not found') });
        return;
      }

      const matchdayFixtures = matchdayData.matchday_fixtures || [];
      const fixtures = matchdayFixtures
        .map((mf: any) => mf.fixture)
        .filter(Boolean) as FixtureData[];

      // Get user predictions if logged in
      let predictions: SwipePredictionRecord[] = [];
      if (userId) {
        predictions = await swipeService.getUserMatchdayPredictions(
          matchdayId,
          userId
        );
      }

      // Transform to SwipeMatch format
      const swipeMatches = fixturesToSwipeMatches(fixtures, predictions);
      const uiPredictions = predictionRecordsToSwipePredictions(predictions);

      // Group by date
      const fixturesByDate = groupFixturesByDate(fixtures);
      const matchesByDateMap = new Map<string, SwipeMatch[]>();
      const predictionsByFixtureId = new Map(
        predictions.map(p => [p.fixture_id, p])
      );

      for (const [date, dateFixtures] of fixturesByDate.entries()) {
        const datePredictions = dateFixtures
          .map(f => predictionsByFixtureId.get(f.id))
          .filter(Boolean) as SwipePredictionRecord[];
        matchesByDateMap.set(
          date,
          fixturesToSwipeMatches(dateFixtures, datePredictions)
        );
      }

      set({
        currentMatchday: matchdayData,
        matches: swipeMatches,
        matchesByDate: matchesByDateMap,
        predictions: uiPredictions,
        predictionRecords: predictions,
      });
    } catch (err) {
      console.error('Error selecting matchday:', err);
      set({ error: err as Error });
    } finally {
      set({
        isLoadingGame: false,
        isLoadingPredictions: false,
      });
    }
  },

  // --------------------------------------------------------------------------
  // Save a prediction (with optimistic update)
  // --------------------------------------------------------------------------
  savePrediction: async (fixtureId, prediction, odds) => {
    const { challengeId, currentMatchday, userId, predictions } = get();

    if (!userId || !currentMatchday || !challengeId) {
      throw new Error('User must be logged in to save predictions');
    }

    set({ isSaving: true, error: null });

    // 1. Create optimistic prediction
    const optimisticPrediction: SwipePrediction = {
      matchId: fixtureId,
      prediction,
      oddsAtPrediction: odds,
    };

    // 2. Store previous state for rollback
    const previousPredictions = predictions;

    // 3. Optimistic update - update local state immediately
    set(state => {
      const existingIndex = state.predictions.findIndex(
        p => p.matchId === fixtureId
      );
      let newPredictions: SwipePrediction[];

      if (existingIndex >= 0) {
        // Update existing prediction
        newPredictions = [...state.predictions];
        newPredictions[existingIndex] = optimisticPrediction;
      } else {
        // Add new prediction
        newPredictions = [...state.predictions, optimisticPrediction];
      }

      return { predictions: newPredictions };
    });

    try {
      // 4. Convert and save to DB
      const dbOdds = {
        home: odds.teamA,
        draw: odds.draw,
        away: odds.teamB,
      };
      const dbPrediction = mapOutcomeToPrediction(prediction);

      await swipeService.savePrediction({
        challengeId,
        matchdayId: currentMatchday.id,
        userId,
        fixtureId,
        prediction: dbPrediction,
        odds: dbOdds,
      });

      // Success! Local state is already correct
    } catch (err) {
      // 5. Rollback on error - restore previous state
      console.error('Error saving prediction:', err);
      set({ predictions: previousPredictions, error: err as Error });
      throw err;
    } finally {
      set({ isSaving: false });
    }
  },

  // --------------------------------------------------------------------------
  // Load challenge leaderboard
  // --------------------------------------------------------------------------
  loadLeaderboard: async () => {
    const { challengeId, userId } = get();

    if (!challengeId) return;

    set({ isLoadingLeaderboard: true, error: null });

    try {
      const data = await swipeService.getChallengeLeaderboard(challengeId);
      set({ leaderboard: data });

      // Find user position
      if (userId) {
        const userIndex = data.findIndex(entry => entry.userId === userId);
        set({ userPosition: userIndex >= 0 ? userIndex + 1 : null });

        // Load user stats
        const stats = await swipeService.getUserChallengeStats(
          challengeId,
          userId
        );
        set({ userStats: stats });
      }
    } catch (err) {
      console.error('Error loading leaderboard:', err);
      set({ error: err as Error });
    } finally {
      set({ isLoadingLeaderboard: false });
    }
  },

  // --------------------------------------------------------------------------
  // Load matchday-specific leaderboard
  // --------------------------------------------------------------------------
  loadMatchdayLeaderboard: async (matchdayId) => {
    set({ isLoadingLeaderboard: true, error: null });

    try {
      const data = await swipeService.getMatchdayLeaderboard(matchdayId);
      set({ matchdayLeaderboard: data });
    } catch (err) {
      console.error('Error loading matchday leaderboard:', err);
      set({ error: err as Error });
    } finally {
      set({ isLoadingLeaderboard: false });
    }
  },

  // --------------------------------------------------------------------------
  // Join game
  // --------------------------------------------------------------------------
  joinGame: async () => {
    const { challengeId, userId } = get();

    if (!userId || !challengeId) return;

    try {
      await swipeService.joinSwipeChallenge(challengeId, userId);
      set({ hasJoined: true });
    } catch (err) {
      console.error('Error joining game:', err);
      throw err;
    }
  },

  // --------------------------------------------------------------------------
  // Refresh all data
  // --------------------------------------------------------------------------
  refresh: async () => {
    const { challengeId, userId, currentMatchday } = get();

    if (!challengeId) return;

    // Re-initialize with current matchday
    await get().initSwipe(challengeId, userId, currentMatchday?.id);
  },

  // --------------------------------------------------------------------------
  // Reset store (cleanup)
  // --------------------------------------------------------------------------
  reset: () => {
    set(initialState);
  },
}));
