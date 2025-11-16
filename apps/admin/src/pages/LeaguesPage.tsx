import { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, RefreshCw, Download, Users } from 'lucide-react';
import { leagueService } from '../services/leagueService';
import type { LeagueWithTeamCount } from '../types/football';
import { LeagueFormModal } from '../components/admin/LeagueFormModal';
import { syncLeague, syncLeagueTeams, type SyncProgress } from '../services/footballSyncService';

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
  const [syncingLeague, setSyncingLeague] = useState<number | null>(null);
  const [syncingTeams, setSyncingTeams] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [leagueIds, setLeagueIds] = useState<string>('');
  const [isBulkImporting, setIsBulkImporting] = useState(false);

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

  const handleSyncLeague = async (leagueApiId: number, leagueName: string) => {
    setSyncingLeague(leagueApiId);
    setSyncProgress(null);

    const result = await syncLeague(leagueApiId, 2024, (progress) => {
      setSyncProgress(progress);
    });

    if (result.success) {
      mockAddToast(`${leagueName} imported successfully!`, 'success');
      await loadLeagues();
    } else {
      mockAddToast(`Failed to import ${leagueName}: ${result.error}`, 'error');
    }

    setSyncingLeague(null);
    setSyncProgress(null);
  };

  const handleSyncTeams = async (league: LeagueWithTeamCount) => {
    if (!league.api_id) {
      mockAddToast('League must have an API ID to sync teams', 'error');
      return;
    }

    setSyncingTeams(league.id);
    setSyncProgress(null);

    const result = await syncLeagueTeams(league.id, league.api_id, 2024, (progress) => {
      setSyncProgress(progress);
    });

    if (result.success) {
      mockAddToast(`Imported ${result.teamsCount} teams for ${league.name}`, 'success');
      await loadLeagues();
    } else {
      mockAddToast(`Failed to sync teams: ${result.error}`, 'error');
    }

    setSyncingTeams(null);
    setSyncProgress(null);
  };

  const handleBulkImport = async () => {
    if (!leagueIds.trim()) {
      mockAddToast('Please enter at least one league ID', 'error');
      return;
    }

    const ids = leagueIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));

    if (ids.length === 0) {
      mockAddToast('Please enter valid league IDs', 'error');
      return;
    }

    setIsBulkImporting(true);
    setSyncProgress(null);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < ids.length; i++) {
      const leagueId = ids[i];

      setSyncProgress({
        step: 'leagues',
        current: i + 1,
        total: ids.length,
        message: `Importing league ${leagueId}...`
      });

      const result = await syncLeague(leagueId, 2024, (progress) => {
        setSyncProgress({
          ...progress,
          message: `[${i + 1}/${ids.length}] ${progress.message}`
        });
      });

      if (result.success) {
        successCount++;
      } else {
        failCount++;
        console.error(`Failed to import league ${leagueId}:`, result.error);
      }
    }

    await loadLeagues();
    setIsBulkImporting(false);
    setSyncProgress(null);
    setLeagueIds('');

    mockAddToast(
      `Import complete: ${successCount} succeeded, ${failCount} failed`,
      failCount > 0 ? 'error' : 'success'
    );
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

      {/* Import Leagues by ID */}
      <div className="mb-6 p-6 bg-surface border border-border-subtle rounded-lg">
        <h2 className="text-xl font-bold mb-4">Import Leagues from API-Football</h2>
        <p className="text-text-secondary mb-4">
          Enter league ID(s) separated by commas. Example: 39,140,78,135
        </p>
        <p className="text-sm text-text-secondary mb-4">
          Common IDs: Premier League (39), La Liga (140), Bundesliga (78), Serie A (135)
        </p>

        {syncProgress && (
          <div className="mb-4 p-4 bg-background-dark rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{syncProgress.message}</span>
              <span className="text-sm text-text-secondary">
                {syncProgress.current}/{syncProgress.total}
              </span>
            </div>
            <div className="w-full bg-surface-hover rounded-full h-2">
              <div
                className="bg-electric-blue h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${(syncProgress.current / syncProgress.total) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-4">
          <input
            type="text"
            value={leagueIds}
            onChange={(e) => setLeagueIds(e.target.value)}
            placeholder="e.g., 39,140,78,135"
            disabled={isBulkImporting}
            className="flex-1 px-4 py-2 bg-navy-accent border border-gray-700 rounded-lg focus:outline-none focus:border-electric-blue disabled:opacity-50 text-white placeholder:text-text-disabled"
          />
          <button
            onClick={handleBulkImport}
            disabled={isBulkImporting || !leagueIds.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-electric-blue hover:bg-electric-blue/80 disabled:bg-surface-hover disabled:text-text-disabled text-white rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>{isBulkImporting ? 'Importing...' : 'Import'}</span>
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
                        {league.api_id && (
                          <button
                            onClick={() => handleSyncTeams(league)}
                            disabled={syncingTeams === league.id}
                            className="p-2 hover:bg-background-dark rounded transition-colors disabled:opacity-50"
                            title="Sync Teams"
                          >
                            <Users className="w-4 h-4 text-lime-glow" />
                          </button>
                        )}
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
