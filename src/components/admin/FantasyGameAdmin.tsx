import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface FantasyGame {
  id: string;
  name: string;
  status: 'Draft' | 'Ongoing' | 'Completed';
  start_date: string;
  end_date: string;
  entry_cost: number;
  is_linkable: boolean;
  created_at: string;
}

export default function FantasyGameAdmin() {
  const [games, setGames] = useState<FantasyGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    status: 'Draft' as 'Draft' | 'Ongoing' | 'Completed',
    start_date: '',
    end_date: '',
    entry_cost: 1500,
    is_linkable: true,
  });

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('fantasy_games')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setGames(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: insertError } = await supabase
        .from('fantasy_games')
        .insert([formData]);

      if (insertError) throw insertError;

      setSuccess('Fantasy Game créé avec succès!');
      setShowCreateForm(false);
      setFormData({
        name: '',
        status: 'Draft',
        start_date: '',
        end_date: '',
        entry_cost: 1500,
        is_linkable: true,
      });
      fetchGames();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (gameId: string, newStatus: 'Draft' | 'Ongoing' | 'Completed') => {
    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('fantasy_games')
        .update({ status: newStatus })
        .eq('id', gameId);

      if (updateError) throw updateError;

      setSuccess(`Statut mis à jour: ${newStatus}`);
      fetchGames();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce jeu Fantasy? Cette action est irréversible.')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('fantasy_games')
        .delete()
        .eq('id', gameId);

      if (deleteError) throw deleteError;

      setSuccess('Jeu Fantasy supprimé avec succès');
      fetchGames();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft': return 'bg-gray-500';
      case 'Ongoing': return 'bg-green-500';
      case 'Completed': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="p-6 bg-gray-900 text-white rounded-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Fantasy Games Admin</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
        >
          {showCreateForm ? 'Annuler' : '+ Nouveau Jeu'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-500/20 border border-green-500 rounded-lg">
          <p className="text-green-200">{success}</p>
        </div>
      )}

      {showCreateForm && (
        <form onSubmit={handleCreateGame} className="mb-6 p-4 bg-gray-800 rounded-lg">
          <h3 className="text-xl font-semibold mb-4">Créer un Nouveau Jeu Fantasy</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Nom du Jeu</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="La Liga Fantasy - Saison 2024/25"
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Statut</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="Draft">Draft</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Date de Début</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Date de Fin</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Coût d'Entrée (Coins)</label>
              <input
                type="number"
                value={formData.entry_cost}
                onChange={(e) => setFormData({ ...formData, entry_cost: parseInt(e.target.value) })}
                min="0"
                step="100"
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_linkable"
                checked={formData.is_linkable}
                onChange={(e) => setFormData({ ...formData, is_linkable: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor="is_linkable" className="text-sm font-medium">
                Linkable (permet création d'équipes)
              </label>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Création...' : 'Créer le Jeu'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-6 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {loading && games.length === 0 ? (
          <div className="text-center py-8 text-gray-400">Chargement...</div>
        ) : games.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            Aucun jeu Fantasy. Créez-en un pour commencer!
          </div>
        ) : (
          games.map((game) => (
            <div key={game.id} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold">{game.name}</h3>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(game.status)}`}>
                      {game.status}
                    </span>
                    {game.is_linkable && (
                      <span className="px-2 py-1 text-xs bg-purple-600 rounded-full">Linkable</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-300">
                    <div>
                      <span className="text-gray-500">Début:</span>
                      <p className="font-medium">{new Date(game.start_date).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Fin:</span>
                      <p className="font-medium">{new Date(game.end_date).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Coût:</span>
                      <p className="font-medium">{game.entry_cost} coins</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Créé:</span>
                      <p className="font-medium">{new Date(game.created_at).toLocaleDateString('fr-FR')}</p>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-gray-500">
                    ID: {game.id}
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <select
                    value={game.status}
                    onChange={(e) => handleUpdateStatus(game.id, e.target.value as any)}
                    className="px-3 py-1 text-sm bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="Completed">Completed</option>
                  </select>

                  <button
                    onClick={() => handleDeleteGame(game.id)}
                    className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 rounded-lg transition"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
