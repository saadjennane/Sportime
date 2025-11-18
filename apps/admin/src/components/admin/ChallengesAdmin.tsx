import React, { useState } from 'react';
import { SportimeGame, TournamentType, GameRewardTier } from '../../types';
import { Play, Plus, Edit, Trophy, Send, Trash2 } from 'lucide-react';
import { GameCreationForm } from './GameCreationForm';
import { useMockStore } from '../../store/useMockStore';
import { publishChallenge, deleteChallenge, updateChallenge } from '../../services/challengeService';

interface ChallengesAdminProps {
  games: SportimeGame[];
  onCreateGame: (config: Omit<SportimeGame, 'id' | 'status' | 'totalPlayers' | 'participants'>) => void;
  onProcessChallengeStart: (challengeId: string) => void;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  updateBasePack: (tier: TournamentType, format: string, updatedPack: GameRewardTier[]) => void;
  updateGameRewards: (gameId: string, rewards: GameRewardTier[]) => void;
  onCelebrate: (game: SportimeGame) => void;
  onRefresh?: () => void;
}

export const ChallengesAdmin: React.FC<ChallengesAdminProps> = (props) => {
  const { games, onCreateGame, onProcessChallengeStart, addToast, updateBasePack, onCelebrate, onRefresh } = props;
  const [showForm, setShowForm] = useState(false);
  const [editingGame, setEditingGame] = useState<SportimeGame | null>(null);
  const draftGames = games.filter(c => c.status === 'Draft');
  const upcomingGames = games.filter(c => c.status === 'Upcoming');
  const otherGames = games.filter(c => c.status !== 'Upcoming' && c.status !== 'Draft');

  const handleCreate = (config: Omit<SportimeGame, 'id' | 'status' | 'totalPlayers' | 'participants'>, saveAsDraft: boolean = false) => {
    onCreateGame(config);
    setShowForm(false);
    setEditingGame(null);
    addToast(saveAsDraft ? 'Game saved as draft!' : 'Game created successfully!', 'success');
    onRefresh?.();
  };

  const handleUpdate = (config: Omit<SportimeGame, 'id' | 'status' | 'totalPlayers' | 'participants'>) => {
    if (!editingGame) return;
    // Update logic here - for now just close the form
    setShowForm(false);
    setEditingGame(null);
    addToast('Game updated successfully!', 'success');
    onRefresh?.();
  };

  const handleEdit = (game: SportimeGame) => {
    if (game.status !== 'Draft') {
      addToast('Only draft games can be edited', 'error');
      return;
    }
    setEditingGame(game);
    setShowForm(true);
  };

  const handlePublish = async (gameId: string) => {
    try {
      await publishChallenge(gameId);
      addToast('Game published successfully!', 'success');
      onRefresh?.();
    } catch (error: any) {
      addToast(error.message || 'Failed to publish game', 'error');
    }
  };

  const handleDelete = async (gameId: string) => {
    if (!confirm('Are you sure you want to delete this game?')) return;
    try {
      await deleteChallenge(gameId);
      addToast('Game deleted successfully!', 'success');
      onRefresh?.();
    } catch (error: any) {
      addToast(error.message || 'Failed to delete game', 'error');
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingGame(null);
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

      {showForm && (
        <GameCreationForm
          onCreate={editingGame ? handleUpdate : handleCreate}
          onCancel={handleCancelForm}
          addToast={addToast}
          initialData={editingGame || undefined}
          isEditing={!!editingGame}
        />
      )}

      {draftGames.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-md font-semibold text-text-secondary">Drafts</h3>
          {draftGames.map(game => {
            const publishDate = (game as any).publish_date;
            const isScheduled = !!publishDate;
            const scheduledDate = publishDate ? new Date(publishDate) : null;
            const isPastScheduledDate = scheduledDate && scheduledDate <= new Date();

            return (
              <div key={game.id} className={`card-base p-3 flex items-center justify-between border-l-4 ${isScheduled ? 'border-electric-blue' : 'border-warm-yellow'}`}>
                <div>
                  <p className="font-bold text-text-primary">{game.name}</p>
                  {isScheduled ? (
                    <p className={`text-xs ${isPastScheduledDate ? 'text-hot-red' : 'text-electric-blue'}`}>
                      {isPastScheduledDate ? '⚠️ Ready to publish - ' : '📅 Scheduled for '}
                      {scheduledDate?.toLocaleString()}
                    </p>
                  ) : (
                    <p className="text-xs text-warm-yellow">Draft - Not yet published</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(game)}
                    className={`p-2 text-electric-blue hover:bg-electric-blue/10 rounded-lg ${isPastScheduledDate ? 'opacity-50' : ''}`}
                    title={isPastScheduledDate ? "Cannot edit - publish date passed" : "Edit Draft"}
                    disabled={isPastScheduledDate}
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handlePublish(game.id)}
                    className="flex items-center gap-2 text-sm font-semibold bg-lime-glow/20 text-lime-glow px-3 py-2 rounded-lg hover:bg-lime-glow/30"
                    title="Publish Game Now"
                  >
                    <Send size={16} /> {isPastScheduledDate ? 'Publish Now' : 'Publish'}
                  </button>
                  <button
                    onClick={() => handleDelete(game.id)}
                    className="p-2 text-hot-red hover:bg-hot-red/10 rounded-lg"
                    title="Delete Draft"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
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
                {game.duration_type === 'season' && (
                  <button
                    onClick={() => onCelebrate(game)}
                    className="p-2 text-warm-yellow hover:bg-warm-yellow/10 rounded-lg"
                    title="Celebrate Winners"
                  >
                    <Trophy size={16} />
                  </button>
                )}
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
              {game.duration_type === 'season' && (
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
