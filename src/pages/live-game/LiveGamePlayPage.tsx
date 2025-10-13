import React, { useState } from 'react';
import { LiveGame, LiveGamePlayerEntry } from '../../types';
import { ArrowLeft, Edit, Trophy, User } from 'lucide-react';
import { calculateLiveGameScores } from '../../lib/liveGameEngine';

interface LiveGamePlayPageProps {
  game: LiveGame;
  playerEntry?: LiveGamePlayerEntry;
  onBack: () => void;
  onEdit: (gameId: string, userId: string, newScore: { home: number; away: number }) => void;
}

const LiveGamePlayPage: React.FC<LiveGamePlayPageProps> = ({ game, playerEntry, onBack, onEdit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [homeScore, setHomeScore] = useState<number | ''>(playerEntry?.predicted_score.home ?? '');
  const [awayScore, setAwayScore] = useState<number | ''>(playerEntry?.predicted_score.away ?? '');

  const handleEditConfirm = () => {
    if (homeScore !== '' && awayScore !== '') {
      onEdit(game.id, 'user-1', { home: Number(homeScore), away: Number(awayScore) });
      setIsEditing(false);
    }
  };

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
          <p className="text-sm text-hot-red font-bold animate-pulse">LIVE</p>
          <h2 className="text-3xl font-bold text-text-primary">
            {game.match_details.score?.teamA ?? 0} - {game.match_details.score?.teamB ?? 0}
          </h2>
          <p className="text-sm text-text-secondary">{game.match_details.teamA.name} vs {game.match_details.teamB.name}</p>
        </div>
        <div className="text-4xl">{game.match_details.teamB.emoji}</div>
      </div>

      {playerEntry && (
        <div className="card-base p-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-text-primary flex items-center gap-2"><User size={18} /> Your Prediction</h3>
            {!playerEntry.midtime_edit && game.match_details.status === 'upcoming' /* Should be halftime */ && (
              <button onClick={() => setIsEditing(true)} className="flex items-center gap-1.5 text-xs font-bold text-warm-yellow bg-warm-yellow/10 px-3 py-1.5 rounded-lg">
                <Edit size={14} /> Edit
              </button>
            )}
          </div>
          {isEditing ? (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-hot-red text-center bg-hot-red/10 p-2 rounded-lg">Warning: Halftime edits apply a -40% malus to your final score points.</p>
              <div className="flex items-center justify-center gap-4">
                <input type="number" value={homeScore} onChange={e => setHomeScore(Number(e.target.value))} className="input-base text-2xl font-bold w-20 text-center" />
                <span className="text-2xl font-bold text-text-disabled">:</span>
                <input type="number" value={awayScore} onChange={e => setAwayScore(Number(e.target.value))} className="input-base text-2xl font-bold w-20 text-center" />
              </div>
              <button onClick={handleEditConfirm} className="w-full primary-button mt-2">Confirm Edit</button>
            </div>
          ) : (
            <p className="text-center text-4xl font-bold text-electric-blue mt-2">
              {playerEntry.predicted_score.home} - {playerEntry.predicted_score.away}
            </p>
          )}
        </div>
      )}

      <div className="card-base p-4 space-y-3">
        <h3 className="text-lg font-bold text-text-primary flex items-center gap-2"><Trophy size={18} /> Live Leaderboard</h3>
        <div className="space-y-2">
          {sortedPlayers.map((p, index) => (
            <div key={p.user_id} className={`flex items-center p-2 rounded-lg ${p.user_id === 'user-1' ? 'bg-electric-blue/10' : 'bg-deep-navy'}`}>
              <span className="w-6 font-bold text-text-secondary text-sm">{index + 1}</span>
              <span className="flex-1 font-semibold text-text-primary">{p.user_id === 'user-1' ? 'You' : `Player ${p.user_id.substring(0, 4)}`}</span>
              <span className="font-bold text-warm-yellow">{p.total_points || 0} pts</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LiveGamePlayPage;
