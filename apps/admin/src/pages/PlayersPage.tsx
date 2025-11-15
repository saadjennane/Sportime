import { useState, useEffect } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { playerService } from '../services/playerService';
import type { PlayerWithTeam } from '../types/football';

const mockAddToast = (message: string, type: 'success' | 'error' | 'info') => {
  console.log(`[${type.toUpperCase()}]`, message);
};

export function PlayersPage() {
  const [players, setPlayers] = useState<PlayerWithTeam[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<PlayerWithTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncStatus, setSyncStatus] = useState({
    staging_count: 0,
    production_count: 0,
    last_synced: null as string | null,
  });

  useEffect(() => {
    loadPlayers();
    loadSyncStatus();
  }, []);

  useEffect(() => {
    filterPlayers();
  }, [searchQuery, players]);

  const loadPlayers = async () => {
    setLoading(true);
    const { data, error } = await playerService.getAll();

    if (error) {
      mockAddToast('Failed to load players', 'error');
      console.error('[ERROR] Failed to load players');
      console.error(error);
    } else {
      console.log(`✅ Loaded ${data?.length || 0} players`);
      setPlayers(data || []);
    }

    setLoading(false);
  };

  const loadSyncStatus = async () => {
    const status = await playerService.getSyncStatus();
    setSyncStatus(status);
  };

  const filterPlayers = () => {
    let filtered = players;

    if (searchQuery) {
      filtered = filtered.filter((player) =>
        `${player.first_name} ${player.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        player.name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredPlayers(filtered);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Players Management</h1>
        <p className="text-text-secondary">
          Manage football players and statistics
        </p>
      </div>

      <div className="mb-6 p-4 bg-surface border border-border-subtle rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-sm text-text-secondary">Production</p>
              <p className="text-2xl font-bold text-electric-blue">
                {syncStatus.production_count}
              </p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">Staging (fb_players)</p>
              <p className="text-2xl font-bold text-lime-glow">
                {syncStatus.staging_count}
              </p>
            </div>
            {syncStatus.last_synced && (
              <div>
                <p className="text-sm text-text-secondary">Last Synced</p>
                <p className="text-sm text-text-primary">
                  {new Date(syncStatus.last_synced).toLocaleString()}
                </p>
              </div>
            )}
          </div>
          <button
            onClick={() => loadSyncStatus()}
            className="flex items-center gap-2 px-4 py-2 bg-surface-hover hover:bg-border-subtle rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-disabled" />
          <input
            type="text"
            placeholder="Search players..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface border border-border-subtle rounded-lg focus:outline-none focus:border-electric-blue"
          />
        </div>
      </div>

      <div className="bg-surface border border-border-subtle rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-secondary">Loading...</div>
        ) : filteredPlayers.length === 0 ? (
          <div className="p-8 text-center text-text-secondary">
            No players found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background-dark border-b border-border-subtle">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">
                    Photo
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">
                    Nationality
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">
                    Position
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">
                    API ID
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">
                    Current Team
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredPlayers.map((player) => (
                  <tr
                    key={player.id}
                    className="hover:bg-surface-hover transition-colors"
                  >
                    <td className="px-4 py-3">
                      {player.photo || player.photo_url ? (
                        <img
                          src={player.photo || player.photo_url}
                          alt={`${player.first_name} ${player.last_name}`}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-background-dark rounded-full flex items-center justify-center text-text-disabled text-xs">
                          N/A
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {player.name || `${player.first_name} ${player.last_name}`}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {player.nationality}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {player.position || '-'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {player.api_player_id || player.api_id || '-'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {player.team_name || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
