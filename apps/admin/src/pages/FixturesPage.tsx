import { useState, useEffect } from 'react';
import { Search, Calendar, RefreshCw, Download, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { syncLeagueFixtures, syncLeagueTeams, type SyncProgress } from '../services/footballSyncService';
import { leagueService } from '../services/leagueService';
import type { LeagueWithTeamCount } from '../types/football';

const mockAddToast = (message: string, type: 'success' | 'error' | 'info') => {
  console.log(`[${type.toUpperCase()}]`, message);
};

interface Fixture {
  id: string;
  api_id: number | null;
  league_id: string;
  home_team_id: string;
  away_team_id: string;
  date: string;
  status: string;
  goals_home: number | null;
  goals_away: number | null;
  venue: string | null;
  referee: string | null;
  round: string | null;
  // Joined data
  league_name?: string;
  home_team_name?: string;
  away_team_name?: string;
}

export function FixturesPage() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [filteredFixtures, setFilteredFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [leagueFilter, setLeagueFilter] = useState('all');
  const [leagues, setLeagues] = useState<LeagueWithTeamCount[]>([]);
  const [syncStatus, setSyncStatus] = useState({
    total_fixtures: 0,
    future_fixtures: 0,
    past_fixtures: 0,
  });
  const [selectedLeagueIds, setSelectedLeagueIds] = useState<string[]>([]);
  const [season, setSeason] = useState('');
  const [syncingFixtures, setSyncingFixtures] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [isImportSectionCollapsed, setIsImportSectionCollapsed] = useState(false);

  useEffect(() => {
    loadFixtures();
    loadSyncStatus();
    loadLeagues();
  }, []);

  useEffect(() => {
    filterFixtures();
  }, [searchQuery, statusFilter, leagueFilter, fixtures]);

  const loadFixtures = async () => {
    if (!supabase) {
      mockAddToast('Supabase client not initialized', 'error');
      setLoading(false);
      return;
    }

    setLoading(true);

    // Load fixtures with team and league names
    const { data, error } = await supabase
      .from('fb_fixtures')
      .select(`
        *,
        league:fb_leagues!league_id(name),
        home_team:fb_teams!home_team_id(name),
        away_team:fb_teams!away_team_id(name)
      `)
      .order('date', { ascending: true })
      .limit(1000);

    if (error) {
      mockAddToast('Failed to load fixtures', 'error');
      console.error(error);
    } else {
      const formattedFixtures = (data || []).map((f: any) => ({
        ...f,
        league_name: f.league?.name,
        home_team_name: f.home_team?.name,
        away_team_name: f.away_team?.name,
      }));
      setFixtures(formattedFixtures);
    }

    setLoading(false);
  };

  const loadSyncStatus = async () => {
    if (!supabase) return;

    const now = new Date().toISOString();

    // Get total count
    const { count: total } = await supabase
      .from('fb_fixtures')
      .select('*', { count: 'exact', head: true });

    // Get future fixtures count
    const { count: future } = await supabase
      .from('fb_fixtures')
      .select('*', { count: 'exact', head: true })
      .gte('date', now);

    // Get past fixtures count
    const { count: past } = await supabase
      .from('fb_fixtures')
      .select('*', { count: 'exact', head: true })
      .lt('date', now);

    setSyncStatus({
      total_fixtures: total || 0,
      future_fixtures: future || 0,
      past_fixtures: past || 0,
    });
  };

  const loadLeagues = async () => {
    const { data, error } = await leagueService.getAll();
    if (!error && data) {
      setLeagues(data);
    }
  };

  const filterFixtures = () => {
    let filtered = fixtures;

    // Search filter (team names or league)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((fixture) =>
        fixture.home_team_name?.toLowerCase().includes(query) ||
        fixture.away_team_name?.toLowerCase().includes(query) ||
        fixture.league_name?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((fixture) => fixture.status === statusFilter);
    }

    // League filter
    if (leagueFilter !== 'all') {
      filtered = filtered.filter((fixture) => fixture.league_id === leagueFilter);
    }

    setFilteredFixtures(filtered);
  };

  const handleSyncFixtures = async (league: LeagueWithTeamCount) => {
    if (!league.api_id) {
      mockAddToast('League must have an API ID to sync fixtures', 'error');
      return;
    }

    setSyncingFixtures(league.id);
    setSyncProgress(null);

    const result = await syncLeagueFixtures(league.id, league.api_id, Number(season), (progress) => {
      setSyncProgress(progress);
    });

    if (result.success) {
      mockAddToast(`Imported ${result.fixturesCount} fixtures for ${league.name}`, 'success');
      await loadFixtures();
      await loadSyncStatus();
    } else {
      mockAddToast(`Failed to sync fixtures: ${result.error}`, 'error');
    }

    setSyncingFixtures(null);
    setSyncProgress(null);
  };

  const handleBulkImportFixtures = async () => {
    if (selectedLeagueIds.length === 0) {
      mockAddToast('Please select at least one league', 'error');
      return;
    }

    if (!season.trim()) {
      mockAddToast('Please enter a season (e.g., 2025)', 'error');
      return;
    }

    setIsBulkImporting(true);
    setSyncProgress(null);

    let successCount = 0;
    let failCount = 0;
    let totalFixtures = 0;

    for (let i = 0; i < selectedLeagueIds.length; i++) {
      const leagueId = selectedLeagueIds[i];

      // Find league by ID
      const league = leagues.find(l => l.id === leagueId);

      if (!league || !league.api_id) {
        failCount++;
        console.warn(`League not found or missing API ID: ${leagueId}`);
        continue;
      }

      // First, ensure teams are imported for this league
      setSyncProgress({
        step: 'teams',
        current: i + 1,
        total: selectedLeagueIds.length,
        message: `Checking teams for ${league.name}...`
      });

      const teamsResult = await syncLeagueTeams(league.id, league.api_id, Number(season), (progress) => {
        setSyncProgress({
          ...progress,
          message: `[${i + 1}/${selectedLeagueIds.length}] ${progress.message}`
        });
      });

      if (!teamsResult.success) {
        console.error(`Failed to sync teams for ${league.name}:`, teamsResult.error);
        mockAddToast(`Failed to sync teams for ${league.name}. Skipping fixtures.`, 'error');
        failCount++;
        continue;
      }

      // Now import fixtures
      setSyncProgress({
        step: 'fixtures',
        current: i + 1,
        total: selectedLeagueIds.length,
        message: `Importing fixtures for ${league.name}...`
      });

      const result = await syncLeagueFixtures(league.id, league.api_id, Number(season), (progress) => {
        setSyncProgress({
          ...progress,
          message: `[${i + 1}/${selectedLeagueIds.length}] ${progress.message}`
        });
      });

      if (result.success) {
        successCount++;
        totalFixtures += result.fixturesCount || 0;
      } else {
        failCount++;
        console.error(`Failed to import fixtures for ${league.name}:`, result.error);
      }
    }

    await loadFixtures();
    await loadSyncStatus();
    setIsBulkImporting(false);
    setSyncProgress(null);

    mockAddToast(
      `Import complete: ${totalFixtures} fixtures from ${successCount} league(s). ${failCount > 0 ? `Failed: ${failCount}` : ''}`,
      failCount > 0 ? 'error' : 'success'
    );
  };

  const handleLeagueToggle = (leagueId: string) => {
    setSelectedLeagueIds(prev =>
      prev.includes(leagueId)
        ? prev.filter(id => id !== leagueId)
        : [...prev, leagueId]
    );
  };

  // Get unique statuses for filter
  const statuses = Array.from(new Set(fixtures.map((f) => f.status))).sort();

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Fixtures Management</h1>
        <p className="text-text-secondary">
          Manage football fixtures and match schedules
        </p>
        <p className="text-sm text-text-disabled mt-1">
          All times displayed in UTC timezone
        </p>
      </div>

      {/* Sync Status */}
      <div className="mb-6 p-4 bg-surface border border-border-subtle rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-sm text-text-secondary">Total Fixtures</p>
              <p className="text-2xl font-bold text-electric-blue">
                {syncStatus.total_fixtures}
              </p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">Future Fixtures</p>
              <p className="text-2xl font-bold text-lime-glow">
                {syncStatus.future_fixtures}
              </p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">Past Fixtures</p>
              <p className="text-2xl font-bold text-text-disabled">
                {syncStatus.past_fixtures}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              loadFixtures();
              loadSyncStatus();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-surface-hover hover:bg-border-subtle rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Import Fixtures by League Selector */}
      <div className="mb-6 bg-surface border border-border-subtle rounded-lg">
        <button
          onClick={() => setIsImportSectionCollapsed(!isImportSectionCollapsed)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-surface-hover transition-colors"
        >
          <div className="flex items-center gap-3">
            <Download className="w-5 h-5 text-electric-blue" />
            <h2 className="text-xl font-bold">Import Fixtures from API-Football</h2>
          </div>
          {isImportSectionCollapsed ? (
            <ChevronDown className="w-5 h-5 text-text-secondary" />
          ) : (
            <ChevronUp className="w-5 h-5 text-text-secondary" />
          )}
        </button>

        {!isImportSectionCollapsed && (
          <div className="px-6 pb-6">
            <p className="text-text-secondary mb-4">
              Select leagues to import their fixtures. Teams will be imported automatically if needed.
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

            <div className="space-y-4">
              {/* Season Input */}
              <div>
                <label className="block text-sm font-medium mb-2">Season</label>
                <input
                  type="text"
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  placeholder="e.g., 2025"
                  disabled={isBulkImporting}
                  className="w-full px-4 py-2 bg-navy-accent border border-gray-700 rounded-lg focus:outline-none focus:border-electric-blue disabled:opacity-50 text-white placeholder:text-text-disabled"
                />
              </div>

              {/* League Selector */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Select Leagues ({selectedLeagueIds.length} selected)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto p-4 bg-background-dark rounded-lg border border-border-subtle">
                  {leagues.filter(l => l.api_id).map((league) => (
                    <label
                      key={league.id}
                      className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedLeagueIds.includes(league.id)
                          ? 'bg-electric-blue/10 border border-electric-blue/30'
                          : 'bg-surface hover:bg-surface-hover border border-border-subtle'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedLeagueIds.includes(league.id)}
                        onChange={() => handleLeagueToggle(league.id)}
                        disabled={isBulkImporting}
                        className="w-4 h-4 text-electric-blue bg-navy-accent border-gray-700 rounded focus:ring-electric-blue focus:ring-2"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{league.name}</p>
                        <p className="text-xs text-text-disabled">API ID: {league.api_id}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Import Button */}
              <button
                onClick={handleBulkImportFixtures}
                disabled={isBulkImporting || selectedLeagueIds.length === 0 || !season.trim()}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-electric-blue hover:bg-electric-blue/80 disabled:bg-surface-hover disabled:text-text-disabled text-white rounded-lg transition-colors font-medium"
              >
                <Download className="w-4 h-4" />
                <span>{isBulkImporting ? 'Importing...' : 'Import Fixtures'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-disabled" />
          <input
            type="text"
            placeholder="Search teams or league..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface border border-border-subtle rounded-lg focus:outline-none focus:border-electric-blue"
          />
        </div>

        {/* League Filter */}
        <select
          value={leagueFilter}
          onChange={(e) => setLeagueFilter(e.target.value)}
          className="px-4 py-2 bg-surface border border-border-subtle rounded-lg focus:outline-none focus:border-electric-blue"
        >
          <option value="all">All Leagues</option>
          {leagues.map((league) => (
            <option key={league.id} value={league.id}>
              {league.name}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-surface border border-border-subtle rounded-lg focus:outline-none focus:border-electric-blue"
        >
          <option value="all">All Statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border-subtle rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-secondary">Loading...</div>
        ) : filteredFixtures.length === 0 ? (
          <div className="p-8 text-center text-text-secondary">
            No fixtures found. Import some fixtures using the form above.
          </div>
        ) : (
          <div className="overflow-x-auto max-w-full">
            <table className="w-full min-w-max">
              <thead className="bg-background-dark border-b border-border-subtle">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">
                    League
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">
                    Match
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">
                    Score
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">
                    Matchday
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">
                    API ID
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredFixtures.map((fixture) => (
                  <tr
                    key={fixture.id}
                    className="hover:bg-surface-hover transition-colors"
                  >
                    <td className="px-4 py-3 text-sm">
                      {new Date(fixture.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                      <br />
                      <span className="text-text-disabled text-xs">
                        {new Date(fixture.date).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {fixture.league_name || '-'}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <div className="flex flex-col">
                        <span>{fixture.home_team_name || 'TBD'}</span>
                        <span className="text-xs text-text-disabled">vs</span>
                        <span>{fixture.away_team_name || 'TBD'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {fixture.goals_home !== null && fixture.goals_away !== null ? (
                        <span className="font-bold">
                          {fixture.goals_home} - {fixture.goals_away}
                        </span>
                      ) : (
                        <span className="text-text-disabled">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          fixture.status === 'FT' || fixture.status === 'AET' || fixture.status === 'PEN'
                            ? 'bg-lime-glow/10 text-lime-glow'
                            : fixture.status === 'LIVE' || fixture.status === '1H' || fixture.status === '2H' || fixture.status === 'HT'
                            ? 'bg-hot-red/10 text-hot-red'
                            : 'bg-electric-blue/10 text-electric-blue'
                        }`}
                      >
                        {fixture.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {(() => {
                        if (!fixture.round) return '-';
                        // Extract matchday number from strings like "Regular Season - 15"
                        const match = fixture.round.match(/(\d+)/);
                        if (match) {
                          return `MD ${match[1]}`;
                        }
                        return fixture.round;
                      })()}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-disabled">
                      {fixture.api_id || '-'}
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
