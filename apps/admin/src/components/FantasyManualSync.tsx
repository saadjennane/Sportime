import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

interface SyncLog {
  timestamp: string;
  function: string;
  status: 'success' | 'error' | 'loading';
  message: string;
  duration?: number;
}

interface League {
  id: string;
  name: string;
  country_or_region: string;
}

export default function FantasyManualSync() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('');

  useEffect(() => {
    fetchLeagues();
  }, []);

  const fetchLeagues = async () => {
    if (!supabase) {
      console.error('Supabase client is not initialized. Check environment variables in apps/admin/.env');
      addLog('fetchLeagues', 'error', 'Supabase client not initialized. Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('leagues')
        .select('id, name, country_or_region')
        .order('name');

      if (error) throw error;
      setLeagues(data || []);

      // Auto-select first league
      if (data && data.length > 0 && !selectedLeagueId) {
        setSelectedLeagueId(data[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching leagues:', err);
    }
  };

  const addLog = (functionName: string, status: SyncLog['status'], message: string, duration?: number) => {
    const log: SyncLog = {
      timestamp: new Date().toISOString(),
      function: functionName,
      status,
      message,
      duration,
    };
    setLogs((prev) => [log, ...prev]);
  };

  // Invoke the edge function through the Supabase client: it sends the public
  // anon key (and the signed-in admin's JWT) as auth. The function uses its own
  // service-role key SERVER-SIDE — the privileged key never touches the client.
  const callEdgeFunction = async (functionName: string, payload: any = {}) => {
    if (!supabase) {
      addLog(functionName, 'error', 'Supabase client not initialized');
      return;
    }

    setLoading((prev) => ({ ...prev, [functionName]: true }));
    const startTime = Date.now();

    try {
      addLog(functionName, 'loading', `Calling ${functionName}...`);

      const { data, error } = await supabase.functions.invoke(functionName, { body: payload });

      const duration = Date.now() - startTime;

      if (error) throw error;

      addLog(functionName, 'success', JSON.stringify(data, null, 2), duration);
    } catch (err: any) {
      const duration = Date.now() - startTime;
      addLog(functionName, 'error', err?.message ?? String(err), duration);
    } finally {
      setLoading((prev) => ({ ...prev, [functionName]: false }));
    }
  };

  const handleSyncLeaguePlayers = () => {
    if (!selectedLeagueId) {
      addLog('sync-league-fantasy-players', 'error', 'Veuillez sélectionner une ligue');
      return;
    }

    const minAppearances = prompt('Nombre minimum d\'apparitions (défaut: 5):', '5');

    callEdgeFunction('sync-league-fantasy-players', {
      league_id: selectedLeagueId,
      min_appearances: minAppearances ? parseInt(minAppearances) : 5,
    });
  };

  const handleImportMatchStats = () => {
    if (!selectedLeagueId) {
      addLog('sync-player-match-stats', 'error', 'Veuillez sélectionner une ligue');
      return;
    }

    const season = prompt('Saison (défaut: 2025):', '2025');
    const batchSize = prompt('Taille du batch (défaut: 50):', '50');

    callEdgeFunction('sync-player-match-stats', {
      league_id: selectedLeagueId,
      season: season ? parseInt(season) : 2025,
      batch_size: batchSize ? parseInt(batchSize) : 50,
    });
  };

  const handleSyncMatchStats = () => {
    const gameWeekId = prompt('Enter Game Week ID (ou laissez vide pour toutes les game weeks actives):');

    if (gameWeekId) {
      callEdgeFunction('sync-match-stats', { game_week_id: gameWeekId });
    } else {
      callEdgeFunction('sync-all-active-gameweeks');
    }
  };

  const handleProcessGameWeek = () => {
    const gameWeekId = prompt('Enter Game Week ID (ou laissez vide pour toutes les finished):');

    if (gameWeekId) {
      callEdgeFunction('process-fantasy-gameweek', { game_week_id: gameWeekId });
    } else {
      callEdgeFunction('process-all-finished-gameweeks');
    }
  };

  const handleUpdateStatus = () => {
    callEdgeFunction('update-gameweek-status');
  };

  const getStatusColor = (status: SyncLog['status']) => {
    switch (status) {
      case 'success': return 'text-green-400 bg-green-500/20';
      case 'error': return 'text-red-400 bg-red-500/20';
      case 'loading': return 'text-blue-400 bg-blue-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getStatusIcon = (status: SyncLog['status']) => {
    switch (status) {
      case 'success': return '✓';
      case 'error': return '✗';
      case 'loading': return '⟳';
      default: return '•';
    }
  };

  return (
    <div className="p-6 bg-gray-900 text-white rounded-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Fantasy Manual Sync & Processing</h2>
        <p className="text-sm text-gray-400">
          Déclenchez manuellement les edge functions pour la synchronisation et le traitement des données Fantasy.
        </p>
      </div>

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
              {league.name} ({league.country_or_region})
            </option>
          ))}
        </select>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Import All Match Stats */}
        <div className="p-4 bg-gray-800 rounded-lg border border-yellow-600">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-lg">Import All Match Stats</h3>
              <p className="text-xs text-gray-400 mt-1">
                Importe les stats de TOUS les matchs terminés depuis API-Football
              </p>
            </div>
            <span className="text-2xl">⚡</span>
          </div>
          <button
            onClick={handleImportMatchStats}
            disabled={!selectedLeagueId || loading['sync-player-match-stats']}
            className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading['sync-player-match-stats'] ? 'En cours...' : 'Import Match Stats'}
          </button>
          <div className="mt-2 text-xs text-gray-500">
            Durée: ~2-3h pour 400 matchs. Agrège automatiquement vers player_season_stats avec PGS.
          </div>
        </div>

        {/* Sync League Players */}
        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-lg">Sync League Players</h3>
              <p className="text-xs text-gray-400 mt-1">
                Synchronise les joueurs de la ligue sélectionnée vers fantasy_league_players
              </p>
            </div>
            <span className="text-2xl">👥</span>
          </div>
          <button
            onClick={handleSyncLeaguePlayers}
            disabled={!selectedLeagueId || loading['sync-league-fantasy-players']}
            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading['sync-league-fantasy-players'] ? 'En cours...' : 'Sync Players'}
          </button>
          <div className="mt-2 text-xs text-gray-500">
            Calcule PGS depuis player_season_stats
          </div>
        </div>

        {/* Sync Match Stats */}
        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-lg">Sync Match Stats</h3>
              <p className="text-xs text-gray-400 mt-1">
                Synchronise les stats de matchs depuis API-Sports
              </p>
            </div>
            <span className="text-2xl">📊</span>
          </div>
          <button
            onClick={handleSyncMatchStats}
            disabled={loading['sync-match-stats'] || loading['sync-all-active-gameweeks']}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading['sync-match-stats'] || loading['sync-all-active-gameweeks'] ? 'En cours...' : 'Sync Stats'}
          </button>
          <div className="mt-2 text-xs text-gray-500">
            Durée: ~5-30 min selon game weeks
          </div>
        </div>

        {/* Process Game Week */}
        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-lg">Process Game Week</h3>
              <p className="text-xs text-gray-400 mt-1">
                Calcule les points Fantasy et met à jour le leaderboard
              </p>
            </div>
            <span className="text-2xl">🎯</span>
          </div>
          <button
            onClick={handleProcessGameWeek}
            disabled={loading['process-fantasy-gameweek'] || loading['process-all-finished-gameweeks']}
            className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading['process-fantasy-gameweek'] || loading['process-all-finished-gameweeks'] ? 'En cours...' : 'Calculer Points'}
          </button>
          <div className="mt-2 text-xs text-gray-500">
            Durée: ~2-10 min selon teams
          </div>
        </div>

        {/* Update Game Week Status */}
        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-lg">Update Status</h3>
              <p className="text-xs text-gray-400 mt-1">
                Met à jour les statuts des game weeks (upcoming→live→finished)
              </p>
            </div>
            <span className="text-2xl">🔄</span>
          </div>
          <button
            onClick={handleUpdateStatus}
            disabled={loading['update-gameweek-status']}
            className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading['update-gameweek-status'] ? 'En cours...' : 'Update Status'}
          </button>
          <div className="mt-2 text-xs text-gray-500">
            Durée: ~5-10 sec
          </div>
        </div>

        {/* Clear Logs */}
        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-lg">Logs</h3>
              <p className="text-xs text-gray-400 mt-1">
                {logs.length} entrées dans le journal
              </p>
            </div>
            <span className="text-2xl">📝</span>
          </div>
          <button
            onClick={() => setLogs([])}
            className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition"
          >
            Effacer les Logs
          </button>
        </div>
      </div>

      {/* Information Panel */}
      <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <h3 className="font-semibold text-blue-400 mb-2">ℹ️ Information</h3>
        <ul className="text-sm text-gray-300 space-y-1">
          <li>• <strong>Import All Match Stats</strong>: (NOUVEAU) Importe toutes les stats des matchs terminés depuis API-Football vers player_match_stats, puis agrège automatiquement vers player_season_stats avec calcul automatique du PGS et statut (Star/Key/Wild). À exécuter UNE FOIS pour initialiser les données.</li>
          <li>• <strong>Sync League Players</strong>: Synchronise les joueurs d'une ligue depuis player_season_stats vers fantasy_league_players (calcule PGS et statut)</li>
          <li>• <strong>Sync Match Stats</strong>: À exécuter après chaque journée de matchs pour obtenir les stats réelles</li>
          <li>• <strong>Process Game Week</strong>: À exécuter quand une game week est terminée pour calculer les points</li>
          <li>• <strong>Update Status</strong>: Automatique via cron, mais peut être déclenché manuellement</li>
        </ul>
      </div>

      {/* Logs */}
      <div>
        <h3 className="text-xl font-semibold mb-4">Logs d'Exécution</h3>
        {logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-gray-800 rounded-lg">
            Aucun log. Lancez une synchronisation pour voir les résultats ici.
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.map((log, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${
                  log.status === 'success'
                    ? 'bg-green-500/10 border-green-500/30'
                    : log.status === 'error'
                    ? 'bg-red-500/10 border-red-500/30'
                    : 'bg-blue-500/10 border-blue-500/30'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-lg ${getStatusColor(log.status)}`}>
                      {getStatusIcon(log.status)}
                    </span>
                    <span className="font-semibold">{log.function}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(log.timestamp).toLocaleTimeString('fr-FR')}
                    </span>
                  </div>
                  {log.duration && (
                    <span className="text-xs text-gray-500">
                      {(log.duration / 1000).toFixed(2)}s
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-300 whitespace-pre-wrap font-mono bg-gray-900 p-2 rounded overflow-x-auto">
                  {log.message}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
