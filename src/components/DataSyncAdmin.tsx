import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchFromFootball } from '../lib/apiFootballService';
import { ApiLeagueInfo, ApiTeamInfo, ApiPlayerInfo, ApiFixtureInfo, ApiOddsInfo, ApiSyncConfig } from '../types';
import { DatabaseZap, DownloadCloud, Play, RefreshCw, Server, Settings } from 'lucide-react';
import { USE_SUPABASE } from '../config/env';

interface DataSyncAdminProps {
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const FREQUENCIES = ['Manual', 'Every hour', 'Every 3 hours', 'Every 6 hours', 'Every 12 hours', 'Daily'];
const SYNC_ENDPOINTS = ['fixtures', 'odds'];

export const DataSyncAdmin: React.FC<DataSyncAdminProps> = ({ addToast }) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [progress, setProgress] = useState<string[]>([]);
  const [leagueIds, setLeagueIds] = useState('39, 140, 135'); // Premier League, La Liga, Serie A
  const [season, setSeason] = useState('2023');
  const [syncConfigs, setSyncConfigs] = useState<ApiSyncConfig[]>([]);

  const fetchSyncConfigs = useCallback(async () => {
    if (!USE_SUPABASE) return;
    const { data, error } = await supabase.from('api_sync_config').select('*');
    if (error) {
      addToast('Failed to load sync configurations', 'error');
    } else {
      setSyncConfigs(data);
    }
  }, [addToast]);

  useEffect(() => {
    fetchSyncConfigs();
  }, [fetchSyncConfigs]);

  const addProgress = (message: string) => {
    setProgress(prev => [message, ...prev]);
  };

  const handleFrequencyChange = async (endpoint: string, frequency: string) => {
    if (!USE_SUPABASE) {
        addToast('Admin actions are disabled in mock mode.', 'info');
        return;
    }
    const { error } = await supabase.from('api_sync_config').upsert({ id: endpoint, frequency }, { onConflict: 'id' });
    if (error) {
      addToast(`Failed to update frequency for ${endpoint}`, 'error');
    } else {
      addToast(`Frequency for ${endpoint} updated to ${frequency}`, 'success');
      fetchSyncConfigs();
    }
  };

  const handleFullImport = async () => {
    if (!USE_SUPABASE) {
        addToast('Admin actions are disabled in mock mode.', 'info');
        return;
    }
    setLoading('import');
    setProgress([]);
    addProgress('Starting full import...');
    // ... (existing import logic)
    setLoading(null);
  };
  
  const handleManualSync = async (endpoint: string) => {
    if (!USE_SUPABASE) {
        addToast('Admin actions are disabled in mock mode.', 'info');
        return;
    }
    setLoading(endpoint);
    setProgress([]);
    addProgress(`Starting manual sync for ${endpoint}...`);
    // ... (existing sync logic)
    setLoading(null);
  };

  return (
    <div className="space-y-6">
      {/* Initial Import Section */}
      <div className="bg-white rounded-2xl shadow-lg p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-purple-100 p-2 rounded-full"><DownloadCloud className="w-6 h-6 text-purple-600" /></div>
          <h3 className="font-bold text-lg text-gray-800">Initial Data Import</h3>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">League IDs (comma-separated)</label>
          <input
            type="text"
            value={leagueIds}
            onChange={(e) => setLeagueIds(e.target.value)}
            className="w-full p-2 border-2 border-gray-200 rounded-xl"
            placeholder="e.g., 39, 140, 135"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Season (Year)</label>
          <input
            type="text"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="w-full p-2 border-2 border-gray-200 rounded-xl"
            placeholder="e.g., 2023"
          />
        </div>
        <button
          onClick={handleFullImport}
          disabled={!!loading || !USE_SUPABASE}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold shadow-lg disabled:opacity-50"
        >
          {loading === 'import' ? <RefreshCw className="animate-spin" /> : <Play />}
          Sync Leagues, Teams & Players
        </button>
      </div>

      {/* Ongoing Sync Section */}
      <div className="bg-white rounded-2xl shadow-lg p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-full"><Settings className="w-6 h-6 text-blue-600" /></div>
          <h3 className="font-bold text-lg text-gray-800">Ongoing Synchronization</h3>
        </div>
        <div className="space-y-3">
          {SYNC_ENDPOINTS.map(endpoint => {
            const config = syncConfigs.find(c => c.id === endpoint);
            return (
              <div key={endpoint} className="bg-gray-50 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <span className="font-semibold capitalize">{endpoint}</span>
                <div className="flex items-center gap-2">
                  <select
                    value={config?.frequency || 'Manual'}
                    onChange={(e) => handleFrequencyChange(endpoint, e.target.value)}
                    className="p-2 border-2 border-gray-200 rounded-lg text-sm"
                    disabled={!USE_SUPABASE}
                  >
                    {FREQUENCIES.map(freq => <option key={freq} value={freq}>{freq}</option>)}
                  </select>
                  <button
                    onClick={() => handleManualSync(endpoint)}
                    disabled={!!loading || !USE_SUPABASE}
                    className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                    title={`Sync ${endpoint} now`}
                  >
                    {loading === endpoint ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
         <p className="text-xs text-gray-500 text-center pt-2">Note: Automatic syncing requires a backend scheduler (e.g., Supabase Edge Functions on a cron schedule) to trigger these functions based on the saved frequency.</p>
      </div>

      {/* Progress Log */}
      {(loading) && (
        <div className="bg-gray-800 text-white rounded-2xl shadow-lg p-5 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-lg">
            <Server />
            <span>Sync Log</span>
          </div>
          <div className="h-48 overflow-y-auto bg-black/30 p-3 rounded-lg font-mono text-xs space-y-1">
            {progress.map((msg, i) => <p key={i} className="animate-scale-in">{`> ${msg}`}</p>)}
          </div>
        </div>
      )}
    </div>
  );
};
