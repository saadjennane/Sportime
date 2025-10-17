import React, { useState, useMemo } from 'react';
import { SportimeGame, UserChallengeEntry, UserSwipeEntry, UserFantasyTeam, Profile, UserTicket } from '../types';
import { GameCard } from '../components/GameCard';
import { Gamepad2, UserCheck, ChevronDown } from 'lucide-react';
import { RewardsPreviewModal } from '../components/RewardsPreviewModal';

export type CtaState = 'JOIN' | 'PLAY' | 'SUBMITTED' | 'AWAITING' | 'RESULTS' | 'VIEW_TEAM';

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

const GamesListPage: React.FC<GamesListPageProps> = ({ 
  games,
  userChallengeEntries, 
  userSwipeEntries,
  userFantasyTeams,
  onJoinChallenge, 
  onViewChallenge, 
  onJoinSwipeGame,
  onPlaySwipeGame,
  onViewFantasyGame,
  myGamesCount,
  profile,
  userTickets,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'my'>('all');
  const [isFinishedVisible, setIsFinishedVisible] = useState(false);
  const [viewingRewardsFor, setViewingRewardsFor] = useState<SportimeGame | null>(null);

  const myGameIds = useMemo(() => {
    if (!profile) return new Set();
    const ids = new Set<string>();
    userChallengeEntries.forEach(e => ids.add(e.challengeId));
    userSwipeEntries.forEach(e => ids.add(e.matchDayId));
    userFantasyTeams.forEach(e => ids.add(e.gameId));
    return ids;
  }, [userChallengeEntries, userSwipeEntries, userFantasyTeams, profile]);


  const sortedGames = useMemo(() => [...games].sort((a, b) => {
    const statusOrder = { Upcoming: 0, Pending: 0, Ongoing: 1, Finished: 2, Cancelled: 3 };
    return statusOrder[a.status] - statusOrder[b.status];
  }), [games]);

  const baseFilteredGames = activeTab === 'all'
    ? sortedGames
    : sortedGames.filter(game => myGameIds.has(game.id));

  const activeGames = baseFilteredGames.filter(g => g.status !== 'Finished' && g.status !== 'Cancelled');
  const pastGames = baseFilteredGames.filter(g => g.status === 'Finished' || g.status === 'Cancelled');

  const getCtaState = (game: SportimeGame): CtaState => {
    const hasJoined = myGameIds.has(game.id);
    
    if (!hasJoined) {
        return 'JOIN';
    }

    if (game.status === 'Finished' || game.status === 'Cancelled') {
        return 'RESULTS';
    }
    
    if (game.game_type === 'fantasy') {
      return 'VIEW_TEAM';
    }

    if (game.status === 'Ongoing') {
        return 'AWAITING';
    }

    // Status is 'Upcoming'
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

  const renderGameCard = (game: SportimeGame) => {
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
        profile={profile}
        userTickets={userTickets}
      />
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex bg-navy-accent rounded-xl p-1">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg font-semibold transition-all ${
            activeTab === 'all' ? 'bg-electric-blue text-white shadow' : 'text-text-secondary'
          }`}
        >
          <Gamepad2 size={16} /> All Games
        </button>
        <button
          onClick={() => setActiveTab('my')}
          className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg font-semibold transition-all ${
            activeTab === 'my' ? 'bg-electric-blue text-white shadow' : 'text-text-secondary'
          }`}
        >
          <UserCheck size={16} />
          <span>My Games</span>
          {myGamesCount > 0 && (
            <span className={`ml-1.5 text-xs font-bold px-2 py-0.5 rounded-full transition-colors ${
                activeTab === 'my' ? 'bg-neon-cyan/20 text-neon-cyan' : 'bg-disabled text-text-disabled'
            }`}>
              {myGamesCount}
            </span>
          )}
        </button>
      </div>

      {baseFilteredGames.length === 0 ? (
        <div className="card-base p-8 text-center animate-scale-in">
          <div className="text-6xl mb-4">🤷</div>
          <p className="text-text-secondary font-medium">
            {activeTab === 'my' ? "You haven't played any games yet." : "No games available."}
          </p>
          {activeTab === 'my' && (
            <p className="text-sm text-text-disabled mt-2">Go to "All Games" to join one!</p>
          )}
        </div>
      ) : (
        <>
          {activeGames.length > 0 && (
            <div className="space-y-4 animate-scale-in">
              {activeGames.map(renderGameCard)}
            </div>
          )}

          {pastGames.length > 0 && (
            <div className="card-base p-4 mt-4">
              <button
                onClick={() => setIsFinishedVisible(!isFinishedVisible)}
                className="w-full flex justify-between items-center text-left"
              >
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-text-secondary">Past Challenges</h3>
                  <span className="bg-disabled text-text-disabled text-xs font-bold px-2.5 py-1 rounded-full">
                    {pastGames.length}
                  </span>
                </div>
                <ChevronDown
                  className={`w-6 h-6 text-text-disabled transition-transform duration-300 ${
                    isFinishedVisible ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {isFinishedVisible && (
                <div className="mt-4 space-y-4 border-t border-white/10 pt-4 animate-scale-in">
                  {pastGames.map(renderGameCard)}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {viewingRewardsFor && (
        <RewardsPreviewModal
          isOpen={!!viewingRewardsFor}
          onClose={() => setViewingRewardsFor(null)}
          game={viewingRewardsFor}
        />
      )}
    </div>
  );
};

export default GamesListPage;
