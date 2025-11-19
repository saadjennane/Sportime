import React, { useState } from 'react';

interface SyncLog {
  timestamp: string;
  function: string;
  status: 'success' | 'error' | 'loading';
  message: string;
  duration?: number;
}

export default function FantasyManualSync() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});

  const SUPABASE_URL = 'https://crypuzduplbzbmvefvzr.supabase.co';

  // Note: In production, this should come from environment variables or secure storage
  const getServiceKey = () => {
    return prompt('Enter Supabase Service Role Key (ou configurez dans .env):');
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

  const callEdgeFunction = async (functionName: string, payload: any = {}) => {
    const serviceKey = getServiceKey();
    if (!serviceKey) {
      addLog(functionName, 'error', 'Service key not provided');
      return;
    }

    setLoading((prev) => ({ ...prev, [functionName]: true }));
    const startTime = Date.now();

    try {
      addLog(functionName, 'loading', `Calling ${functionName}...`);

      const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      addLog(functionName, 'success', JSON.stringify(result, null, 2), duration);
    } catch (err: any) {
      const duration = Date.now() - startTime;
      addLog(functionName, 'error', err.message, duration);
    } finally {
      setLoading((prev) => ({ ...prev, [functionName]: false }));
    }
  };

  const handleSeedFantasyData = () => {
    const league = prompt('Enter league API ID (140 for La Liga):', '140');
    const season = prompt('Enter season (2024):', '2024');

    if (!league || !season) return;

    callEdgeFunction('seed-fantasy-data', {
      leagues: [
        {
          api_id: parseInt(league),
          name: 'La Liga',
          country: 'Spain',
          priority: true,
        },
      ],
      season: parseInt(season),
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

  const handleSyncFantasyPlayers = () => {
    const season = prompt('Enter season (2024):', '2024');
    callEdgeFunction('sync-fantasy-players', { season: season ? parseInt(season) : 2024 });
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

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Seed Fantasy Data */}
        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-lg">Seed Fantasy Data</h3>
              <p className="text-xs text-gray-400 mt-1">
                Importe équipes, joueurs et stats depuis API-Sports
              </p>
            </div>
            <span className="text-2xl">📦</span>
          </div>
          <button
            onClick={handleSeedFantasyData}
            disabled={loading['seed-fantasy-data']}
            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading['seed-fantasy-data'] ? 'En cours...' : 'Lancer Seed'}
          </button>
          <div className="mt-2 text-xs text-gray-500">
            Durée: ~30-60 min • API Calls: ~640
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

        {/* Sync Fantasy Players */}
        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-lg">Sync Fantasy Players</h3>
              <p className="text-xs text-gray-400 mt-1">
                Met à jour PGS et statuts des joueurs Fantasy
              </p>
            </div>
            <span className="text-2xl">👥</span>
          </div>
          <button
            onClick={handleSyncFantasyPlayers}
            disabled={loading['sync-fantasy-players']}
            className="w-full px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading['sync-fantasy-players'] ? 'En cours...' : 'Sync Players'}
          </button>
          <div className="mt-2 text-xs text-gray-500">
            Durée: ~10-20 min selon nombre de joueurs
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
          <li>• <strong>Seed Fantasy Data</strong>: Première étape - importe toutes les données de base (équipes, joueurs, stats)</li>
          <li>• <strong>Sync Match Stats</strong>: À exécuter après chaque journée de matchs pour obtenir les stats réelles</li>
          <li>• <strong>Process Game Week</strong>: À exécuter quand une game week est terminée pour calculer les points</li>
          <li>• <strong>Update Status</strong>: Automatique via cron, mais peut être déclenché manuellement</li>
          <li>• <strong>Sync Fantasy Players</strong>: Met à jour les PGS hebdomadairement/mensuellement</li>
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
