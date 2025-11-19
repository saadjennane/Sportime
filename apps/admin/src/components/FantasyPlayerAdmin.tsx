import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

interface FantasyPlayer {
  id: string;
  api_player_id: number;
  name: string;
  photo: string;
  position: string;
  status: 'Star' | 'Key' | 'Wild';
  fatigue: number;
  team_name: string;
  team_logo: string;
  birthdate: string;
  pgs: number;
  created_at: string;
}

export default function FantasyPlayerAdmin() {
  const [players, setPlayers] = useState<FantasyPlayer[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<FantasyPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState({
    position: 'all',
    status: 'all',
    team: '',
    search: '',
  });

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    byPosition: { Goalkeeper: 0, Defender: 0, Midfielder: 0, Attacker: 0 },
    byStatus: { Star: 0, Key: 0, Wild: 0 },
  });

  useEffect(() => {
    fetchPlayers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [players, filters]);

  const fetchPlayers = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('fantasy_players')
        .select('*')
        .order('pgs', { ascending: false });

      if (fetchError) throw fetchError;

      setPlayers(data || []);
      calculateStats(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (playerData: FantasyPlayer[]) => {
    const byPosition = { Goalkeeper: 0, Defender: 0, Midfielder: 0, Attacker: 0 };
    const byStatus = { Star: 0, Key: 0, Wild: 0 };

    playerData.forEach((player) => {
      if (player.position in byPosition) {
        byPosition[player.position as keyof typeof byPosition]++;
      }
      if (player.status in byStatus) {
        byStatus[player.status]++;
      }
    });

    setStats({
      total: playerData.length,
      byPosition,
      byStatus,
    });
  };

  const applyFilters = () => {
    let filtered = [...players];

    // Position filter
    if (filters.position !== 'all') {
      filtered = filtered.filter((p) => p.position === filters.position);
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter((p) => p.status === filters.status);
    }

    // Team filter
    if (filters.team) {
      filtered = filtered.filter((p) =>
        p.team_name.toLowerCase().includes(filters.team.toLowerCase())
      );
    }

    // Search filter
    if (filters.search) {
      filtered = filtered.filter((p) =>
        p.name.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    setFilteredPlayers(filtered);
  };

  const handlePopulateFromStats = async () => {
    if (!confirm('Cela va peupler fantasy_players depuis player_season_stats pour La Liga 2024. Continuer?')) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Execute the SQL to populate fantasy_players
      const { data: existingPlayers } = await supabase
        .from('fantasy_players')
        .select('api_player_id');

      const existingIds = new Set(existingPlayers?.map(p => p.api_player_id) || []);

      // Fetch from player_season_stats
      const { data: seasonStats, error: statsError } = await supabase
        .from('player_season_stats')
        .select(`
          player_id,
          pgs,
          appearances,
          players!inner(
            id,
            api_id,
            first_name,
            last_name,
            photo_url,
            position,
            birthdate
          ),
          teams!inner(
            name,
            logo_url
          )
        `)
        .eq('season', 2024)
        .eq('league_id', '22222222-2222-2222-2222-222222222222')
        .gte('appearances', 5)
        .order('pgs', { ascending: false })
        .limit(300);

      if (statsError) throw statsError;

      const playersToInsert = (seasonStats || [])
        .filter((stat: any) => !existingIds.has(stat.players.api_id))
        .map((stat: any) => ({
          api_player_id: stat.players.api_id,
          name: `${stat.players.first_name} ${stat.players.last_name}`,
          photo: stat.players.photo_url,
          position: stat.players.position,
          status: stat.pgs >= 7.5 ? 'Star' : stat.pgs >= 6.0 ? 'Key' : 'Wild',
          fatigue: 100,
          team_name: stat.teams.name,
          team_logo: stat.teams.logo_url,
          birthdate: stat.players.birthdate,
          pgs: stat.pgs,
        }));

      if (playersToInsert.length === 0) {
        setSuccess('Aucun nouveau joueur à ajouter (tous déjà présents)');
        return;
      }

      const { error: insertError } = await supabase
        .from('fantasy_players')
        .insert(playersToInsert);

      if (insertError) throw insertError;

      setSuccess(`${playersToInsert.length} joueurs ajoutés avec succès!`);
      fetchPlayers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetFatigue = async () => {
    if (!confirm('Réinitialiser la fatigue de TOUS les joueurs à 100%?')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('fantasy_players')
        .update({ fatigue: 100 })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all

      if (updateError) throw updateError;

      setSuccess('Fatigue réinitialisée pour tous les joueurs');
      fetchPlayers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlayer = async (playerId: string) => {
    if (!confirm('Supprimer ce joueur du pool Fantasy?')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('fantasy_players')
        .delete()
        .eq('id', playerId);

      if (deleteError) throw deleteError;

      setSuccess('Joueur supprimé');
      fetchPlayers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Star': return 'bg-yellow-500';
      case 'Key': return 'bg-blue-500';
      case 'Wild': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'Goalkeeper': return 'text-yellow-400';
      case 'Defender': return 'text-blue-400';
      case 'Midfielder': return 'text-green-400';
      case 'Attacker': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="p-6 bg-gray-900 text-white rounded-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Fantasy Players Pool</h2>
        <div className="flex gap-3">
          <button
            onClick={handleResetFatigue}
            disabled={loading}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg transition disabled:opacity-50"
          >
            Reset Fatigue (All)
          </button>
          <button
            onClick={handlePopulateFromStats}
            disabled={loading}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Population...' : 'Peupler depuis Stats'}
          </button>
          <button
            onClick={fetchPlayers}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
          >
            Rafraîchir
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

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-gray-800 rounded-lg">
          <div className="text-3xl font-bold text-blue-400">{stats.total}</div>
          <div className="text-sm text-gray-400">Total Joueurs</div>
        </div>

        <div className="p-4 bg-gray-800 rounded-lg">
          <div className="text-sm text-gray-400 mb-2">Par Position</div>
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-yellow-400">GK:</span>
              <span>{stats.byPosition.Goalkeeper}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-400">DEF:</span>
              <span>{stats.byPosition.Defender}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-400">MID:</span>
              <span>{stats.byPosition.Midfielder}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-red-400">ATT:</span>
              <span>{stats.byPosition.Attacker}</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-800 rounded-lg">
          <div className="text-sm text-gray-400 mb-2">Par Statut</div>
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-yellow-400">Star:</span>
              <span>{stats.byStatus.Star}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-400">Key:</span>
              <span>{stats.byStatus.Key}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-purple-400">Wild:</span>
              <span>{stats.byStatus.Wild}</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-800 rounded-lg">
          <div className="text-sm text-gray-400 mb-2">Filtrés</div>
          <div className="text-3xl font-bold text-green-400">{filteredPlayers.length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 p-4 bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">Filtres</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Position</label>
            <select
              value={filters.position}
              onChange={(e) => setFilters({ ...filters, position: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="all">Toutes</option>
              <option value="Goalkeeper">Goalkeeper</option>
              <option value="Defender">Defender</option>
              <option value="Midfielder">Midfielder</option>
              <option value="Attacker">Attacker</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Statut</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="all">Tous</option>
              <option value="Star">Star (PGS ≥7.5)</option>
              <option value="Key">Key (PGS 6-7.5)</option>
              <option value="Wild">Wild (PGS &lt;6)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Équipe</label>
            <input
              type="text"
              value={filters.team}
              onChange={(e) => setFilters({ ...filters, team: e.target.value })}
              placeholder="Rechercher équipe..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Joueur</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Rechercher nom..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <button
          onClick={() => setFilters({ position: 'all', status: 'all', team: '', search: '' })}
          className="mt-3 text-sm text-blue-400 hover:text-blue-300"
        >
          Réinitialiser les filtres
        </button>
      </div>

      {/* Players Table */}
      <div className="overflow-x-auto">
        {loading && players.length === 0 ? (
          <div className="text-center py-8 text-gray-400">Chargement...</div>
        ) : filteredPlayers.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            Aucun joueur trouvé avec ces filtres
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left">Joueur</th>
                <th className="px-4 py-3 text-left">Équipe</th>
                <th className="px-4 py-3 text-center">Pos</th>
                <th className="px-4 py-3 text-center">Statut</th>
                <th className="px-4 py-3 text-center">PGS</th>
                <th className="px-4 py-3 text-center">Fatigue</th>
                <th className="px-4 py-3 text-center">API ID</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map((player) => (
                <tr key={player.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={player.photo || 'https://via.placeholder.com/40'}
                        alt={player.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div>
                        <div className="font-medium">{player.name}</div>
                        <div className="text-xs text-gray-500">
                          {player.birthdate ? `${new Date().getFullYear() - new Date(player.birthdate).getFullYear()} ans` : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <img
                        src={player.team_logo || 'https://via.placeholder.com/20'}
                        alt={player.team_name}
                        className="w-5 h-5 object-contain"
                      />
                      <span className="text-sm">{player.team_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-semibold ${getPositionColor(player.position)}`}>
                      {player.position.substring(0, 3).toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(player.status)}`}>
                      {player.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-semibold">
                    {player.pgs?.toFixed(2) || 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-12 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            player.fatigue >= 70 ? 'bg-green-500' :
                            player.fatigue >= 40 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${player.fatigue}%` }}
                        />
                      </div>
                      <span className="text-xs w-8">{player.fatigue}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-gray-500">
                    {player.api_player_id}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDeletePlayer(player.id)}
                      className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 rounded transition"
                    >
                      Suppr
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
