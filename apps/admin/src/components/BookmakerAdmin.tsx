import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

interface Bookmaker {
  bookmaker_name: string;
  odds_count: number;
  last_update: string;
}

export default function BookmakerAdmin() {
  const [bookmakers, setBookmakers] = useState<Bookmaker[]>([]);
  const [preferredBookmaker, setPreferredBookmaker] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadBookmakers();
    loadPreferredBookmaker();
  }, []);

  const loadBookmakers = async () => {
    try {
      const { data, error } = await supabase.rpc('get_available_bookmakers');

      if (error) throw error;

      setBookmakers(data || []);
    } catch (error) {
      console.error('Error loading bookmakers:', error);
      setMessage({ type: 'error', text: 'Erreur lors du chargement des bookmakers' });
    }
  };

  const loadPreferredBookmaker = async () => {
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'preferred_bookmaker')
        .single();

      if (error) throw error;

      setPreferredBookmaker(data?.value || '');
      setLoading(false);
    } catch (error) {
      console.error('Error loading preferred bookmaker:', error);
      setLoading(false);
    }
  };

  const setPreferred = async (bookmakerName: string) => {
    try {
      setLoading(true);

      const { error } = await supabase.rpc('set_preferred_bookmaker', {
        p_bookmaker_name: bookmakerName
      });

      if (error) throw error;

      setPreferredBookmaker(bookmakerName);
      setMessage({ type: 'success', text: `Bookmaker changé en: ${bookmakerName}` });

      // Auto-sync après changement
      await syncBookmakerOdds();
    } catch (error: any) {
      console.error('Error setting preferred bookmaker:', error);
      setMessage({ type: 'error', text: error.message || 'Erreur lors du changement' });
    } finally {
      setLoading(false);
    }
  };

  const syncBookmakerOdds = async () => {
    try {
      setSyncing(true);

      const { data, error } = await supabase.rpc('sync_preferred_bookmaker_odds');

      if (error) throw error;

      const count = data?.[0]?.synced_count || 0;
      setMessage({ type: 'success', text: `${count} cotes synchronisées pour ${preferredBookmaker}` });
    } catch (error: any) {
      console.error('Error syncing bookmaker odds:', error);
      setMessage({ type: 'error', text: error.message || 'Erreur lors de la synchronisation' });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-400">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Configuration des Bookmakers</h2>
        <p className="text-gray-400">
          Gérer le bookmaker utilisé pour afficher les cotes aux utilisateurs
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Bookmaker Actuel</h3>
          <button
            onClick={syncBookmakerOdds}
            disabled={syncing || !preferredBookmaker}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing ? 'Synchronisation...' : 'Synchroniser les Cotes'}
          </button>
        </div>

        {preferredBookmaker && (
          <div className="bg-gray-900 rounded-lg p-4 mb-4">
            <div className="text-sm text-gray-400 mb-1">Bookmaker préféré</div>
            <div className="text-xl font-bold text-white">{preferredBookmaker}</div>
          </div>
        )}

        <h4 className="text-md font-semibold text-white mb-3">Bookmakers Disponibles</h4>

        {bookmakers.length === 0 ? (
          <div className="text-gray-400 text-center py-8">
            Aucun bookmaker trouvé. Synchronisez d'abord des odds depuis l'API.
          </div>
        ) : (
          <div className="space-y-2">
            {bookmakers.map((bookmaker) => (
              <div
                key={bookmaker.bookmaker_name}
                className={`flex items-center justify-between p-4 rounded-lg border-2 transition-colors ${
                  preferredBookmaker === bookmaker.bookmaker_name
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 bg-gray-900 hover:border-gray-600'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="text-lg font-semibold text-white">
                      {bookmaker.bookmaker_name}
                    </div>
                    {preferredBookmaker === bookmaker.bookmaker_name && (
                      <span className="px-2 py-1 text-xs bg-blue-500 text-white rounded">
                        Actif
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    {bookmaker.odds_count} cotes • Dernière maj: {new Date(bookmaker.last_update).toLocaleString('fr-FR')}
                  </div>
                </div>

                {preferredBookmaker !== bookmaker.bookmaker_name && (
                  <button
                    onClick={() => setPreferred(bookmaker.bookmaker_name)}
                    disabled={loading}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50"
                  >
                    Sélectionner
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-3">Informations</h3>
        <ul className="space-y-2 text-sm text-gray-400">
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-1">•</span>
            <span>Seules les cotes du bookmaker sélectionné seront affichées aux utilisateurs</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-1">•</span>
            <span>Le changement de bookmaker synchronise automatiquement toutes les cotes</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-1">•</span>
            <span>Les cotes se mettent à jour automatiquement via le trigger lors des nouvelles synchronisations</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
