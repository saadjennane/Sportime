import React, { useState, useMemo } from 'react';
import { SportimeGame, UserChallengeEntry, UserSwipeEntry, UserFantasyTeam, Profile, UserTicket, GameFilters } from '../types';
import { GameCard } from '../components/GameCard';
import { RewardsPreviewModal } from '../components/RewardsPreviewModal';
import { RulesModal } from '../components/RulesModal';
import { GamesFilterPanel } from '../components/filters/GamesFilterPanel';
import { checkEligibility } from '../lib/eligibility';
import { GameSection } from '../components/GameSection';
import { add, isWithinInterval, parseISO } from 'date-fns';
import { Zap, Clock, Flag } from 'lucide-react';

export type CtaState = 'JOIN' | 'PLACE_BETS' | 'MAKE_PREDICTIONS' | 'SELECT_TEAM' | 'COMPLETE_TEAM' | 'AWAITING' | 'RESULTS' | 'IN_PROGRESS' | 'LOCKED';
type GamesTab = 'my-games' | 'browse';

/**
 * Calculates entry deadline: 30 minutes before the first match
 * Priority: first_kickoff_time > matches[].kickoffTime > start_date
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

  // Fallback to start_date (may be midnight, so less accurate)
  const firstMatchDate = parseISO(game.start_date);
  return new Date(firstMatchDate.getTime() - 30 * 60 * 1000);
}

/**
 * Checks if entry is still open (before deadline)
 */
function isEntryOpen(game: SportimeGame): boolean {
  const deadline = calculateEntryDeadline(game);
  return new Date() < deadline;
}

/**
 * Determines the real status of a game by validating start_date and end_date
 * against the current time, regardless of what the status field says.
 * Priority: end_date > start_date > stored status
 */
function getRealGameStatus(game: SportimeGame, now: Date): 'Upcoming' | 'Ongoing' | 'Finished' | 'Cancelled' {
  // Cancelled games stay cancelled
  if (game.status === 'Cancelled') {
    return 'Cancelled';
  }

  const startDate = parseISO(game.start_date);
  const endDate = parseISO(game.end_date);

  // Priority 1: End date passed → Always Finished
  if (endDate < now) {
    return 'Finished';
  }

  // Priority 2: Start date passed but not end → Ongoing
  if (startDate < now && endDate >= now) {
    return 'Ongoing';
  }

  // Priority 3: Start date not passed → Upcoming
  if (startDate >= now) {
    return 'Upcoming';
  }

  // Fallback to stored status
  return game.status as 'Upcoming' | 'Ongoing' | 'Finished' | 'Cancelled';
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
}

const GamesListPage: React.FC<GamesListPageProps> = (props) => {
  const { games, userChallengeEntries, userSwipeEntries, userFantasyTeams, onJoinChallenge, onViewChallenge, onJoinSwipeGame, onPlaySwipeGame, onViewFantasyGame, profile, userTickets } = props;

  const [activeTab, setActiveTab] = useState<GamesTab>('my-games');
  const [filters, setFilters] = useState<GameFilters>({
    type: 'all',
    format: 'all',
    tier: 'all',
    duration: 'all',
    eligibleOnly: false,
  });
  const [viewingRewardsFor, setViewingRewardsFor] = useState<SportimeGame | null>(null);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

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

  // Categorization for My Games tab
  const { activeGames, awaitingGames, finishedGames } = useMemo(() => {
    const now = new Date(); // Fixed date for stable mock environment

    const active: (SportimeGame & { isEligible: boolean })[] = [];
    const awaiting: (SportimeGame & { isEligible: boolean })[] = [];
    const finished: (SportimeGame & { isEligible: boolean })[] = [];

    for (const game of processedGames) {
      const hasJoined = myGameIds.has(game.id);
      if (!hasJoined) continue; // My Games = only joined games

      const realStatus = getRealGameStatus(game, now);

      if (realStatus === 'Finished' || realStatus === 'Cancelled') {
        finished.push(game);
      } else if (realStatus === 'Ongoing' || realStatus === 'Upcoming') {
        // Determine if user has completed their submissions
        let isComplete = false;

        if (game.game_type === 'betting') {
          const userEntry = userChallengeEntries.find(e => e.challengeId === game.id);
          if (userEntry) {
            isComplete = userEntry.dailyEntries.every((daily: any) => {
              const totalBet = daily.bets.reduce((sum: number, b: any) => sum + b.amount, 0);
              return totalBet >= (game.challengeBalance || 1000);
            });
          }
        } else if (game.game_type === 'prediction') {
          const userEntry = userSwipeEntries.find(e => e.matchDayId === game.id);
          if (userEntry) {
            isComplete = userEntry.predictions.length >= (game.matches?.length || 0);
          }
        } else if (game.game_type === 'fantasy') {
          const userTeam = userFantasyTeams.find(t => t.gameId === game.id);
          // For fantasy, if team exists, assume it can always be edited (Complete Team CTA)
          isComplete = false;
        }

        // If incomplete, goes to Active
        // If complete, goes to Awaiting
        if (!isComplete) {
          active.push(game);
        } else {
          awaiting.push(game);
        }
      }
    }

    // Sorting
    const sortByStartDate = (a: SportimeGame, b: SportimeGame) => parseISO(a.start_date).getTime() - parseISO(b.start_date).getTime();
    const sortByEndDateDesc = (a: SportimeGame, b: SportimeGame) => parseISO(b.end_date).getTime() - parseISO(a.end_date).getTime();

    // Active: Sort by urgency (earliest start date first)
    active.sort(sortByStartDate);
    // Awaiting: Sort by start date (most recent first)
    awaiting.sort(sortByStartDate);
    // Finished: Sort by end date (most recent first)
    finished.sort(sortByEndDateDesc);

    return { activeGames: active, awaitingGames: awaiting, finishedGames: finished };
  }, [processedGames, myGameIds, userChallengeEntries, userSwipeEntries, userFantasyTeams]);

  // Separate upcoming/ongoing games from past games for Browse tab
  const { browseGames, pastGames } = useMemo(() => {
    const now = new Date();

    const upcoming: (SportimeGame & { isEligible: boolean })[] = [];
    const past: (SportimeGame & { isEligible: boolean })[] = [];

    for (const game of processedGames) {
      const realStatus = getRealGameStatus(game, now);

      if (realStatus === 'Finished' || realStatus === 'Cancelled') {
        past.push(game);
      } else {
        // Upcoming or Ongoing games
        upcoming.push(game);
      }
    }

    const sortByStartDate = (a: SportimeGame, b: SportimeGame) => parseISO(a.start_date).getTime() - parseISO(b.start_date).getTime();
    const sortByEndDateDesc = (a: SportimeGame, b: SportimeGame) => parseISO(b.end_date).getTime() - parseISO(a.end_date).getTime();

    return {
      browseGames: upcoming.sort(sortByStartDate),
      pastGames: past.sort(sortByEndDateDesc)
    };
  }, [processedGames]);

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
      // Deadline passed or game ongoing → LOCKED (FOMO)
      if (!entryOpen || realStatus === 'Ongoing') {
        return 'LOCKED';
      }
      // Entry still open
      return 'JOIN';
    }

    // USER HAS JOINED - determine action state

    // Fantasy games - always show team management
    if (game.game_type === 'fantasy') {
      const userTeam = userFantasyTeams.find(t => t.gameId === game.id);
      return userTeam ? 'COMPLETE_TEAM' : 'SELECT_TEAM';
    }

    // Betting games
    if (game.game_type === 'betting') {
      const userEntry = userChallengeEntries.find(e => e.challengeId === game.id);
      if (!userEntry) return 'PLACE_BETS';

      const isComplete = userEntry.dailyEntries.every((daily: any) => {
        const totalBet = daily.bets.reduce((sum: number, b: any) => sum + b.amount, 0);
        return totalBet >= (game.challengeBalance || 1000);
      });

      return isComplete ? 'AWAITING' : 'PLACE_BETS';
    }

    // Prediction games
    if (game.game_type === 'prediction') {
      const userEntry = userSwipeEntries.find(e => e.matchDayId === game.id);
      if (!userEntry) return 'MAKE_PREDICTIONS';

      const isComplete = userEntry.predictions.length >= (game.matches?.length || 0);
      return isComplete ? 'AWAITING' : 'MAKE_PREDICTIONS';
    }

    return 'JOIN';
  };

  const renderGameCard = (game: SportimeGame & { isEligible: boolean }, isInMyGamesTab: boolean) => {
    const ctaState = getCtaState(game, isInMyGamesTab);

    let onPlayAction = () => {};
    if (game.game_type === 'betting') onPlayAction = () => onViewChallenge(game.id);
    if (game.game_type === 'prediction') onPlayAction = () => onPlaySwipeGame(game.id);
    if (game.game_type === 'fantasy') onPlayAction = () => onViewFantasyGame(game.id);

    // For live games not joined, show leaderboard in read-only mode
    const handleViewLeaderboard = () => {
      if (game.game_type === 'betting') onViewChallenge(game.id);
      if (game.game_type === 'prediction') onPlaySwipeGame(game.id);
      if (game.game_type === 'fantasy') onViewFantasyGame(game.id);
    };

    return (
      <GameCard
        key={game.id}
        game={game}
        ctaState={ctaState}
        onJoinClick={() => game.game_type === 'betting' ? onJoinChallenge(game) : onJoinSwipeGame(game.id)}
        onPlay={onPlayAction}
        onShowRewards={() => setViewingRewardsFor(game)}
        onShowRules={() => setIsRulesModalOpen(true)}
        onViewLeaderboard={handleViewLeaderboard}
        profile={profile}
        userTickets={userTickets}
      />
    );
  };

  return (
    <div className="space-y-4">
      {/* Tab Switcher */}
      <div className="flex bg-navy-accent rounded-xl p-1">
        <button
          onClick={() => setActiveTab('my-games')}
          className={`flex-1 p-3 rounded-lg font-semibold transition-all text-sm ${
            activeTab === 'my-games'
              ? 'bg-electric-blue text-white shadow'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          My Games
        </button>
        <button
          onClick={() => setActiveTab('browse')}
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
        <>
          <GameSection
            title="Active"
            count={activeGames.length}
            icon={<Zap />}
            colorClass="text-lime-glow"
            defaultOpen={true}
          >
            {activeGames.map(game => renderGameCard(game, true))}
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
            title="Finished"
            count={finishedGames.length}
            icon={<Flag />}
            colorClass="text-text-disabled"
            defaultOpen={false}
          >
            {finishedGames.map(game => renderGameCard(game, true))}
          </GameSection>

          {activeGames.length === 0 && awaitingGames.length === 0 && finishedGames.length === 0 && (
            <div className="card-base p-8 text-center">
              <p className="text-text-secondary text-sm">You haven't joined any games yet.</p>
              <p className="text-text-secondary text-xs mt-2">Switch to Browse Games to discover available games!</p>
            </div>
          )}
        </>
      )}

      {/* Browse Games Tab */}
      {activeTab === 'browse' && (
        <>
          <GamesFilterPanel filters={filters} onFilterChange={setFilters} />

          <div className="space-y-4">
            {browseGames.length > 0 ? (
              browseGames.map(game => renderGameCard(game, false))
            ) : (
              <div className="card-base p-8 text-center">
                <p className="text-text-secondary text-sm">No games match your filters.</p>
                <p className="text-text-secondary text-xs mt-2">Try adjusting your filter settings.</p>
              </div>
            )}
          </div>

          {/* Past Games Section (Lazy Loaded) */}
          <GameSection
            title="Past Games"
            count={pastGames.length}
            icon={<Flag />}
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

      <RulesModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
      />
    </div>
  );
};

export default GamesListPage;
