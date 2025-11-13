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

export type CtaState = 'JOIN' | 'PLACE_BETS' | 'MAKE_PREDICTIONS' | 'SELECT_TEAM' | 'COMPLETE_TEAM' | 'AWAITING' | 'RESULTS' | 'IN_PROGRESS';
type GamesTab = 'my-games' | 'browse';

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
    const now = new Date('2025-07-24T00:00:00Z'); // Fixed date for stable mock environment

    const active: (SportimeGame & { isEligible: boolean })[] = [];
    const awaiting: (SportimeGame & { isEligible: boolean })[] = [];
    const finished: (SportimeGame & { isEligible: boolean })[] = [];

    for (const game of processedGames) {
      const hasJoined = myGameIds.has(game.id);
      if (!hasJoined) continue; // My Games = only joined games

      if (game.status === 'Finished' || game.status === 'Cancelled') {
        finished.push(game);
      } else if (game.status === 'Ongoing' || game.status === 'Upcoming') {
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

  // All games for Browse tab (sorted by start date)
  const browseGames = useMemo(() => {
    const sortByStartDate = (a: SportimeGame, b: SportimeGame) => parseISO(a.start_date).getTime() - parseISO(b.start_date).getTime();
    return [...processedGames].sort(sortByStartDate);
  }, [processedGames]);

  const getCtaState = (game: SportimeGame & { isEligible: boolean }, isInMyGamesTab: boolean): CtaState => {
    const hasJoined = myGameIds.has(game.id);

    // Finished games
    if (game.status === 'Finished' || game.status === 'Cancelled') {
      return 'RESULTS';
    }

    // Browse tab: Ongoing games not joined
    if (!isInMyGamesTab && game.status === 'Ongoing' && !hasJoined) {
      return 'IN_PROGRESS';
    }

    // Not joined - show JOIN button
    if (!hasJoined) {
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

    return (
      <GameCard
        key={game.id}
        game={game}
        ctaState={ctaState}
        onJoinClick={() => game.game_type === 'betting' ? onJoinChallenge(game) : onJoinSwipeGame(game.id)}
        onPlay={onPlayAction}
        onShowRewards={() => setViewingRewardsFor(game)}
        onShowRules={() => setIsRulesModalOpen(true)}
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
