import React, { useState, useMemo } from 'react';
import { SportimeGame, UserChallengeEntry, UserSwipeEntry, UserFantasyTeam, Profile, UserTicket, GameFilters } from '../types';
import { GameCard } from '../components/GameCard';
import { RewardsPreviewModal } from '../components/RewardsPreviewModal';
import { GameInfoModal } from '../components/GameInfoModal';
import { GamesFilterPanel } from '../components/filters/GamesFilterPanel';
import { PullToRefresh } from '../components/PullToRefresh';
import { hapticImpact } from '../native/haptics';
import { checkEligibility } from '../lib/eligibility';
import { GameSection } from '../components/GameSection';
import { EmptyState } from '../components/EmptyState';
import { parseISO } from 'date-fns';
import { Zap, Clock, Flag, Trophy, Flame } from 'lucide-react';
import { calculateBettingGameState, safeParseISO, parseEndDateLocal, getBettingGameDeadline, calculateGameState, getGameDeadline, areAllMatchesFinished } from '../services/gameStateService';
import { hasViewedResults, markResultsViewed } from '../services/resultsViewedService';

export type CtaState = 'JOIN' | 'PLACE_BETS' | 'MAKE_PREDICTIONS' | 'SELECT_TEAM' | 'COMPLETE_TEAM' | 'AWAITING' | 'RESULTS' | 'IN_PROGRESS' | 'LOCKED' | 'INELIGIBLE';
type GamesTab = 'my-games' | 'browse';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Calculates entry deadline: 30 minutes before the first match
 * Priority: first_kickoff_time > matches[].kickoffTime > end_date (fallback)
 */
export function calculateEntryDeadline(game: SportimeGame): Date {
  // Priority 1: Use first_kickoff_time if available (set by fetchChallengeCatalog)
  if (game.first_kickoff_time) {
    const kickoffDate = new Date(game.first_kickoff_time);
    if (!isNaN(kickoffDate.getTime())) {
      return new Date(kickoffDate.getTime() - 30 * 60 * 1000); // 30 minutes before first match
    }
  }

  // Priority 2: Try to get the earliest kickoff time from matches array
  if (game.matches && game.matches.length > 0) {
    const kickoffTimes = game.matches
      .map(m => new Date(m.kickoffTime).getTime())
      .filter(t => !isNaN(t));

    if (kickoffTimes.length > 0) {
      const firstKickoff = Math.min(...kickoffTimes);
      return new Date(firstKickoff - 30 * 60 * 1000);
    }
  }

  // Fallback to end_date to avoid premature locking
  // Games without matches remain open until end_date
  // Parse end_date and set to end of day in LOCAL time to avoid timezone issues
  // parseISO("2025-12-06") creates UTC midnight, which shifts the date in local timezones
  const [year, month, day] = game.end_date.split('T')[0].split('-').map(Number);
  const endDate = new Date(year, month - 1, day, 23, 59, 59, 999);
  return endDate;
}

/**
 * Checks if entry is still open (before deadline)
 */
function isEntryOpen(game: SportimeGame): boolean {
  const deadline = calculateEntryDeadline(game);
  return new Date() < deadline;
}

/**
 * Checks if the first match of a game has started
 * Used to lock betting/predictions once matches begin
 */
function hasFirstMatchStarted(game: SportimeGame): boolean {
  if (game.first_kickoff_time) {
    return new Date(game.first_kickoff_time) <= new Date();
  }
  // If no first_kickoff_time, game has no matches yet - not locked
  // User can continue to play until matches are added
  return false;
}

/**
 * Determines the real status of a game based on match completion.
 *
 * A game is only "Finished" (Past Games) when:
 * 1. ALL matches are completed (have results)
 * 2. AND the user has clicked "View Results" (stored in localStorage)
 *
 * This applies to betting, prediction, and fantasy games.
 */
function getRealGameStatus(game: SportimeGame, now: Date): 'Upcoming' | 'Ongoing' | 'Finished' | 'Cancelled' {
  // Cancelled games stay cancelled
  if (game.status === 'Cancelled') {
    return 'Cancelled';
  }

  const startDate = safeParseISO(game.start_date);

  // Game is "Finished" only when:
  // 1. ALL matches are completed (have results)
  // 2. AND user has viewed results
  const allMatchesFinished = areAllMatchesFinished(game);
  if (allMatchesFinished && hasViewedResults(game.id)) {
    return 'Finished';
  }

  // For games that haven't started yet
  if (startDate && startDate > now) {
    return 'Upcoming';
  }

  // Game is ongoing (started but not all matches finished, or not viewed results yet)
  return 'Ongoing';
}

interface GamesListPageProps {
  games: SportimeGame[];
  userChallengeEntries: UserChallengeEntry[];
  userSwipeEntries: UserSwipeEntry[];
  userFantasyTeams: UserFantasyTeam[];
  onJoinChallenge: (challenge: SportimeGame) => void;
  onViewChallenge: (challengeId: string) => void;
  onJoinSwipeGame: (gameId: string) => void;
  onPlaySwipeGame: (matchDayId: string) => void;
  onViewFantasyGame: (gameId: string) => void;
  myGamesCount: number;
  profile: Profile | null;
  userTickets: UserTicket[];
  onRefresh?: () => void | Promise<void>;
}

const GamesListPage: React.FC<GamesListPageProps> = (props) => {
  const { games, userChallengeEntries, userSwipeEntries, userFantasyTeams, onJoinChallenge, onViewChallenge, onJoinSwipeGame, onPlaySwipeGame, onViewFantasyGame, profile, userTickets, onRefresh } = props;

  const [activeTab, setActiveTab] = useState<GamesTab>('my-games');
  const [filters, setFilters] = useState<GameFilters>({
    type: 'all',
    format: 'all',
    tier: 'all',
    duration: 'all',
    eligibleOnly: false,
  });
  const [viewingRewardsFor, setViewingRewardsFor] = useState<SportimeGame | null>(null);
  const [viewingInfoFor, setViewingInfoFor] = useState<SportimeGame | null>(null);

  const myGameIds = useMemo(() => {
    if (!profile) return new Set();
    const ids = new Set<string>();
    userChallengeEntries.forEach(e => ids.add(e.challengeId));
    userSwipeEntries.forEach(e => ids.add(e.matchDayId));
    userFantasyTeams.forEach(e => ids.add(e.gameId));
    return ids;
  }, [userChallengeEntries, userSwipeEntries, userFantasyTeams, profile]);

  const processedGames = useMemo(() => {
    return games
      .map(game => {
        const { isEligible } = checkEligibility(profile, game, userTickets);
        return { ...game, isEligible };
      })
      .filter(game => {
        if (filters.type !== 'all' && game.game_type !== filters.type) return false;
        if (filters.format !== 'all' && game.format !== filters.format) return false;
        if (filters.tier !== 'all' && game.tier !== filters.tier) return false;
        if (filters.duration !== 'all' && game.duration_type !== filters.duration) return false;
        if (filters.eligibleOnly && !game.isEligible) return false;
        return true;
      });
  }, [games, profile, userTickets, filters]);

  // Categorization for My Games tab - 4 sections
  const { playNowGames, awaitingGames, recentlyFinishedGames, pastGamesSection } = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS);

    const playNow: (SportimeGame & { isEligible: boolean })[] = [];
    const awaiting: (SportimeGame & { isEligible: boolean })[] = [];
    const recentlyFinished: (SportimeGame & { isEligible: boolean })[] = [];
    const past: (SportimeGame & { isEligible: boolean })[] = [];

    for (const game of processedGames) {
      const hasJoined = myGameIds.has(game.id);
      if (!hasJoined) continue; // My Games = only joined games

      // RULE: Game is finished when ALL matches are completed (have results)
      const allMatchesFinished = areAllMatchesFinished(game);
      if (allMatchesFinished && game.matches && game.matches.length > 0) {
        // Use last match kickoff time to determine if "recently" finished (< 7 days)
        const lastMatchKickoff = Math.max(...game.matches.map(m => new Date(m.kickoffTime).getTime()));
        const lastMatchDate = new Date(lastMatchKickoff);
        if (lastMatchDate > sevenDaysAgo) {
          recentlyFinished.push(game);
        } else {
          past.push(game);
        }
        continue;
      }

      // Cancelled games go to Past Games
      if (game.status === 'Cancelled') {
        past.push(game);
        continue;
      }

      // Server marked the challenge finished (end_date passed) -> Recently Finished / Past.
      if (game.status === 'Finished') {
        const lastTs = game.matches && game.matches.length > 0
          ? Math.max(...game.matches.map(m => new Date(m.kickoffTime).getTime()))
          : new Date(game.end_date).getTime();
        if (lastTs > sevenDaysAgo.getTime()) recentlyFinished.push(game);
        else past.push(game);
        continue;
      }

      // UNIFIED CATEGORIZATION for ALL game types (betting, prediction, fantasy)
      // Supports BOTH period_types (matchdays and calendar)
      const userEntry = userChallengeEntries.find(e => e.challengeId === game.id);
      const userFantasyTeam = userFantasyTeams.find(t => t.gameId === game.id);
      const gameState = calculateGameState(game, userEntry, userFantasyTeam, now);

      if (gameState.category === 'awaiting') {
        awaiting.push(game);
      } else if (gameState.category === 'finished') {
        // Shouldn't happen since end_date passed is handled above, but just in case
        recentlyFinished.push(game);
      } else {
        playNow.push(game);
      }
    }

    // Sorting - Play Now by deadline (most urgent first)
    // Uses unified getGameDeadline for ALL game types
    const getDeadlineForSort = (game: SportimeGame): number => {
      const userEntry = userChallengeEntries.find(e => e.challengeId === game.id);
      const userFantasyTeam = userFantasyTeams.find(t => t.gameId === game.id);
      const deadline = getGameDeadline(game, userEntry, userFantasyTeam, now);
      return deadline ? deadline.getTime() : Infinity;
    };

    const sortByDeadline = (a: SportimeGame, b: SportimeGame) => getDeadlineForSort(a) - getDeadlineForSort(b);
    // Sort finished games by last match kickoff (most recent first)
    const getLastMatchKickoff = (game: SportimeGame): number => {
      if (!game.matches || game.matches.length === 0) return 0;
      return Math.max(...game.matches.map(m => new Date(m.kickoffTime).getTime()));
    };
    const sortByLastMatchDesc = (a: SportimeGame, b: SportimeGame) => getLastMatchKickoff(b) - getLastMatchKickoff(a);

    playNow.sort(sortByDeadline);
    awaiting.sort(sortByDeadline);
    recentlyFinished.sort(sortByLastMatchDesc);
    past.sort(sortByLastMatchDesc);

    return { playNowGames: playNow, awaitingGames: awaiting, recentlyFinishedGames: recentlyFinished, pastGamesSection: past };
  }, [processedGames, myGameIds, userChallengeEntries, userSwipeEntries, userFantasyTeams]);

  // Separate games into 3 categories for Browse tab:
  // 1. availableGames: can still join (entry open)
  // 2. inProgressGames: started but can't join anymore (locked)
  // 3. pastGames: finished or cancelled
  const { availableGames, inProgressGames, pastGames } = useMemo(() => {
    const now = new Date();

    const available: (SportimeGame & { isEligible: boolean })[] = [];
    const inProgress: (SportimeGame & { isEligible: boolean })[] = [];
    const past: (SportimeGame & { isEligible: boolean })[] = [];

    for (const game of processedGames) {
      // Hide joined games from Browse tab
      const hasJoined = myGameIds.has(game.id);
      if (hasJoined) continue;

      // Allow games with 0 players if entry is still open (new games need to be visible!)
      // Only hide empty games that are already past/finished
      const entryStillOpen = isEntryOpen(game);
      if (game.totalPlayers === 0 && !entryStillOpen) continue;

      const realStatus = getRealGameStatus(game, now);
      // Also check if end_date has passed (game is definitely finished)
      const endDatePassed = parseISO(game.end_date) < now;

      if (realStatus === 'Finished' || realStatus === 'Cancelled' || endDatePassed) {
        past.push(game);
      } else {
        // Check if entry is still open
        const entryOpen = isEntryOpen(game);
        if (entryOpen) {
          available.push(game);
        } else {
          // Registration closed but game not finished yet
          inProgress.push(game);
        }
      }
    }

    const sortByStartDate = (a: SportimeGame, b: SportimeGame) => parseISO(a.start_date).getTime() - parseISO(b.start_date).getTime();
    const sortByEndDateDesc = (a: SportimeGame, b: SportimeGame) => parseISO(b.end_date).getTime() - parseISO(a.end_date).getTime();

    return {
      availableGames: available.sort(sortByStartDate),
      inProgressGames: inProgress.sort(sortByStartDate),
      pastGames: past.sort(sortByEndDateDesc)
    };
  }, [processedGames, myGameIds]);

  const getCtaState = (game: SportimeGame & { isEligible: boolean }, isInMyGamesTab: boolean): CtaState => {
    const hasJoined = myGameIds.has(game.id);
    const now = new Date();
    const realStatus = getRealGameStatus(game, now);
    const entryOpen = isEntryOpen(game);

    // Finished games
    if (realStatus === 'Finished' || realStatus === 'Cancelled') {
      return 'RESULTS';
    }

    // Not joined - check if entry is still open
    if (!hasJoined) {
      // Entry deadline determines if registration is open, not start_date
      // A game can have start_date passed (start of the matchday weekend) but still accept entries
      // until 30 minutes before the first match kickoff (entry deadline)
      if (!entryOpen) {
        return 'LOCKED';
      }
      // Entry open but the user doesn't meet the requirements
      if (!game.isEligible) {
        return 'INELIGIBLE';
      }
      // Entry still open
      return 'JOIN';
    }

    // USER HAS JOINED - use unified calculateGameState for ALL game types
    // Supports betting, prediction, fantasy with both matchdays and calendar period_types
    const userEntry = userChallengeEntries.find(e => e.challengeId === game.id);
    const userFantasyTeam = userFantasyTeams.find(t => t.gameId === game.id);
    const gameState = calculateGameState(game, userEntry, userFantasyTeam, now);

    // Map unified GameCTA to component CtaState
    switch (gameState.cta) {
      case 'PLACE_BETS':
      case 'EDIT_BETS':
        return 'PLACE_BETS';
      case 'MAKE_PREDICTIONS':
        return 'MAKE_PREDICTIONS';
      case 'SELECT_TEAM':
        return 'SELECT_TEAM';
      case 'COMPLETE_TEAM':
        return 'COMPLETE_TEAM';
      case 'VIEW_GAME':
        return 'AWAITING';
      case 'VIEW_RESULTS':
        return 'RESULTS';
      default:
        return 'AWAITING';
    }
  };

  const renderGameCard = (game: SportimeGame & { isEligible: boolean }, isInMyGamesTab: boolean) => {
    const ctaState = getCtaState(game, isInMyGamesTab);

    // Wrap navigation with markResultsViewed when viewing results
    const wrapWithResultsViewed = (action: () => void) => () => {
      if (ctaState === 'RESULTS') {
        markResultsViewed(game.id);
      }
      action();
    };

    let onPlayAction = () => {};
    if (game.game_type === 'betting') onPlayAction = wrapWithResultsViewed(() => onViewChallenge(game.id));
    if (game.game_type === 'prediction') onPlayAction = wrapWithResultsViewed(() => onPlaySwipeGame(game.id));
    if (game.game_type === 'fantasy') onPlayAction = wrapWithResultsViewed(() => onViewFantasyGame(game.id));

    // For live games not joined, show leaderboard in read-only mode
    const handleViewLeaderboard = () => {
      if (game.game_type === 'betting') onViewChallenge(game.id);
      if (game.game_type === 'prediction') onPlaySwipeGame(game.id);
      if (game.game_type === 'fantasy') onViewFantasyGame(game.id);
    };

    // Find user's entry for this game (for progress indicator)
    const userEntry = userChallengeEntries.find(e => e.challengeId === game.id);
    const userSwipeEntry = userSwipeEntries.find(e => e.matchDayId === game.id);

    return (
      <GameCard
        key={game.id}
        game={game}
        ctaState={ctaState}
        onJoinClick={() => {
          hapticImpact('medium');
          game.game_type === 'betting' ? onJoinChallenge(game) : onJoinSwipeGame(game.id);
        }}
        onPlay={() => { hapticImpact('light'); onPlayAction(); }}
        onShowRewards={() => setViewingRewardsFor(game)}
        onShowInfo={(game) => setViewingInfoFor(game)}
        onViewLeaderboard={handleViewLeaderboard}
        profile={profile}
        userTickets={userTickets}
        userEntry={userEntry}
        userSwipeEntry={userSwipeEntry}
      />
    );
  };

  return (
    <PullToRefresh onRefresh={onRefresh ?? (() => {})}>
    <div className="space-y-4">
      {/* Tab Switcher */}
      <div className="flex bg-navy-accent rounded-xl p-1">
        <button
          onClick={() => { hapticImpact('light'); setActiveTab('my-games'); }}
          className={`flex-1 p-3 rounded-lg font-semibold transition-all text-sm ${
            activeTab === 'my-games'
              ? 'bg-electric-blue text-white shadow'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          My Games
        </button>
        <button
          onClick={() => { hapticImpact('light'); setActiveTab('browse'); }}
          className={`flex-1 p-3 rounded-lg font-semibold transition-all text-sm ${
            activeTab === 'browse'
              ? 'bg-electric-blue text-white shadow'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Browse Games
        </button>
      </div>

      {/* My Games Tab */}
      {activeTab === 'my-games' && (
        (playNowGames.length === 0 && awaitingGames.length === 0 && recentlyFinishedGames.length === 0 && pastGamesSection.length === 0) ? (
          <EmptyState
            glyph="🚀"
            title="You're not in any game"
            subtitle="Join a Game, and climb the leaderboard."
            cta={{ label: '🔍 Browse Games', onClick: () => { hapticImpact('light'); setActiveTab('browse'); } }}
          />
        ) : (
        <>
          <GameSection
            title="Play Now"
            count={playNowGames.length}
            icon={<Zap />}
            colorClass="text-lime-glow"
            defaultOpen={true}
          >
            {playNowGames.map(game => renderGameCard(game, true))}
          </GameSection>

          <GameSection
            title="Awaiting Results"
            count={awaitingGames.length}
            icon={<Clock />}
            colorClass="text-warm-yellow"
            defaultOpen={true}
          >
            {awaitingGames.map(game => renderGameCard(game, true))}
          </GameSection>

          <GameSection
            title="Recently Finished"
            count={recentlyFinishedGames.length}
            icon={<Trophy />}
            colorClass="text-neon-cyan"
            defaultOpen={true}
          >
            {recentlyFinishedGames.map(game => renderGameCard(game, true))}
          </GameSection>

          <GameSection
            title="Past Games"
            count={pastGamesSection.length}
            icon={<Flag />}
            colorClass="text-text-disabled"
            defaultOpen={false}
          >
            {pastGamesSection.map(game => renderGameCard(game, true))}
          </GameSection>
        </>
        )
      )}

      {/* Browse Games Tab */}
      {activeTab === 'browse' && (
        <>
          <GamesFilterPanel filters={filters} onFilterChange={setFilters} />

          {/* Available Games - displayed directly */}
          <div className="space-y-4">
            {availableGames.length > 0 ? (
              availableGames.map(game => renderGameCard(game, false))
            ) : (
              <div className="card-base p-8 text-center">
                <p className="text-text-secondary text-sm">No games available to join.</p>
                <p className="text-text-secondary text-xs mt-2">Check back later or adjust your filters.</p>
              </div>
            )}
          </div>

          {/* In Progress Games Section - collapsed by default */}
          <GameSection
            title="In Progress"
            count={inProgressGames.length}
            icon={<Flame size={18} />}
            colorClass="text-gray-400"
            defaultOpen={false}
          >
            {inProgressGames.map(game => renderGameCard(game, false))}
          </GameSection>

          {/* Past Games Section */}
          <GameSection
            title="Past Games"
            count={pastGames.length}
            icon={<Flag size={18} />}
            colorClass="text-text-disabled"
            defaultOpen={false}
          >
            {pastGames.map(game => renderGameCard(game, false))}
          </GameSection>
        </>
      )}

      {/* Modals */}
      {viewingRewardsFor && (
        <RewardsPreviewModal
          isOpen={!!viewingRewardsFor}
          onClose={() => setViewingRewardsFor(null)}
          game={viewingRewardsFor}
        />
      )}

      <GameInfoModal
        isOpen={viewingInfoFor !== null}
        onClose={() => setViewingInfoFor(null)}
        game={viewingInfoFor}
      />
    </div>
    </PullToRefresh>
  );
};

export default GamesListPage;
