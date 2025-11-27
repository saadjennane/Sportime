import React, { useState } from 'react';
import { SportimeGame, TournamentType, GameRewardTier } from '../../types';
import { Play, Plus, Edit, Trophy, Send, Trash2, Calendar, Clock } from 'lucide-react';
import { GameCreationForm } from './GameCreationForm';
import { useMockStore } from '../../store/useMockStore';
import { publishChallenge, deleteChallenge, updateChallenge } from '../../services/challengeService';
import { format } from 'date-fns';

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
  const scheduledGames = games.filter(c => c.status === 'Scheduled');
  const upcomingGames = games.filter(c => c.status === 'Upcoming');
  const otherGames = games.filter(c => c.status !== 'Upcoming' && c.status !== 'Draft' && c.status !== 'Scheduled');

  const formatPublishDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'dd MMM yyyy, HH:mm');
    } catch {
      return dateStr;
    }
  };

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
    if (game.status !== 'Draft' && game.status !== 'Scheduled') {
      addToast('Only draft and scheduled games can be edited', 'error');
      return;
    }
    // Check if publish date has passed for scheduled games
    if (game.status === 'Scheduled' && game.publish_date) {
      const publishDateTime = new Date(game.publish_date);
      if (publishDateTime <= new Date()) {
        addToast('Cannot edit: publish date has passed. Please publish the game first.', 'error');
        return;
      }
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

      {/* Drafts Section */}
      {draftGames.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-md font-semibold text-text-secondary flex items-center gap-2">
            <Edit size={16} className="text-warm-yellow" /> Drafts ({draftGames.length})
          </h3>
          {draftGames.map(game => (
            <div key={game.id} className="card-base p-3 flex items-center justify-between border-l-4 border-warm-yellow">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-text-primary">{game.name}</p>
                  <span className="text-xs px-2 py-0.5 bg-warm-yellow/20 text-warm-yellow rounded">{game.game_type}</span>
                </div>
                <p className="text-xs text-warm-yellow mt-1">Draft - Not yet published</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(game)}
                  className="p-2 text-electric-blue hover:bg-electric-blue/10 rounded-lg"
                  title="Edit Draft"
                >
                  <Edit size={16} />
                </button>
                <button
                  onClick={() => handlePublish(game.id)}
                  className="flex items-center gap-2 text-sm font-semibold bg-lime-glow/20 text-lime-glow px-3 py-2 rounded-lg hover:bg-lime-glow/30"
                  title="Publish Game Now"
                >
                  <Send size={16} /> Publish
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
          ))}
        </div>
      )}

      {/* Scheduled Section */}
      {scheduledGames.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-md font-semibold text-text-secondary flex items-center gap-2">
            <Calendar size={16} className="text-electric-blue" /> Scheduled ({scheduledGames.length})
          </h3>
          {scheduledGames.map(game => {
            const publishDate = game.publish_date ? new Date(game.publish_date) : null;
            const isPastScheduledDate = publishDate && publishDate <= new Date();

            return (
              <div key={game.id} className={`card-base p-3 flex items-center justify-between border-l-4 ${isPastScheduledDate ? 'border-hot-red' : 'border-electric-blue'}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-text-primary">{game.name}</p>
                    <span className="text-xs px-2 py-0.5 bg-electric-blue/20 text-electric-blue rounded">{game.game_type}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <p className={`text-xs flex items-center gap-1 ${isPastScheduledDate ? 'text-hot-red' : 'text-electric-blue'}`}>
                      <Clock size={12} />
                      {isPastScheduledDate ? '⚠️ Ready to publish - ' : 'Publishes: '}
                      {formatPublishDate(game.publish_date)}
                    </p>
                    <p className="text-xs text-text-disabled">
                      Starts: {formatPublishDate(game.start_date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(game)}
                    className={`p-2 text-electric-blue hover:bg-electric-blue/10 rounded-lg ${isPastScheduledDate ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title={isPastScheduledDate ? "Cannot edit - publish date passed" : "Edit Scheduled Game"}
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
                    title="Delete Game"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upcoming (Published) Section */}
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
