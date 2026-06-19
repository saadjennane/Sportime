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

import React, { useState, useEffect, useRef, memo } from 'react';
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
import type { ChallengeMatchday, SwipePredictionRecord, BoosterUse } from '../services/swipeGameService';
import * as swipeService from '../services/swipeGameService';

type BoosterType = 'x2' | 'x3';
interface GameBoosters { x2: BoosterUse | null; x3: BoosterUse | null; }
const deriveBoosters = (uses: BoosterUse[]): GameBoosters => ({
  x2: uses.find(u => u.booster === 'x2') || null,
  x3: uses.find(u => u.booster === 'x3') || null,
});
import {
  fixturesToSwipeMatches,
  mapOutcomeToPrediction,
  mapPredictionToOutcome,
  predictionRecordsToSwipePredictions,
} from '../features/swipe/swipeMappers';
import { hasMatchesWithMissingOdds } from '../services/oddsSyncService';

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
  addToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
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
  addToast,
}) => {
  const [state, setState] = useState<SwipeState>(INITIAL_STATE);
  const [refreshKey, setRefreshKey] = useState(0);
  const [gameBoosters, setGameBoosters] = useState<GameBoosters>({ x2: null, x3: null });
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const reloadBoosters = async () => {
    if (!userId) return;
    try { setGameBoosters(deriveBoosters(await swipeService.getChallengeBoosters(challengeId, userId))); }
    catch { /* ignore */ }
  };

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

        // Extract period_type from rules JSONB field (stored in challenges.rules)
        const rules = challenge.rules as { period_type?: 'matchdays' | 'calendar' } | null;
        const periodType = rules?.period_type || 'matchdays';

        let currentMatchday: ChallengeMatchday | null = null;
        if (initialMatchdayId) {
          currentMatchday = matchdaysWithFixtures.find(md => md.id === initialMatchdayId) || null;
        }
        if (!currentMatchday && matchdaysWithFixtures.length > 0) {
          // Different behavior based on period_type:
          // - calendar: Show FIRST upcoming day (today or next with fixtures)
          // - matchdays: Show LAST non-finished matchday (existing behavior)

          if (periodType === 'calendar') {
            // Calendar: Find the FIRST matchday that is today or in the future
            const today = new Date().toISOString().split('T')[0];

            // Find upcoming matchday (date >= today)
            const upcoming = matchdaysWithFixtures.find(md => {
              const mdDate = md.date?.split('T')[0];
              return mdDate && mdDate >= today;
            });

            // If no upcoming matchday, ALL dates are in the past = recently finished game
            // In this case, show the LAST matchday (most recent)
            if (!upcoming) {
              currentMatchday = matchdaysWithFixtures[matchdaysWithFixtures.length - 1];
            } else {
              currentMatchday = upcoming;
            }
          } else {
            // Matchdays: Find the FIRST matchday that is NOT finished
            // Users progress through matchdays one at a time
            const firstNonFinished = matchdaysWithFixtures.find(md => md.status !== 'finished');
            currentMatchday = firstNonFinished || matchdaysWithFixtures[matchdaysWithFixtures.length - 1]; // All finished -> show last
          }
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
              period_type: periodType,
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

        // Load user stats for total points display
        let userStats = null;
        if (userId) {
          userStats = await swipeService.getUserChallengeStats(challengeId, userId);
          if (!isMounted) return;
        }

        // Load game-wide booster placements (one x2 + one x3 per game).
        if (userId) {
          try {
            const uses = await swipeService.getChallengeBoosters(challengeId, userId);
            if (isMounted) setGameBoosters(deriveBoosters(uses));
          } catch { /* ignore */ }
        }

        // Determine initial view based on matchday state and predictions
        const hasPredictions = Object.keys(predictions).length > 0;

        // Check if matchday is finished or first match has started
        const now = Date.now();
        const firstMatchKickoff = matches.length > 0
          ? Math.min(...matches.map(m => new Date(m.kickoffTime).getTime()))
          : null;
        const hasFirstMatchStarted = firstMatchKickoff !== null && firstMatchKickoff <= now;
        const isMatchdayLocked = currentMatchday.status === 'finished' || hasFirstMatchStarted;

        // If matchday is locked (finished or started), always show recap (read-only)
        // Otherwise, show cards if no predictions yet
        const initialView: ViewMode = isMatchdayLocked || hasPredictions ? 'recap' : 'cards';

        // On the silent odds-refresh (refreshKey > 0) we ONLY want fresh odds/data —
        // keep the user where they are (recap/leaderboard/edit) instead of snapping back.
        const isRefresh = refreshKey > 0;
        setState(prev => ({
          view: isRefresh ? prev.view : initialView,
          challenge: {
            id: challenge.id,
            name: challenge.name,
            description: challenge.description,
            start_date: challenge.start_date,
            end_date: challenge.end_date,
            status: challenge.status,
            period_type: periodType,
          },
          matchdays: matchdaysWithFixtures, // Only include matchdays that have fixtures
          currentMatchday,
          matches,
          predictions,
          leaderboard: isRefresh ? prev.leaderboard : [],
          userStats,
          userPosition: isRefresh ? prev.userPosition : null,
          error: null,
          isSaving: false,
          editMode: isRefresh ? prev.editMode : false,
        }));

        // Check if any matches have missing/default odds and schedule a single refresh
        // (after the sync-odds edge function triggered by swipeGameService).
        if (hasMatchesWithMissingOdds(matches) && refreshKey === 0) {
          refreshTimeoutRef.current = setTimeout(() => {
            setRefreshKey(prev => prev + 1);
          }, 10000);
        }
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
      // Cleanup refresh timeout
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [challengeId, initialMatchdayId, userId, refreshKey]);

  // =========================================================================
  // HANDLERS (plain functions, not useCallback - memo on children handles it)
  // =========================================================================

  function handleSwipe(matchId: string, prediction: SwipePredictionOutcome, booster?: BoosterType) {
    if (!state.currentMatchday || !userId) return;

    const match = state.matches.find(m => m.id === matchId);
    if (!match) return;

    // Remember the prior pick so we can roll back if the save fails.
    const prevRecord = state.predictions[matchId];

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
      .then(async savedRecord => {
        // Update with the real persisted record (keep any optimistic booster).
        if (savedRecord) {
          setState(prev => ({
            ...prev,
            predictions: {
              ...prev.predictions,
              [matchId]: { ...savedRecord, booster: prev.predictions[matchId]?.booster ?? null },
            },
          }));
        }
        // Apply the booster only once the pick is actually persisted (avoids no_prediction).
        if (booster && state.currentMatchday) {
          await applyBooster(matchId, booster);
        }
      })
      .catch(err => {
        console.error('[SwipeFlowPage] Error saving prediction:', err);
        // Roll back the optimistic pick and tell the user — never leave a phantom pick.
        setState(prev => {
          const next = { ...prev.predictions };
          if (prevRecord) next[matchId] = prevRecord; else delete next[matchId];
          return { ...prev, predictions: next };
        });
        const msg = String(err?.message || '').includes('odds_not_ready')
          ? 'Odds not ready yet — try again in a moment'
          : 'Could not save your pick — try again';
        addToast?.(msg, 'error');
      });
  }

  // Undo the last pick (re-show its card so the user can re-pick).
  function handleUndo(matchId: string) {
    setState(prev => {
      const next = { ...prev.predictions };
      delete next[matchId];
      return { ...prev, predictions: next };
    });
  }

  // Apply a booster to a predicted match (one x2 + one x3 per game).
  async function applyBooster(fixtureId: string, type: BoosterType) {
    const md = state.currentMatchday;
    if (!md) return;
    // Optimistic: stamp this match, free the type from any other local match.
    setState(prev => {
      const next: Record<string, SwipePredictionRecord> = {};
      for (const [fid, rec] of Object.entries(prev.predictions)) {
        next[fid] = rec.booster === type && fid !== fixtureId ? { ...rec, booster: null } : rec;
      }
      if (next[fixtureId]) next[fixtureId] = { ...next[fixtureId], booster: type };
      return { ...prev, predictions: next };
    });
    setGameBoosters(prev => ({ ...prev, [type]: { fixture_id: fixtureId, matchday_id: md.id, booster: type } }));
    try {
      await swipeService.setSwipeBooster(challengeId, md.id, fixtureId, type);
      await reloadBoosters();
    } catch {
      addToast?.('Could not apply booster — try again', 'error');
      await reloadBoosters();
    }
  }

  async function handleCancelBooster(fixtureId: string) {
    const md = state.currentMatchday;
    if (!md) return;
    const type = state.predictions[fixtureId]?.booster;
    setState(prev => ({
      ...prev,
      predictions: { ...prev.predictions, [fixtureId]: { ...prev.predictions[fixtureId], booster: null } },
    }));
    if (type) setGameBoosters(prev => ({ ...prev, [type]: null }));
    try {
      await swipeService.setSwipeBooster(challengeId, md.id, fixtureId, null);
      await reloadBoosters();
    } catch {
      addToast?.('Could not cancel booster — try again', 'error');
      await reloadBoosters();
    }
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
        onUndo={handleUndo}
        onComplete={handleSwipeComplete}
        onExit={state.editMode ? handleGoToRecap : onExit}
        editMode={state.editMode}
        gameBoosters={gameBoosters}
        currentMatchdayId={state.currentMatchday?.id ?? null}
        onCancelBooster={handleCancelBooster}
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
        totalPoints={state.userStats?.totalPoints}
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
        gameBoosters={gameBoosters}
        currentMatchdayId={state.currentMatchday?.id ?? null}
        onApplyBooster={applyBooster}
        onCancelBooster={handleCancelBooster}
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
