import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

interface FantasyGame {
  id: string;
  name: string;
}

interface FantasyGameWeek {
  id: string;
  fantasy_game_id: string;
  name: string;
  start_date: string;
  end_date: string;
  leagues: string[];
  status: 'upcoming' | 'live' | 'finished';
  conditions: any;
  created_at: string;
}

export default function FantasyGameWeekAdmin() {
  const [games, setGames] = useState<FantasyGame[]>([]);
  const [gameWeeks, setGameWeeks] = useState<FantasyGameWeek[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showBulkCreate, setShowBulkCreate] = useState(false);
  const [formData, setFormData] = useState({
    fantasy_game_id: '',
    name: '',
    start_date: '',
    end_date: '',
    leagues: ['LaLiga'],
    status: 'upcoming' as 'upcoming' | 'live' | 'finished',
    max_club_players: 2,
  });

  // Bulk create form
  const [bulkFormData, setBulkFormData] = useState({
    fantasy_game_id: '',
    num_weeks: 38,
    first_week_start: '',
    league: 'LaLiga',
    max_club_players: 2,
  });

  useEffect(() => {
    fetchGames();
  }, []);

  useEffect(() => {
    if (selectedGameId) {
      fetchGameWeeks(selectedGameId);
    }
  }, [selectedGameId]);

  const fetchGames = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('fantasy_games')
        .select('id, name')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setGames(data || []);

      if (data && data.length > 0 && !selectedGameId) {
        setSelectedGameId(data[0].id);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchGameWeeks = async (gameId: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('fantasy_game_weeks')
        .select('*')
        .eq('fantasy_game_id', gameId)
        .order('start_date', { ascending: true });

      if (fetchError) throw fetchError;
      setGameWeeks(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGameWeek = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const conditions = [
        {
          key: 'max_club_players',
          text: `Max. ${formData.max_club_players} players from same club`,
          value: formData.max_club_players,
        },
      ];

      const { error: insertError } = await supabase
        .from('fantasy_game_weeks')
        .insert([{
          fantasy_game_id: formData.fantasy_game_id,
          name: formData.name,
          start_date: formData.start_date,
          end_date: formData.end_date,
          leagues: formData.leagues,
          status: formData.status,
          conditions: conditions,
        }]);

      if (insertError) throw insertError;

      setSuccess('Game Week créée avec succès!');
      setShowCreateForm(false);
      setFormData({
        fantasy_game_id: selectedGameId,
        name: '',
        start_date: '',
        end_date: '',
        leagues: ['LaLiga'],
        status: 'upcoming',
        max_club_players: 2,
      });
      fetchGameWeeks(selectedGameId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const gameWeeks = [];
      const startDate = new Date(bulkFormData.first_week_start);

      for (let i = 1; i <= bulkFormData.num_weeks; i++) {
        // Calculate week start (Friday)
        const weekStart = new Date(startDate);
        weekStart.setDate(startDate.getDate() + (i - 1) * 7);

        // Calculate week end (Sunday)
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 2);

        const conditions = [
          {
            key: 'max_club_players',
            text: `Max. ${bulkFormData.max_club_players} players from same club`,
            value: bulkFormData.max_club_players,
          },
        ];

        gameWeeks.push({
          fantasy_game_id: bulkFormData.fantasy_game_id,
          name: `Jornada ${i}`,
          start_date: weekStart.toISOString().split('T')[0],
          end_date: weekEnd.toISOString().split('T')[0],
          leagues: [bulkFormData.league],
          status: 'upcoming',
          conditions: conditions,
        });
      }

      const { error: insertError } = await supabase
        .from('fantasy_game_weeks')
        .insert(gameWeeks);

      if (insertError) throw insertError;

      setSuccess(`${bulkFormData.num_weeks} Game Weeks créées avec succès!`);
      setShowBulkCreate(false);
      setBulkFormData({
        fantasy_game_id: selectedGameId,
        num_weeks: 38,
        first_week_start: '',
        league: 'LaLiga',
        max_club_players: 2,
      });
      fetchGameWeeks(selectedGameId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (gameWeekId: string, newStatus: 'upcoming' | 'live' | 'finished') => {
    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('fantasy_game_weeks')
        .update({ status: newStatus })
        .eq('id', gameWeekId);

      if (updateError) throw updateError;

      setSuccess(`Statut mis à jour: ${newStatus}`);
      fetchGameWeeks(selectedGameId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGameWeek = async (gameWeekId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette Game Week? Cette action est irréversible.')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('fantasy_game_weeks')
        .delete()
        .eq('id', gameWeekId);

      if (deleteError) throw deleteError;

      setSuccess('Game Week supprimée avec succès');
      fetchGameWeeks(selectedGameId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-500';
      case 'live': return 'bg-green-500';
      case 'finished': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="p-6 bg-gray-900 text-white rounded-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Fantasy Game Weeks Admin</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setShowBulkCreate(!showBulkCreate)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
          >
            {showBulkCreate ? 'Annuler Bulk' : 'Création en Masse'}
          </button>
          <button
            onClick={() => {
              setFormData({ ...formData, fantasy_game_id: selectedGameId });
              setShowCreateForm(!showCreateForm);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
          >
            {showCreateForm ? 'Annuler' : '+ Nouvelle Game Week'}
          </button>
        </div>
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

      {/* Game Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Sélectionner un Jeu Fantasy</label>
        <select
          value={selectedGameId}
          onChange={(e) => setSelectedGameId(e.target.value)}
          className="w-full max-w-md px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
        >
          <option value="">-- Sélectionner un jeu --</option>
          {games.map((game) => (
            <option key={game.id} value={game.id}>
              {game.name}
            </option>
          ))}
        </select>
      </div>

      {/* Bulk Create Form */}
      {showBulkCreate && (
        <form onSubmit={handleBulkCreate} className="mb-6 p-4 bg-gray-800 rounded-lg">
          <h3 className="text-xl font-semibold mb-4">Créer des Game Weeks en Masse</h3>
          <p className="text-sm text-gray-400 mb-4">
            Créez automatiquement plusieurs game weeks (ex: 38 jornadas pour La Liga).
            Les dates sont calculées automatiquement chaque semaine (Vendredi-Dimanche).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Nombre de Weeks</label>
              <input
                type="number"
                value={bulkFormData.num_weeks}
                onChange={(e) => setBulkFormData({ ...bulkFormData, num_weeks: parseInt(e.target.value) })}
                min="1"
                max="50"
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Date Première Jornada (Vendredi)</label>
              <input
                type="date"
                value={bulkFormData.first_week_start}
                onChange={(e) => setBulkFormData({ ...bulkFormData, first_week_start: e.target.value })}
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Ligue</label>
              <select
                value={bulkFormData.league}
                onChange={(e) => setBulkFormData({ ...bulkFormData, league: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="LaLiga">La Liga</option>
                <option value="PremierLeague">Premier League</option>
                <option value="Ligue1">Ligue 1</option>
                <option value="SerieA">Serie A</option>
                <option value="Bundesliga">Bundesliga</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Max Joueurs par Club</label>
              <input
                type="number"
                value={bulkFormData.max_club_players}
                onChange={(e) => setBulkFormData({ ...bulkFormData, max_club_players: parseInt(e.target.value) })}
                min="1"
                max="7"
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Création...' : `Créer ${bulkFormData.num_weeks} Game Weeks`}
            </button>
            <button
              type="button"
              onClick={() => setShowBulkCreate(false)}
              className="px-6 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Single Create Form */}
      {showCreateForm && (
        <form onSubmit={handleCreateGameWeek} className="mb-6 p-4 bg-gray-800 rounded-lg">
          <h3 className="text-xl font-semibold mb-4">Créer une Nouvelle Game Week</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Nom de la Game Week</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Jornada 1"
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
                <option value="upcoming">Upcoming</option>
                <option value="live">Live</option>
                <option value="finished">Finished</option>
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
              <label className="block text-sm font-medium mb-2">Max Joueurs par Club</label>
              <input
                type="number"
                value={formData.max_club_players}
                onChange={(e) => setFormData({ ...formData, max_club_players: parseInt(e.target.value) })}
                min="1"
                max="7"
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Création...' : 'Créer Game Week'}
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

      {/* Game Weeks List */}
      {!selectedGameId ? (
        <div className="text-center py-8 text-gray-400">
          Sélectionnez un jeu Fantasy pour voir les Game Weeks
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              Game Weeks ({gameWeeks.length})
            </h3>
            <div className="text-sm text-gray-400">
              <span className="mr-4">
                <span className="inline-block w-3 h-3 rounded-full bg-blue-500 mr-1"></span>
                {gameWeeks.filter(gw => gw.status === 'upcoming').length} Upcoming
              </span>
              <span className="mr-4">
                <span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-1"></span>
                {gameWeeks.filter(gw => gw.status === 'live').length} Live
              </span>
              <span>
                <span className="inline-block w-3 h-3 rounded-full bg-gray-500 mr-1"></span>
                {gameWeeks.filter(gw => gw.status === 'finished').length} Finished
              </span>
            </div>
          </div>

          {loading && gameWeeks.length === 0 ? (
            <div className="text-center py-8 text-gray-400">Chargement...</div>
          ) : gameWeeks.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              Aucune Game Week. Créez-en une pour commencer!
            </div>
          ) : (
            gameWeeks.map((gw) => (
              <div key={gw.id} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-semibold">{gw.name}</h4>
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(gw.status)}`}>
                        {gw.status}
                      </span>
                      <span className="px-2 py-1 text-xs bg-purple-600 rounded-full">
                        {gw.leagues.join(', ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-gray-300">
                      <div>
                        <span className="text-gray-500">Début:</span>
                        <p className="font-medium">{new Date(gw.start_date).toLocaleDateString('fr-FR')}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Fin:</span>
                        <p className="font-medium">{new Date(gw.end_date).toLocaleDateString('fr-FR')}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Max Players/Club:</span>
                        <p className="font-medium">
                          {gw.conditions?.[0]?.value || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <select
                      value={gw.status}
                      onChange={(e) => handleUpdateStatus(gw.id, e.target.value as any)}
                      className="px-3 py-1 text-sm bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                    >
                      <option value="upcoming">Upcoming</option>
                      <option value="live">Live</option>
                      <option value="finished">Finished</option>
                    </select>

                    <button
                      onClick={() => handleDeleteGameWeek(gw.id)}
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
      )}
    </div>
  );
}
