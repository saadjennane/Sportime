import React from 'react';
import { LiveGame, LiveGamePlayerEntry, LiveBet, LiveGameMarket } from '../../../types';
import { ArrowLeft, Coins } from 'lucide-react';
import { LiveBettingMarketCard } from '../../../components/leagues/live-game/betting/LiveBettingMarketCard';
import { LiveBettingPlayerStatus } from '../../../components/leagues/live-game/betting/LiveBettingPlayerStatus';

interface LiveGameBettingSetupPageProps {
  game: LiveGame;
  playerEntry?: LiveGamePlayerEntry;
  onBack: () => void;
  onPlaceBet: (gameId: string, userId: string, marketId: string, option: string, amount: number, odds: number) => void;
}

const LiveGameBettingSetupPage: React.FC<LiveGameBettingSetupPageProps> = ({ game, playerEntry, onBack, onPlaceBet }) => {
  const preMatchMarkets = game.markets.filter(m => m.minute === 0);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-text-secondary font-semibold hover:text-electric-blue">
        <ArrowLeft size={20} /> Back to League
      </button>

      <div className="card-base p-4 flex items-center gap-4">
        <div className="text-4xl">{game.match_details.teamA.emoji}</div>
        <div className="flex-1 text-center">
          <h2 className="text-lg font-bold text-text-primary">{game.match_details.teamA.name} vs {game.match_details.teamB.name}</h2>
          <p className="text-sm text-text-secondary">{game.match_details.kickoffTime}</p>
        </div>
        <div className="text-4xl">{game.match_details.teamB.emoji}</div>
      </div>

      <LiveBettingPlayerStatus playerEntry={playerEntry} />

      <div className="space-y-3">
        <h3 className="text-lg font-bold text-text-primary text-center">Pre-Match Markets</h3>
        {preMatchMarkets.map(market => (
          <LiveBettingMarketCard
            key={market.id}
            market={market}
            onPlaceBet={(option, amount, odds) => onPlaceBet(game.id, 'user-1', market.id, option, amount, odds)}
            playerBalance={playerEntry?.betting_state?.pre_match_balance ?? 1000}
            placedBet={playerEntry?.betting_state?.bets.find(b => b.market_id === market.id)}
            phase="pre-match"
          />
        ))}
      </div>
    </div>
  );
};

export default LiveGameBettingSetupPage;
