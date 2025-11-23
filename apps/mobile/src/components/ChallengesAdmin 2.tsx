import React, { useState } from 'react';
import { SportimeGame } from '../types';
import { Play, Plus, Edit, Trash2 } from 'lucide-react';
import { GameCreationForm } from './admin/GameCreationForm';

interface ChallengesAdminProps {
  games: SportimeGame[];
  onCreateGame: (config: Omit<SportimeGame, 'id' | 'status' | 'totalPlayers' | 'participants'>) => void;
  onProcessChallengeStart: (challengeId: string) => void;
}

export const ChallengesAdmin: React.FC<ChallengesAdminProps> = ({ games, onCreateGame, onProcessChallengeStart }) => {
  const [showForm, setShowForm] = useState(false);
  const upcomingGames = games.filter(c => c.status === 'Upcoming');
  const otherGames = games.filter(c => c.status !== 'Upcoming');

  const handleCreate = (config: Omit<SportimeGame, 'id' | 'status' | 'totalPlayers' | 'participants'>) => {
    onCreateGame(config);
    setShowForm(false);
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

      {showForm && <GameCreationForm onCreate={handleCreate} onCancel={() => setShowForm(false)} />}
      
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
                <button
                  onClick={() => alert('Edit coming soon!')}
                  className="p-2 text-text-secondary hover:bg-white/10 rounded-lg"
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
             <div key={game.id} className={`card-base p-3 opacity-70 ${game.status === 'Cancelled' ? 'bg-hot-red/10' : ''}`}>
              <p className="font-bold text-text-primary">{game.name}</p>
              <p className={`text-xs font-bold ${game.status === 'Cancelled' ? 'text-hot-red' : 'text-text-disabled'}`}>Status: {game.status}</p>
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
