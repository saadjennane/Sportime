import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

interface FantasyLeaguePlayer {
  id: string;
  league_id: string;
  player_id: string;
  status: 'Star' | 'Key' | 'Wild';
  pgs: number;
  is_available: boolean;
  players: {
    first_name: string;
    last_name: string;
    position: string;
    photo_url?: string;
    birthdate?: string;
  };
  leagues: {
    name: string;
    country: string;
  };
}

interface League {
  id: string;
  name: string;
  country: string;
}

export default function FantasyPlayerAdmin() {
  const [players, setPlayers] = useState<FantasyLeaguePlayer[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [positionFilter, setPositionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchLeagues();
  }, []);

  useEffect(() => {
    if (selectedLeagueId) {
      fetchPlayers();
    } else {
      setPlayers([]);
    }
  }, [selectedLeagueId]);

  const fetchLeagues = async () => {
    if (!supabase) {
      console.error('Supabase client is not initialized. Check environment variables in apps/admin/.env');
      setError('Supabase client not initialized. Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
      return;
    }

    try {
      const { data, error: fetchError} = await supabase
        .from('leagues')
        .select('id, name, country')
        .order('name');

      if (fetchError) throw fetchError;
      setLeagues(data || []);

      // Auto-select first league if available
      if (data && data.length > 0 && !selectedLeagueId) {
        setSelectedLeagueId(data[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching leagues:', err);
    }
  };

  const fetchPlayers = async () => {
    if (!selectedLeagueId) return;

    if (!supabase) {
      console.error('Supabase client is not initialized. Check environment variables in apps/admin/.env');
      setError('Supabase client not initialized. Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('fantasy_league_players')
        .select(`
          *,
          players:player_id (
            first_name,
            last_name,
            position,
            photo_url,
            birthdate
          ),
          leagues:league_id (
            name,
            country
          )
        `)
        .eq('league_id', selectedLeagueId)
        .order('pgs', { ascending: false });

      if (fetchError) throw fetchError;
      setPlayers(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAvailability = async (playerId: string, currentStatus: boolean) => {
    try {
      const { error: updateError } = await supabase
        .from('fantasy_league_players')
        .update({ is_available: !currentStatus })
        .eq('id', playerId);

      if (updateError) throw updateError;

      setSuccess('Disponibilité mise à jour');
      fetchPlayers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Apply filters
  const filteredPlayers = players.filter((player) => {
    const matchesPosition = positionFilter === 'all' || player.players.position === positionFilter;
    const matchesStatus = statusFilter === 'all' || player.status === statusFilter;
    const matchesSearch = searchQuery === '' ||
      `${player.players.first_name} ${player.players.last_name}`.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesPosition && matchesStatus && matchesSearch;
  });

  // Statistics
  const stats = {
    total: players.length,
    star: players.filter(p => p.status === 'Star').length,
    key: players.filter(p => p.status === 'Key').length,
    wild: players.filter(p => p.status === 'Wild').length,
    available: players.filter(p => p.is_available).length,
    goalkeeper: players.filter(p => p.players.position === 'Goalkeeper').length,
    defender: players.filter(p => p.players.position === 'Defender').length,
    midfielder: players.filter(p => p.players.position === 'Midfielder').length,
    attacker: players.filter(p => p.players.position === 'Attacker').length,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Star': return 'text-yellow-400 bg-yellow-500/20';
      case 'Key': return 'text-blue-400 bg-blue-500/20';
      case 'Wild': return 'text-purple-400 bg-purple-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'Goalkeeper': return 'text-orange-400';
      case 'Defender': return 'text-green-400';
      case 'Midfielder': return 'text-blue-400';
      case 'Attacker': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="p-6 bg-gray-900 text-white rounded-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Fantasy League Players Pool</h2>
        <p className="text-sm text-gray-400">
          Joueurs disponibles pour les jeux Fantasy par ligue (basés sur player_season_stats)
        </p>
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

      {/* League Selector */}
      <div className="mb-6 p-4 bg-gray-800 rounded-lg">
        <label className="block text-sm font-medium mb-2">Sélectionner une Ligue</label>
        <select
          value={selectedLeagueId}
          onChange={(e) => setSelectedLeagueId(e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
        >
          <option value="">-- Choisir une ligue --</option>
          {leagues.map((league) => (
            <option key={league.id} value={league.id}>
              {league.name} ({league.country})
            </option>
          ))}
        </select>
      </div>

      {selectedLeagueId && (
        <>
          {/* Statistics */}
          <div className="mb-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <div className="p-3 bg-gray-800 rounded-lg text-center">
              <div className="text-2xl font-bold text-white">{stats.total}</div>
              <div className="text-xs text-gray-400">Total</div>
            </div>
            <div className="p-3 bg-yellow-500/10 rounded-lg text-center border border-yellow-500/30">
              <div className="text-2xl font-bold text-yellow-400">{stats.star}</div>
              <div className="text-xs text-gray-400">Star</div>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-lg text-center border border-blue-500/30">
              <div className="text-2xl font-bold text-blue-400">{stats.key}</div>
              <div className="text-xs text-gray-400">Key</div>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-lg text-center border border-purple-500/30">
              <div className="text-2xl font-bold text-purple-400">{stats.wild}</div>
              <div className="text-xs text-gray-400">Wild</div>
            </div>
            <div className="p-3 bg-orange-500/10 rounded-lg text-center border border-orange-500/30">
              <div className="text-2xl font-bold text-orange-400">{stats.goalkeeper}</div>
              <div className="text-xs text-gray-400">GK</div>
            </div>
            <div className="p-3 bg-green-500/10 rounded-lg text-center border border-green-500/30">
              <div className="text-2xl font-bold text-green-400">{stats.defender}</div>
              <div className="text-xs text-gray-400">DEF</div>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-lg text-center border border-blue-500/30">
              <div className="text-2xl font-bold text-blue-400">{stats.midfielder}</div>
              <div className="text-xs text-gray-400">MID</div>
            </div>
            <div className="p-3 bg-red-500/10 rounded-lg text-center border border-red-500/30">
              <div className="text-2xl font-bold text-red-400">{stats.attacker}</div>
              <div className="text-xs text-gray-400">ATT</div>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6 p-4 bg-gray-800 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Position</label>
                <select
                  value={positionFilter}
                  onChange={(e) => setPositionFilter(e.target.value)}
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
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="all">Tous</option>
                  <option value="Star">Star</option>
                  <option value="Key">Key</option>
                  <option value="Wild">Wild</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Recherche</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Nom du joueur..."
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Players Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="text-center py-12 text-gray-400">Chargement des joueurs...</div>
            ) : filteredPlayers.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                Aucun joueur trouvé. Utilisez la synchronisation dans l'onglet "Manual Sync".
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Joueur</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Position</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">PGS</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Disponible</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredPlayers.map((player) => (
                    <tr key={player.id} className="hover:bg-gray-800/50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {player.players.photo_url && (
                            <img
                              src={player.players.photo_url}
                              alt={`${player.players.first_name} ${player.players.last_name}`}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          )}
                          <div>
                            <div className="font-medium">
                              {player.players.first_name} {player.players.last_name}
                            </div>
                            {player.players.birthdate && (
                              <div className="text-xs text-gray-500">
                                {new Date().getFullYear() - new Date(player.players.birthdate).getFullYear()} ans
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-medium ${getPositionColor(player.players.position)}`}>
                          {player.players.position}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(player.status)}`}>
                          {player.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-lg font-bold">
                          {player.pgs.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {player.is_available ? (
                          <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded-full">
                            Oui
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded-full">
                            Non
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleAvailability(player.id, player.is_available)}
                          className={`px-3 py-1 text-xs rounded-lg transition ${
                            player.is_available
                              ? 'bg-red-600 hover:bg-red-700'
                              : 'bg-green-600 hover:bg-green-700'
                          }`}
                        >
                          {player.is_available ? 'Désactiver' : 'Activer'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-4 text-sm text-gray-500">
            Affichage de {filteredPlayers.length} joueur(s) sur {players.length} total
          </div>
        </>
      )}
    </div>
  );
}
