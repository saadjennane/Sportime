import React from 'react';
import { LiveGame } from '../../types';
import { ArrowLeft, Trophy, CheckCircle, XCircle } from 'lucide-react';
import { calculateLiveGameScores } from '../../lib/liveGameEngine';

interface LiveGameResultsPageProps {
  game: LiveGame;
  onBack: () => void;
}

const LiveGameResultsPage: React.FC<LiveGameResultsPageProps> = ({ game, onBack }) => {
  const scoredGame = calculateLiveGameScores(game);
  const sortedPlayers = [...scoredGame.players].sort((a, b) => (b.total_points || 0) - (a.total_points || 0));

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
          {sortedPlayers.map((p, index) => (
            <div key={p.user_id} className={`flex items-center p-3 rounded-lg ${p.user_id === 'user-1' ? 'bg-electric-blue/10' : 'bg-deep-navy'}`}>
              <span className="w-6 font-bold text-text-secondary text-sm">{index + 1}</span>
              <div className="flex-1">
                <p className="font-semibold text-text-primary">{p.user_id === 'user-1' ? 'You' : `Player ${p.user_id.substring(0, 4)}`}</p>
                <p className="text-xs text-text-disabled">Prediction: {p.predicted_score.home}-{p.predicted_score.away}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-warm-yellow">{p.total_points || 0} pts</p>
                <p className="text-xs text-text-disabled">Score: {p.score_final} / Bonus: {p.bonus_total}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LiveGameResultsPage;
