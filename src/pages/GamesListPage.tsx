import React, { useState, useMemo } from 'react';
import { SportimeGame, UserChallengeEntry, UserSwipeEntry, UserFantasyTeam, Profile, UserTicket, GameFilters } from '../types';
import { GameCard } from '../components/GameCard';
import { RewardsPreviewModal } from '../components/RewardsPreviewModal';
import { RulesModal } from '../components/RulesModal';
import { GamesFilterPanel } from '../components/filters/GamesFilterPanel';
import { checkEligibility } from '../lib/eligibility';
import { GameSection } from '../components/GameSection';
import { add, isWithinInterval, parseISO } from 'date-fns';
import { Zap, Hourglass, Flame, Flag } from 'lucide-react';

export type CtaState = 'JOIN' | 'PLAY' | 'SUBMITTED' | 'AWAITING' | 'RESULTS' | 'VIEW_TEAM' | 'NOTIFY' | 'IN_PROGRESS';

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

  const { playableToday, comingSoon, inProgress, finished } = useMemo(() => {
    const now = new Date('2025-07-24T00:00:00Z'); // Fixed date for stable mock environment
    const twentyFourHoursFromNow = add(now, { hours: 24 });

    const sections: {
      playableToday: (SportimeGame & { isEligible: boolean })[];
      comingSoon: (SportimeGame & { isEligible: boolean })[];
      inProgress: (SportimeGame & { isEligible: boolean })[];
      finished: (SportimeGame & { isEligible: boolean })[];
    } = {
      playableToday: [],
      comingSoon: [],
      inProgress: [],
      finished: [],
    };

    for (const game of processedGames) {
      const gameStartDate = parseISO(game.start_date);
      const hasJoined = myGameIds.has(game.id);

      if (game.status === 'Finished' || game.status === 'Cancelled') {
        sections.finished.push(game);
      } else if (game.status === 'Ongoing') {
        if (hasJoined) {
          sections.playableToday.push(game);
        } else {
          sections.inProgress.push(game);
        }
      } else if (game.status === 'Upcoming') {
        if (gameStartDate <= twentyFourHoursFromNow) {
          if (game.isEligible) {
            sections.playableToday.push(game);
          } else {
            // Not eligible, but starts soon. It's "coming soon" for this user.
            sections.comingSoon.push(game);
          }
        } else {
          // Starts more than 24 hours from now.
          sections.comingSoon.push(game);
        }
      }
    }

    const sortByStartDate = (a: SportimeGame, b: SportimeGame) => parseISO(a.start_date).getTime() - parseISO(b.start_date).getTime();
    const sortByEndDateDesc = (a: SportimeGame, b: SportimeGame) => parseISO(b.end_date).getTime() - parseISO(a.end_date).getTime();

    sections.playableToday.sort(sortByStartDate);
    sections.comingSoon.sort(sortByStartDate);
    sections.inProgress.sort(sortByStartDate);
    sections.finished.sort(sortByEndDateDesc);

    return sections;
  }, [processedGames, myGameIds]);

  const getCtaState = (game: SportimeGame & { isEligible: boolean }): CtaState => {
    const hasJoined = myGameIds.has(game.id);
    const now = new Date('2025-07-24T00:00:00Z');
    const isPlayableSoon = isWithinInterval(new Date(game.start_date), { start: now, end: add(now, { days: 1 }) });
    
    if (game.status === 'Finished' || game.status === 'Cancelled') return 'RESULTS';
    if (game.status === 'Ongoing' && !hasJoined) return 'IN_PROGRESS';
    if (game.status === 'Upcoming' && !isPlayableSoon && !hasJoined) return 'NOTIFY';
    if (!hasJoined) return 'JOIN';

    if (game.game_type === 'fantasy') return 'VIEW_TEAM';
    if (game.status === 'Ongoing') return 'AWAITING';

    if (game.game_type === 'betting') {
        const userEntry = userChallengeEntries.find(e => e.challengeId === game.id);
        if (!userEntry) return 'PLAY';
        const isComplete = userEntry.dailyEntries.every((daily: any) => {
            const totalBet = daily.bets.reduce((sum: number, b: any) => sum + b.amount, 0);
            return totalBet >= (game.challengeBalance || 1000);
        });
        return isComplete ? 'SUBMITTED' : 'PLAY';
    } else { // prediction
        const userEntry = userSwipeEntries.find(e => e.matchDayId === game.id);
        if (!userEntry) return 'PLAY';
        const isComplete = userEntry.predictions.length >= (game.matches?.length || 0);
        return isComplete ? 'SUBMITTED' : 'PLAY';
    }
  };

  const renderGameCard = (game: SportimeGame & { isEligible: boolean }) => {
    const ctaState = getCtaState(game);
    
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
      <GamesFilterPanel filters={filters} onFilterChange={setFilters} />
      
      <GameSection title="Playable Today" count={playableToday.length} icon={<Zap />} colorClass="text-lime-glow">
        {playableToday.map(renderGameCard)}
      </GameSection>

      <GameSection title="Coming Soon" count={comingSoon.length} icon={<Hourglass />} colorClass="text-warm-yellow" defaultOpen={false}>
        {comingSoon.map(renderGameCard)}
      </GameSection>

      <GameSection title="In Progress" count={inProgress.length} icon={<Flame />} colorClass="text-orange-500" defaultOpen={false}>
        {inProgress.map(renderGameCard)}
      </GameSection>

      <GameSection title="Finished" count={finished.length} icon={<Flag />} colorClass="text-text-disabled" defaultOpen={false}>
        {finished.map(renderGameCard)}
      </GameSection>

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
