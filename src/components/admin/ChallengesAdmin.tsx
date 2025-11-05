import React, { useState } from 'react';
import { SportimeGame, TournamentType, GameRewardTier } from '../../types';
import { Play, Plus, Edit, Trophy } from 'lucide-react';
import { GameCreationForm } from './GameCreationForm';
import { useMockStore } from '../../store/useMockStore';

interface ChallengesAdminProps {
  games: SportimeGame[];
  onCreateGame: (config: Omit<SportimeGame, 'id' | 'status' | 'totalPlayers' | 'participants'>) => void;
  onProcessChallengeStart: (challengeId: string) => void;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  updateBasePack: (tier: TournamentType, format: string, updatedPack: GameRewardTier[]) => void;
  updateGameRewards: (gameId: string, rewards: GameRewardTier[]) => void;
  onCelebrate: (game: SportimeGame) => void;
}

export const ChallengesAdmin: React.FC<ChallengesAdminProps> = (props) => {
  const { games, onCreateGame, onProcessChallengeStart, addToast, updateBasePack, onCelebrate } = props;
  const [showForm, setShowForm] = useState(false);
  const upcomingGames = games.filter(c => c.status === 'Upcoming');
  const otherGames = games.filter(c => c.status !== 'Upcoming');

  const handleCreate = (config: Omit<SportimeGame, 'id' | 'status' | 'totalPlayers' | 'participants'>) => {
    onCreateGame(config);
    setShowForm(false);
    addToast('Game created successfully!', 'success');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-bold text-lg text-electric-blue">Manage Games</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 text-sm font-semibold bg-lime-glow/20 text-lime-glow px-4 py-3 rounded-lg hover:bg-lime-glow/30"
        >
          <Plus size={16} /> {showForm ? 'Close Form' : 'Create New Game'}
        </button>
      </div>

      {showForm && <GameCreationForm onCreate={handleCreate} onCancel={() => setShowForm(false)} addToast={addToast} />}
      
      {upcomingGames.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-md font-semibold text-text-secondary">Upcoming</h3>
          {upcomingGames.map(game => (
            <div key={game.id} className="card-base p-3 flex items-center justify-between">
              <div>
                <p className="font-bold text-text-primary">{game.name}</p>
                <p className="text-xs text-text-disabled">Min Players: {game.minimum_players || 'N/A'}, Current: {game.participants.length}</p>
              </div>
              <div className="flex items-center gap-2">
                {game.duration_type === 'seasonal' && (
                  <button
                    onClick={() => onCelebrate(game)}
                    className="p-2 text-warm-yellow hover:bg-warm-yellow/10 rounded-lg"
                    title="Celebrate Winners"
                  >
                    <Trophy size={16} />
                  </button>
                )}
                <button
                  onClick={() => addToast('Edit coming soon!', 'info')}
                  className="p-2 text-text-secondary hover:bg-white/10 rounded-lg"
                  title="Edit Game"
                >
                  <Edit size={16} />
                </button>
                <button
                  onClick={() => onProcessChallengeStart(game.id)}
                  className="flex items-center gap-2 text-sm font-semibold bg-lime-glow/20 text-lime-glow px-3 py-2 rounded-lg hover:bg-lime-glow/30"
                >
                  <Play size={16} /> Start
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {otherGames.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-md font-semibold text-text-secondary">Active/Finished</h3>
          {otherGames.map(game => (
             <div key={game.id} className={`card-base p-3 flex items-center justify-between opacity-70 ${game.status === 'Cancelled' ? 'bg-hot-red/10' : ''}`}>
              <div>
                <p className="font-bold text-text-primary">{game.name}</p>
                <p className={`text-xs font-bold ${game.status === 'Cancelled' ? 'text-hot-red' : 'text-text-disabled'}`}>Status: {game.status}</p>
              </div>
              {game.duration_type === 'seasonal' && (
                <button
                  onClick={() => onCelebrate(game)}
                  className="p-2 text-warm-yellow hover:bg-warm-yellow/10 rounded-lg"
                  title="Celebrate Winners"
                >
                  <Trophy size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {games.length === 0 && !showForm && (
        <p className="text-center text-text-disabled py-4">No games have been created yet.</p>
      )}
    </div>
  );
};
