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
import { Zap, Clock, Flag, Trophy, Flame, Loader2, Search } from 'lucide-react';
import { calculateBettingGameState, safeParseISO, parseEndDateLocal, getBettingGameDeadline, calculateGameState, getGameDeadline, areAllMatchesFinished } from '../services/gameStateService';
import { hasViewedResults, markResultsViewed } from '../services/resultsViewedService';
import { gameTypeIdentity } from '../components/games/gameTypeIdentity';

export type CtaState = 'JOIN' | 'PLACE_BETS' | 'MAKE_PREDICTIONS' | 'SELECT_TEAM' | 'COMPLETE_TEAM' | 'AWAITING' | 'RESULTS' | 'IN_PROGRESS' | 'LOCKED' | 'INELIGIBLE';
type GamesTab = 'my-games' | 'browse';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Calculates entry deadline: ENTRY_LOCK_BUFFER_MS before the first match
 * Priority: first_kickoff_time > matches[].kickoffTime > end_date (fallback)
 */
// Entry closes this long before the first kickoff (was 30 min — reduced to allow later sign-ups).
const ENTRY_LOCK_BUFFER_MS = 15 * 60 * 1000;

export function calculateEntryDeadline(game: SportimeGame): Date {
  // Priority 0: explicit admin override always wins.
  if (game.entry_lock_at) {
    const override = new Date(game.entry_lock_at);
    if (!isNaN(override.getTime())) return override;
  }

  // Priority 1: Use first_kickoff_time if available (set by fetchChallengeCatalog)
  if (game.first_kickoff_time) {
    const kickoffDate = new Date(game.first_kickoff_time);
    if (!isNaN(kickoffDate.getTime())) {
      return new Date(kickoffDate.getTime() - ENTRY_LOCK_BUFFER_MS);
    }
  }

  // Priority 2: Try to get the earliest kickoff time from matches array
  if (game.matches && game.matches.length > 0) {
    const kickoffTimes = game.matches
      .map(m => new Date(m.kickoffTime).getTime())
      .filter(t => !isNaN(t));

    if (kickoffTimes.length > 0) {
      const firstKickoff = Math.min(...kickoffTimes);
      return new Date(firstKickoff - ENTRY_LOCK_BUFFER_MS);
    }
  }

  // Fallback to end_date to avoid premature locking
  // Games without matches remain open until end_date
  // Parse end_date and set to end of day in LOCAL time to avoid timezone issues
  // parseISO("2025-12-06") creates UTC midnight, which shifts the date in local timezones
  // Some games (e.g. Tournament Quest) have no fixed end_date -> keep entry open.
  if (!game.end_date || typeof game.end_date !== 'string') {
    return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // far future = stays open
  }
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
  joinedGameIds?: Set<string>;
  onJoinChallenge: (challenge: SportimeGame) => void;
  onViewChallenge: (challengeId: string) => void;
  onJoinSwipeGame: (gameId: string) => void;
  onPlaySwipeGame: (matchDayId: string) => void;
  onViewFantasyGame: (gameId: string) => void;
  onViewTournament: (gameId: string) => void;
  onPlayDuel?: (game: SportimeGame) => void;
  onPlayPredictor?: (game: SportimeGame) => void;
  onPlayFantasyF1?: (game: SportimeGame) => void;
  myGamesCount: number;
  profile: Profile | null;
  userTickets: UserTicket[];
  isLoading?: boolean;
  onRefresh?: () => void | Promise<void>;
  onShowLiveGames?: () => void;
  pendingInviteGameIds?: Set<string>;
  onReopenInvite?: (gameId: string) => void;
  pendingGameIds?: Set<string>;     // games with an action due (badge)
}

const GamesListPage: React.FC<GamesListPageProps> = (props) => {
  const { games, userChallengeEntries, userSwipeEntries, userFantasyTeams, joinedGameIds, onJoinChallenge, onViewChallenge, onJoinSwipeGame, onPlaySwipeGame, onViewFantasyGame, onViewTournament, onPlayDuel, onPlayPredictor, onPlayFantasyF1, profile, userTickets, isLoading, onRefresh, onShowLiveGames, pendingInviteGameIds, onReopenInvite, pendingGameIds } = props;

  // Quick type filter (chip row) — applies across both tabs.
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const presentTypes = useMemo(() => {
    const seen = new Set<string>(); const order: string[] = [];
    for (const g of games) { if (!seen.has(g.game_type)) { seen.add(g.game_type); order.push(g.game_type); } }
    return order;
  }, [games]);
  const matchesType = (g: SportimeGame) => typeFilter === 'all' || g.game_type === typeFilter;

  const [activeTab, setActiveTab] = useState<GamesTab>('my-games');
  const tabTouched = React.useRef(false);
  const selectTab = (t: GamesTab) => { tabTouched.current = true; hapticImpact('light'); setActiveTab(t); };

  const [filters, setFilters] = useState<GameFilters>({
    type: 'all',
    format: 'all',
    tier: 'all',
    duration: 'all',
    eligibleOnly: false,
  });
  const [viewingRewardsFor, setViewingRewardsFor] = useState<SportimeGame | null>(null);
  const [viewingInfoFor, setViewingInfoFor] = useState<SportimeGame | null>(null);

  const hasActiveFilters = filters.type !== 'all' || filters.format !== 'all' || filters.tier !== 'all' || filters.duration !== 'all' || filters.eligibleOnly;

  const myGameIds = useMemo(() => {
    if (!profile) return new Set();
    const ids = new Set<string>();
    userChallengeEntries.forEach(e => ids.add(e.challengeId));
    userSwipeEntries.forEach(e => ids.add(e.matchDayId));
    userFantasyTeams.forEach(e => ids.add(e.gameId));
    joinedGameIds?.forEach(id => ids.add(id)); // tournament (and other) joins from the catalog
    return ids;
  }, [userChallengeEntries, userSwipeEntries, userFantasyTeams, joinedGameIds, profile]);

  // Default to "My Games". Only a user who has NEVER joined any game (past or present)
  // lands on Browse instead — returning players with only finished games still open on My Games.
  React.useEffect(() => {
    if (!tabTouched.current && !isLoading && myGameIds.size === 0) setActiveTab('browse');
  }, [isLoading, myGameIds]);

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
      // Also check if end_date has passed (game is definitely finished).
      // Some games (e.g. Tournament Quest) have no end_date -> never "passed".
      const endParsed = safeParseISO(game.end_date);
      const endDatePassed = endParsed ? endParsed < now : false;

      if (realStatus === 'Finished' || realStatus === 'Cancelled' || endDatePassed || game.status === 'Finished') {
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

    const ts = (d?: string | null, fallback = 0) => { const p = safeParseISO(d); return p ? p.getTime() : fallback; };
    const sortByStartDate = (a: SportimeGame, b: SportimeGame) => ts(a.start_date) - ts(b.start_date);
    const sortByEndDateDesc = (a: SportimeGame, b: SportimeGame) => ts(b.end_date) - ts(a.end_date);

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
    // Matchless games (e.g. tournaments) carry their finished state on game.status.
    const serverFinished = game.status === 'Finished' || game.status === 'Cancelled';

    // Finished games
    if (realStatus === 'Finished' || realStatus === 'Cancelled' || serverFinished) {
      return 'RESULTS';
    }

    // Not joined - check if entry is still open
    if (!hasJoined) {
      // Entry deadline determines if registration is open, not start_date
      // A game can have start_date passed (start of the matchday weekend) but still accept entries
      // until ENTRY_LOCK_BUFFER_MS before the first match kickoff (entry deadline)
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

    // Tournament: joined -> always a "play/predict" action (or results if finished)
    if (game.game_type === 'tournament') {
      return (realStatus === 'Finished' || realStatus === 'Cancelled') ? 'RESULTS' : 'MAKE_PREDICTIONS';
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
    if (game.game_type === 'tournament') onPlayAction = wrapWithResultsViewed(() => onViewTournament(game.id));
    if (game.game_type === 'duel') onPlayAction = wrapWithResultsViewed(() => onPlayDuel?.(game));
    if (game.game_type === 'predictor') onPlayAction = wrapWithResultsViewed(() => onPlayPredictor?.(game));
    if (game.game_type === 'f1fantasy') onPlayAction = wrapWithResultsViewed(() => onPlayFantasyF1?.(game));

    // For live games not joined, show leaderboard in read-only mode
    const handleViewLeaderboard = () => {
      if (game.game_type === 'betting') onViewChallenge(game.id);
      if (game.game_type === 'prediction') onPlaySwipeGame(game.id);
      if (game.game_type === 'fantasy') onViewFantasyGame(game.id);
      if (game.game_type === 'tournament') onViewTournament(game.id);
      if (game.game_type === 'duel') onPlayDuel?.(game);
      if (game.game_type === 'predictor') onPlayPredictor?.(game);
      if (game.game_type === 'f1fantasy') onPlayFantasyF1?.(game);
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
          // Duel / predictor games have no separate join step — opening the board IS joining.
          if (game.game_type === 'duel') {
            onPlayDuel?.(game);
          } else if (game.game_type === 'predictor') {
            onPlayPredictor?.(game);
          } else if (game.game_type === 'f1fantasy') {
            onPlayFantasyF1?.(game);
          } else if (game.game_type === 'prediction') {
            // Betting + fantasy use the entry-method modal (onJoinChallenge);
            // only prediction/swipe games use onJoinSwipeGame.
            onJoinSwipeGame(game.id);
          } else {
            // betting / fantasy / tournament -> entry-method modal (coins / ticket / MasterPass)
            onJoinChallenge(game);
          }
        }}
        onPlay={() => { hapticImpact('light'); onPlayAction(); }}
        onShowRewards={() => setViewingRewardsFor(game)}
        onShowInfo={(game) => setViewingInfoFor(game)}
        onViewLeaderboard={handleViewLeaderboard}
        profile={profile}
        userTickets={userTickets}
        userEntry={userEntry}
        userSwipeEntry={userSwipeEntry}
        hasPendingInvite={pendingInviteGameIds?.has(game.id)}
        onReopenInvite={() => onReopenInvite?.(game.id)}
        pendingAction={pendingGameIds?.has(game.id)}
      />
    );
  };

  return (
    <PullToRefresh onRefresh={onRefresh ?? (() => {})}>
    <div className="space-y-4">
      {/* Tab Switcher */}
      <div className="flex items-center gap-1 bg-navy-accent rounded-xl p-1">
        <button
          onClick={() => selectTab('my-games')}
          className={`flex-1 p-3 rounded-lg font-semibold transition-all text-sm ${
            activeTab === 'my-games'
              ? 'bg-electric-blue text-white shadow'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          My Games
        </button>
        <button
          onClick={() => selectTab('browse')}
          className={`flex-1 p-3 rounded-lg font-semibold transition-all text-sm ${
            activeTab === 'browse'
              ? 'bg-electric-blue text-white shadow'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Browse
        </button>
        {onShowLiveGames && (
          <button
            onClick={() => { hapticImpact('light'); onShowLiveGames(); }}
            className="flex-shrink-0 flex items-center gap-1 px-3 py-3 rounded-lg text-warm-yellow bg-warm-yellow/10 hover:bg-warm-yellow/20 transition-all font-semibold text-sm"
          >
            <Zap size={16} /> Live
          </button>
        )}
      </div>

      {/* Type filter chips — differentiate & filter game types */}
      {presentTypes.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setTypeFilter('all')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${typeFilter === 'all' ? 'bg-electric-blue text-white border-transparent' : 'border-white/10 text-text-secondary'}`}
          >
            All
          </button>
          {presentTypes.map(t => {
            const id = gameTypeIdentity(t);
            const I = id.Icon;
            const active = typeFilter === t;
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(active ? 'all' : t)}
                className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${active ? `${id.chip} border-transparent` : 'border-white/10 text-text-secondary'}`}
              >
                <I size={13} /> {id.name}
              </button>
            );
          })}
        </div>
      )}

      {isLoading && games.length === 0 ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-electric-blue" size={32} /></div>
      ) : (
      <>
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
            count={playNowGames.filter(matchesType).length}
            icon={<Zap />}
            colorClass="text-lime-glow"
            defaultOpen={true}
          >
            {playNowGames.filter(matchesType).map(game => renderGameCard(game, true))}
          </GameSection>

          <GameSection
            title="Awaiting Results"
            count={awaitingGames.filter(matchesType).length}
            icon={<Clock />}
            colorClass="text-warm-yellow"
            defaultOpen={true}
          >
            {awaitingGames.filter(matchesType).map(game => renderGameCard(game, true))}
          </GameSection>

          <GameSection
            title="Recently Finished"
            count={recentlyFinishedGames.filter(matchesType).length}
            icon={<Trophy />}
            colorClass="text-neon-cyan"
            defaultOpen={true}
          >
            {recentlyFinishedGames.filter(matchesType).map(game => renderGameCard(game, true))}
          </GameSection>

          <GameSection
            title="Past Games"
            count={pastGamesSection.filter(matchesType).length}
            icon={<Flag />}
            colorClass="text-text-disabled"
            defaultOpen={false}
          >
            {pastGamesSection.filter(matchesType).map(game => renderGameCard(game, true))}
          </GameSection>
        </>
        )
      )}

      {/* Browse Games Tab */}
      {activeTab === 'browse' && (
        <>
          <GamesFilterPanel filters={filters} onFilterChange={setFilters} />

          {/* Available Games */}
          {availableGames.filter(matchesType).length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-lime-glow px-1">
                <Zap size={18} />
                <h2 className="font-bold">Available</h2>
                <span className="text-xs font-bold bg-lime-glow/15 px-2 py-0.5 rounded-full">{availableGames.filter(matchesType).length}</span>
              </div>
              {availableGames.filter(matchesType).map(game => renderGameCard(game, false))}
            </div>
          ) : (
            <EmptyState
              glyph={<Search size={48} className="text-text-disabled" />}
              title="No games to join"
              subtitle={hasActiveFilters ? 'No game matches your filters right now.' : 'Nothing open to join — check back soon.'}
              cta={hasActiveFilters
                ? { label: '✕ Clear filters', onClick: () => setFilters({ type: 'all', format: 'all', tier: 'all', duration: 'all', eligibleOnly: false }) }
                : undefined}
            />
          )}

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
