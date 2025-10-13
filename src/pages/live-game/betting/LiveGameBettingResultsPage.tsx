import React from 'react';
import { LiveGame, LiveGamePlayerEntry } from '../../../types';
import { ArrowLeft, Trophy, CheckCircle, XCircle } from 'lucide-react';
import { useMockStore } from '../../../store/useMockStore';

interface LiveGameBettingResultsPageProps {
  game: LiveGame;
  playerEntry?: LiveGamePlayerEntry;
  onBack: () => void;
}

const LiveGameBettingResultsPage: React.FC<LiveGameBettingResultsPageProps> = ({ game, playerEntry, onBack }) => {
  const { allUsers } = useMockStore();

  const leaderboard = game.players
    .map(p => ({
      userId: p.user_id,
      username: allUsers.find(u => u.id === p.user_id)?.username || `Player ${p.user_id.slice(0, 4)}`,
      gain: p.betting_state?.total_gain || 0,
    }))
    .sort((a, b) => b.gain - a.gain)
    .map((p, index) => ({ ...p, rank: index + 1 }));

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-text-secondary font-semibold hover:text-electric-blue">
        <ArrowLeft size={20} /> Back to League
      </button>

      <div className="card-base p-4 flex items-center gap-4">
        <div className="text-4xl">{game.match_details.teamA.emoji}</div>
        <div className="flex-1 text-center">
          <p className="text-sm text-lime-glow font-bold">FINAL</p>
          <h2 className="text-3xl font-bold text-text-primary">
            {game.match_details.score?.teamA ?? 0} - {game.match_details.score?.teamB ?? 0}
          </h2>
          <p className="text-sm text-text-secondary">{game.match_details.teamA.name} vs {game.match_details.teamB.name}</p>
        </div>
        <div className="text-4xl">{game.match_details.teamB.emoji}</div>
      </div>

      <div className="card-base p-4 space-y-3">
        <h3 className="text-lg font-bold text-text-primary flex items-center gap-2"><Trophy size={18} /> Final Leaderboard</h3>
        <div className="space-y-2">
          {leaderboard.map(p => (
            <div key={p.userId} className={`flex items-center p-3 rounded-lg ${p.userId === 'user-1' ? 'bg-electric-blue/10' : 'bg-deep-navy'}`}>
              <span className="w-6 font-bold text-text-secondary text-sm">{p.rank}</span>
              <span className="flex-1 font-semibold text-text-primary">{p.userId === 'user-1' ? 'You' : p.username}</span>
              <span className={`font-bold ${p.gain >= 0 ? 'text-lime-glow' : 'text-hot-red'}`}>{p.gain >= 0 ? `+${p.gain}` : p.gain} coins</span>
            </div>
          ))}
        </div>
      </div>

      {playerEntry?.betting_state?.bets && (
        <div className="card-base p-4 space-y-3">
          <h3 className="text-lg font-bold text-text-primary">Your Bets</h3>
          {playerEntry.betting_state.bets.map(bet => {
            const market = game.markets.find(m => m.id === bet.market_id);
            return (
              <div key={bet.market_id} className="bg-deep-navy p-3 rounded-lg">
                <p className="text-xs text-text-disabled">{market?.title}</p>
                <div className="flex justify-between items-center">
                  <p className="text-sm font-semibold text-text-primary">Your pick: <span className="text-electric-blue">{bet.option}</span></p>
                  <div className={`flex items-center gap-1 text-sm font-bold ${bet.status === 'won' ? 'text-lime-glow' : 'text-hot-red'}`}>
                    {bet.status === 'won' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                    {bet.gain >= 0 ? `+${bet.gain}` : bet.gain}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LiveGameBettingResultsPage;
