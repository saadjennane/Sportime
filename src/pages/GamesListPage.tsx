import React, { useState } from 'react';
import { BettingChallenge, PredictionGame, FantasyGame, UserChallengeEntry, UserSwipeEntry, UserFantasyTeam } from '../types';
import { GameCard } from '../components/GameCard';
import { RulesModal } from '../components/RulesModal';
import { Gamepad2, UserCheck, ChevronDown } from 'lucide-react';
import { SwipeRulesModal } from '../components/SwipeRulesModal';

type Game = BettingChallenge | PredictionGame | FantasyGame;
export type CtaState = 'JOIN' | 'PLAY' | 'SUBMITTED' | 'AWAITING' | 'RESULTS' | 'VIEW_TEAM';

interface GamesListPageProps {
  challenges: BettingChallenge[];
  swipeMatchDays: PredictionGame[];
  fantasyGames: FantasyGame[];
  userChallengeEntries: UserChallengeEntry[];
  userSwipeEntries: UserSwipeEntry[];
  userFantasyTeams: UserFantasyTeam[];
  onJoinChallenge: (challengeId: string) => void;
  onViewChallenge: (challengeId: string) => void;
  onJoinSwipeGame: (gameId: string) => void;
  onPlaySwipeGame: (matchDayId: string) => void;
  onViewFantasyGame: (gameId: string) => void;
  myGamesCount: number;
}

const GamesListPage: React.FC<GamesListPageProps> = ({ 
  challenges, 
  swipeMatchDays, 
  fantasyGames,
  userChallengeEntries, 
  userSwipeEntries,
  userFantasyTeams,
  onJoinChallenge, 
  onViewChallenge, 
  onJoinSwipeGame,
  onPlaySwipeGame,
  onViewFantasyGame,
  myGamesCount,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'my'>('all');
  const [isBettingRulesOpen, setIsBettingRulesOpen] = useState(false);
  const [isSwipeRulesOpen, setIsSwipeRulesOpen] = useState(false);
  const [isFinishedVisible, setIsFinishedVisible] = useState(false);

  const myChallengeIds = userChallengeEntries.map(entry => entry.challengeId);
  const mySwipeGameIds = userSwipeEntries.map(entry => entry.matchDayId);
  const myFantasyGameIds = userFantasyTeams.map(entry => entry.gameId);

  const allGames: Game[] = [...challenges, ...swipeMatchDays, ...fantasyGames].sort((a, b) => {
    const statusOrder = { Upcoming: 0, Ongoing: 1, Finished: 2 };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  const baseFilteredGames = activeTab === 'all'
    ? allGames
    : allGames.filter(game => 
        (game.gameType === 'betting' && myChallengeIds.includes(game.id)) ||
        (game.gameType === 'prediction' && mySwipeGameIds.includes(game.id)) ||
        (game.gameType === 'fantasy' && myFantasyGameIds.includes(game.id))
      );

  const activeGames = baseFilteredGames.filter(g => g.status !== 'Finished');
  const finishedGames = baseFilteredGames.filter(g => g.status === 'Finished');

  const getCtaState = (game: Game): CtaState => {
    let hasJoined = false;
    let userEntry: any = undefined;

    if (game.gameType === 'betting') {
      hasJoined = myChallengeIds.includes(game.id);
      userEntry = userChallengeEntries.find(e => e.challengeId === game.id);
    } else if (game.gameType === 'prediction') {
      hasJoined = mySwipeGameIds.includes(game.id);
      userEntry = userSwipeEntries.find(e => e.matchDayId === game.id);
    } else if (game.gameType === 'fantasy') {
      hasJoined = myFantasyGameIds.includes(game.id);
      userEntry = userFantasyTeams.find(t => t.gameId === game.id);
    }

    if (!hasJoined) {
        return 'JOIN';
    }

    if (game.status === 'Finished') {
        return 'RESULTS';
    }

    if (game.gameType === 'fantasy') {
      return 'VIEW_TEAM';
    }

    if (game.status === 'Ongoing') {
        return 'AWAITING';
    }

    // Status is 'Upcoming'
    if (game.gameType === 'betting') {
        const challenge = game as BettingChallenge;
        if (!userEntry) return 'PLAY';
        const isComplete = userEntry.dailyEntries.every((daily: any) => {
            const totalBet = daily.bets.reduce((sum: number, b: any) => sum + b.amount, 0);
            return totalBet >= challenge.challengeBalance;
        });
        return isComplete ? 'SUBMITTED' : 'PLAY';

    } else { // prediction
        const swipeGame = game as PredictionGame;
        if (!userEntry) return 'PLAY';
        const isComplete = userEntry.predictions.length >= swipeGame.matches.length;
        return isComplete ? 'SUBMITTED' : 'PLAY';
    }
  };

  const renderGameCard = (game: Game) => {
    const ctaState = getCtaState(game);
    
    let onPlayAction = () => {};
    if (game.gameType === 'betting') onPlayAction = () => onViewChallenge(game.id);
    if (game.gameType === 'prediction') onPlayAction = () => onPlaySwipeGame(game.id);
    if (game.gameType === 'fantasy') onPlayAction = () => onViewFantasyGame(game.id);

    return (
      <GameCard
        key={game.id}
        game={game}
        ctaState={ctaState}
        onJoin={() => game.gameType === 'betting' ? onJoinChallenge(game.id) : onJoinSwipeGame(game.id)}
        onPlay={onPlayAction}
        onShowRules={() => game.gameType === 'betting' ? setIsBettingRulesOpen(true) : setIsSwipeRulesOpen(true)}
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

          {finishedGames.length > 0 && (
            <div className="card-base p-4 mt-4">
              <button
                onClick={() => setIsFinishedVisible(!isFinishedVisible)}
                className="w-full flex justify-between items-center text-left"
              >
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-text-secondary">Finished Challenges</h3>
                  <span className="bg-disabled text-text-disabled text-xs font-bold px-2.5 py-1 rounded-full">
                    {finishedGames.length}
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
                  {finishedGames.map(renderGameCard)}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <RulesModal isOpen={isBettingRulesOpen} onClose={() => setIsBettingRulesOpen(false)} />
      <SwipeRulesModal isOpen={isSwipeRulesOpen} onClose={() => setIsSwipeRulesOpen(false)} />
    </div>
  );
};

export default GamesListPage;
