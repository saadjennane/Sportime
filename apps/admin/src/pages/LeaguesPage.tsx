import { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, RefreshCw } from 'lucide-react';
import { leagueService } from '../services/leagueService';
import type { LeagueWithTeamCount } from '../types/football';
import { LeagueFormModal } from '../components/admin/LeagueFormModal';

const mockAddToast = (message: string, type: 'success' | 'error' | 'info') => {
  console.log(`[${type.toUpperCase()}]`, message);
};

export function LeaguesPage() {
  const [leagues, setLeagues] = useState<LeagueWithTeamCount[]>([]);
  const [filteredLeagues, setFilteredLeagues] = useState<LeagueWithTeamCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingLeague, setEditingLeague] = useState<LeagueWithTeamCount | null>(null);
  const [syncStatus, setSyncStatus] = useState({
    staging_count: 0,
    production_count: 0,
    last_synced: null as string | null,
  });

  useEffect(() => {
    loadLeagues();
    loadSyncStatus();
  }, []);

  useEffect(() => {
    filterLeagues();
  }, [searchQuery, countryFilter, leagues]);

  const loadLeagues = async () => {
    setLoading(true);
    const { data, error } = await leagueService.getAll();

    if (error) {
      mockAddToast('Failed to load leagues', 'error');
      console.error(error);
    } else {
      setLeagues(data || []);
    }

    setLoading(false);
  };

  const loadSyncStatus = async () => {
    const status = await leagueService.getSyncStatus();
    setSyncStatus(status);
  };

  const filterLeagues = () => {
    let filtered = leagues;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter((league) =>
        league.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Country filter
    if (countryFilter !== 'all') {
      filtered = filtered.filter((league) => league.country_or_region === countryFilter);
    }

    setFilteredLeagues(filtered);
  };

  const handleCreate = () => {
    setEditingLeague(null);
    setShowModal(true);
  };

  const handleEdit = (league: LeagueWithTeamCount) => {
    setEditingLeague(league);
    setShowModal(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    const { error } = await leagueService.delete(id);

    if (error) {
      mockAddToast('Failed to delete league', 'error');
      console.error(error);
    } else {
      mockAddToast('League deleted successfully', 'success');
      loadLeagues();
    }
  };

  const handleModalClose = (success: boolean) => {
    setShowModal(false);
    setEditingLeague(null);
    if (success) {
      loadLeagues();
      loadSyncStatus();
    }
  };

  // Get unique countries for filter
  const countries = Array.from(new Set(leagues.map((l) => l.country_or_region))).sort();

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Leagues Management</h1>
        <p className="text-text-secondary">
          Manage football leagues and competitions
        </p>
      </div>

      {/* Sync Status */}
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
              <p className="text-sm text-text-secondary">Staging (fb_leagues)</p>
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

      {/* Filters and Actions */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-disabled" />
          <input
            type="text"
            placeholder="Search leagues..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface border border-border-subtle rounded-lg focus:outline-none focus:border-electric-blue"
          />
        </div>

        {/* Country Filter */}
        <select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          className="px-4 py-2 bg-surface border border-border-subtle rounded-lg focus:outline-none focus:border-electric-blue"
        >
          <option value="all">All Countries</option>
          {countries.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </select>

        {/* Create Button */}
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-electric-blue hover:bg-electric-blue/80 text-white rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Create League</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border-subtle rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-secondary">Loading...</div>
        ) : filteredLeagues.length === 0 ? (
          <div className="p-8 text-center text-text-secondary">
            No leagues found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background-dark border-b border-border-subtle">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">
                    Logo
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">
                    Country
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">
                    API ID
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">
                    Teams
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-text-secondary">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredLeagues.map((league) => (
                  <tr
                    key={league.id}
                    className="hover:bg-surface-hover transition-colors"
                  >
                    <td className="px-4 py-3">
                      {league.logo || league.logo_url ? (
                        <img
                          src={league.logo || league.logo_url}
                          alt={league.name}
                          className="w-8 h-8 object-contain"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-background-dark rounded flex items-center justify-center text-text-disabled text-xs">
                          N/A
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{league.name}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {league.country_or_region}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {league.type || '-'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {league.api_league_id || league.api_id || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-electric-blue/10 text-electric-blue rounded text-sm">
                        {league.team_count || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(league)}
                          className="p-2 hover:bg-background-dark rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4 text-electric-blue" />
                        </button>
                        <button
                          onClick={() => handleDelete(league.id, league.name)}
                          className="p-2 hover:bg-background-dark rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-hot-red" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <LeagueFormModal
          league={editingLeague}
          onClose={handleModalClose}
          addToast={mockAddToast}
        />
      )}
    </div>
  );
}
