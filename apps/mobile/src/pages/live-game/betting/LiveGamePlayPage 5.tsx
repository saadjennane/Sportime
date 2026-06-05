import React, { useEffect, useMemo } from 'react';
import { LiveGame, LiveGamePlayerEntry, LiveBet, LiveGameMarket } from '../../../types';
import { ArrowLeft, Trophy } from 'lucide-react';
import { LiveBettingMarketCard } from '../../../components/leagues/live-game/betting/LiveBettingMarketCard';
import { LiveBettingPlayerStatus } from '../../../components/leagues/live-game/betting/LiveBettingPlayerStatus';
import { useMockStore } from '../../../store/useMockStore';

interface LiveGameBettingPlayPageProps {
  game: LiveGame;
  playerEntry?: LiveGamePlayerEntry;
  onBack: () => void;
  onPlaceBet: (gameId: string, userId: string, marketId: string, option: string, amount: number, odds: number) => void;
  onTick: (gameId: string) => void;
}

const LiveGameBettingPlayPage: React.FC<LiveGameBettingPlayPageProps> = ({ game, playerEntry, onBack, onPlaceBet, onTick }) => {
  const { allUsers } = useMockStore();

  useEffect(() => {
    const interval = setInterval(() => {
      onTick(game.id);
    }, 5000); // Tick every 5 seconds to simulate live updates

    return () => clearInterval(interval);
  }, [game.id, onTick]);

  const currentMarket = game.markets.find(m => m.status === 'open' && m.minute > 0);

  const leaderboard = useMemo(() => {
    return game.players
      .map(p => {
        const user = allUsers.find(u => u.id === p.user_id);
        return {
          userId: p.user_id,
          username: user?.username || `Player ${p.user_id.slice(0, 4)}`,
          gain: p.betting_state?.total_gain || 0,
          last_gain_time: p.betting_state?.last_gain_time,
        };
      })
      .sort((a, b) => {
        if (b.gain !== a.gain) return b.gain - a.gain;
        if (a.last_gain_time && b.last_gain_time) {
          return new Date(a.last_gain_time).getTime() - new Date(b.last_gain_time).getTime();
        }
        if (a.last_gain_time) return -1;
        if (b.last_gain_time) return 1;
        return a.username.localeCompare(b.username);
      })
      .map((p, index) => ({ ...p, rank: index + 1 }));
  }, [game.players, allUsers]);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-text-secondary font-semibold hover:text-electric-blue">
        <ArrowLeft size={20} /> Back to League
      </button>

      <div className="card-base p-4 flex items-center gap-4">
        <div className="text-4xl">{game.match_details.teamA.emoji}</div>
        <div className="flex-1 text-center">
          <p className="text-sm text-hot-red font-bold animate-pulse">LIVE - {game.simulated_minute}'</p>
          <h2 className="text-3xl font-bold text-text-primary">
            {game.match_details.score?.teamA ?? 0} - {game.match_details.score?.teamB ?? 0}
          </h2>
          <p className="text-sm text-text-secondary">{game.match_details.teamA.name} vs {game.match_details.teamB.name}</p>
        </div>
        <div className="text-4xl">{game.match_details.teamB.emoji}</div>
      </div>

      <LiveBettingPlayerStatus playerEntry={playerEntry} />

      <div className="space-y-3">
        <h3 className="text-lg font-bold text-text-primary text-center">Live Market</h3>
        {currentMarket ? (
          <LiveBettingMarketCard
            market={currentMarket}
            onPlaceBet={(option, amount, odds) => onPlaceBet(game.id, 'user-1', currentMarket.id, option, amount, odds)}
            playerBalance={playerEntry?.betting_state?.live_balance ?? 1000}
            placedBet={playerEntry?.betting_state?.bets.find(b => b.market_id === currentMarket.id)}
            phase="live"
          />
        ) : (
          <div className="card-base p-8 text-center">
            <p className="text-text-secondary">Waiting for the next market...</p>
          </div>
        )}
      </div>

      <div className="card-base p-4 space-y-3">
        <h3 className="text-lg font-bold text-text-primary flex items-center gap-2"><Trophy size={18} /> Live Leaderboard</h3>
        <div className="space-y-2">
          {leaderboard.map(p => (
            <div key={p.userId} className={`flex items-center p-2 rounded-lg ${p.userId === 'user-1' ? 'bg-electric-blue/10' : 'bg-deep-navy'}`}>
              <span className="w-6 font-bold text-text-secondary text-sm">{p.rank}</span>
              <span className="flex-1 font-semibold text-text-primary">{p.userId === 'user-1' ? 'You' : p.username}</span>
              <span className={`font-bold ${p.gain >= 0 ? 'text-lime-glow' : 'text-hot-red'}`}>{p.gain >= 0 ? `+${p.gain}` : p.gain} coins</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LiveGameBettingPlayPage;
