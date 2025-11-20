import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';

type TournamentType = 'amateur' | 'master' | 'apex';
type DurationType = 'flash' | 'series' | 'season';

// Entry cost configuration matching Challenge/Betting games
const TOURNAMENT_COSTS: Record<TournamentType, { base: number; multipliers: Record<DurationType, number> }> = {
  amateur: {
    base: 2000,
    multipliers: { flash: 1, series: 2, season: 4 },
  },
  master: {
    base: 10000,
    multipliers: { flash: 1, series: 2, season: 4 },
  },
  apex: {
    base: 20000,
    multipliers: { flash: 1, series: 2, season: 4 },
  },
};

interface FantasyGame {
  id: string;
  name: string;
  status: 'Draft' | 'Ongoing' | 'Completed';
  start_date: string;
  end_date: string;
  entry_cost: number;
  is_linkable: boolean;
  league_id: string | null;
  tier: TournamentType;
  duration_type: DurationType;
  custom_entry_cost_enabled: boolean;
  requires_subscription: boolean;
  minimum_level: string;
  required_badges: string[];
  min_players: number;
  max_players: number;
  created_at: string;
}

interface League {
  id: string;
  name: string;
  country_or_region: string;
  logo?: string;
}

interface Level {
  id: string;
  name: string;
  xp_required: number;
}

interface Badge {
  id: string;
  name: string;
  description: string;
}

export default function FantasyGameAdmin() {
  const [games, setGames] = useState<FantasyGame[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    status: 'Draft' as 'Draft' | 'Ongoing' | 'Completed',
    start_date: '',
    end_date: '',
    entry_cost: 2000,
    is_linkable: true,
    league_id: '',
    tier: 'amateur' as TournamentType,
    duration_type: 'flash' as DurationType,
    custom_entry_cost_enabled: false,
    requires_subscription: false,
    minimum_level: 'Rookie',
    required_badges: [] as string[],
    min_players: 2,
    max_players: 100,
  });

  // Auto-calculate entry cost based on tier and duration
  const calculatedCost = useMemo(() => {
    if (!formData.tier || !formData.duration_type) return 2000;
    return TOURNAMENT_COSTS[formData.tier].base * TOURNAMENT_COSTS[formData.tier].multipliers[formData.duration_type];
  }, [formData.tier, formData.duration_type]);

  // Update entry cost when tier/duration changes (if not using custom cost)
  useEffect(() => {
    if (!formData.custom_entry_cost_enabled) {
      setFormData((prev) => ({ ...prev, entry_cost: calculatedCost }));
    }
  }, [calculatedCost, formData.custom_entry_cost_enabled]);

  useEffect(() => {
    fetchGames();
    fetchLeagues();
    fetchLevels();
    fetchBadges();
  }, []);

  const fetchLeagues = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('leagues')
        .select('id, name, country_or_region, logo')
        .order('name');

      if (fetchError) throw fetchError;
      setLeagues(data || []);
    } catch (err: any) {
      console.error('Error fetching leagues:', err);
    }
  };

  const fetchLevels = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('user_levels')
        .select('id, name, xp_required')
        .order('xp_required');

      if (fetchError) throw fetchError;
      setLevels(data || []);
    } catch (err: any) {
      console.error('Error fetching levels:', err);
    }
  };

  const fetchBadges = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('badges')
        .select('id, name, description')
        .order('name');

      if (fetchError) throw fetchError;
      setBadges(data || []);
    } catch (err: any) {
      console.error('Error fetching badges:', err);
    }
  };

  const fetchGames = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('fantasy_games')
        .select(`
          *,
          league_id (
            name,
            country_or_region
          )
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setGames(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: insertError } = await supabase
        .from('fantasy_games')
        .insert([formData]);

      if (insertError) throw insertError;

      setSuccess('Fantasy Game créé avec succès!');
      setShowCreateForm(false);
      setFormData({
        name: '',
        status: 'Draft',
        start_date: '',
        end_date: '',
        entry_cost: 2000,
        is_linkable: true,
        league_id: '',
        tier: 'amateur',
        duration_type: 'flash',
        custom_entry_cost_enabled: false,
        requires_subscription: false,
        minimum_level: 'Rookie',
        required_badges: [],
        min_players: 2,
        max_players: 100,
      });
      fetchGames();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (gameId: string, newStatus: 'Draft' | 'Ongoing' | 'Completed') => {
    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('fantasy_games')
        .update({ status: newStatus })
        .eq('id', gameId);

      if (updateError) throw updateError;

      setSuccess(`Statut mis à jour: ${newStatus}`);
      fetchGames();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce jeu Fantasy? Cette action est irréversible.')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('fantasy_games')
        .delete()
        .eq('id', gameId);

      if (deleteError) throw deleteError;

      setSuccess('Jeu Fantasy supprimé avec succès');
      fetchGames();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBadgeToggle = (badgeId: string) => {
    setFormData((prev) => ({
      ...prev,
      required_badges: prev.required_badges.includes(badgeId)
        ? prev.required_badges.filter((id) => id !== badgeId)
        : [...prev.required_badges, badgeId],
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft': return 'bg-gray-500';
      case 'Ongoing': return 'bg-green-500';
      case 'Completed': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getTierLabel = (tier: TournamentType) => {
    switch (tier) {
      case 'amateur': return 'Amateur';
      case 'master': return 'Master';
      case 'apex': return 'Apex';
      default: return tier;
    }
  };

  const getDurationLabel = (duration: DurationType) => {
    switch (duration) {
      case 'flash': return 'Flash';
      case 'series': return 'Series';
      case 'season': return 'Season';
      default: return duration;
    }
  };

  const getTierColor = (tier: TournamentType) => {
    switch (tier) {
      case 'amateur': return 'bg-gray-600';
      case 'master': return 'bg-purple-600';
      case 'apex': return 'bg-orange-600';
      default: return 'bg-gray-600';
    }
  };

  return (
    <div className="p-6 bg-gray-900 text-white rounded-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Fantasy Games Admin</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
        >
          {showCreateForm ? 'Annuler' : '+ Nouveau Jeu'}
        </button>
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

      {showCreateForm && (
        <form onSubmit={handleCreateGame} className="mb-6 p-4 bg-gray-800 rounded-lg">
          <h3 className="text-xl font-semibold mb-4">Créer un Nouveau Jeu Fantasy</h3>

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">Nom du Jeu</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="La Liga Fantasy - Saison 2024/25"
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Ligue <span className="text-red-500">*</span></label>
              <select
                value={formData.league_id}
                onChange={(e) => setFormData({ ...formData, league_id: e.target.value })}
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Sélectionner une ligue --</option>
                {leagues.map((league) => (
                  <option key={league.id} value={league.id}>
                    {league.name} ({league.country_or_region})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Statut</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="Draft">Draft</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_linkable"
                checked={formData.is_linkable}
                onChange={(e) => setFormData({ ...formData, is_linkable: e.target.checked })}
                className="mr-2 accent-blue-500"
              />
              <label htmlFor="is_linkable" className="text-sm font-medium">
                Linkable (permet création d'équipes)
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Date de Début</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Date de Fin</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Tier and Duration */}
          <div className="mb-6 p-4 bg-gray-750 rounded-lg border border-gray-700">
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Configuration du Jeu</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">Tier</label>
                <select
                  value={formData.tier}
                  onChange={(e) => setFormData({ ...formData, tier: e.target.value as TournamentType })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="amateur">Amateur (2,000 base)</option>
                  <option value="master">Master (10,000 base)</option>
                  <option value="apex">Apex (20,000 base)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Durée</label>
                <select
                  value={formData.duration_type}
                  onChange={(e) => setFormData({ ...formData, duration_type: e.target.value as DurationType })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="flash">Flash (1x multiplier)</option>
                  <option value="series">Series (2x multiplier)</option>
                  <option value="season">Season (4x multiplier)</option>
                </select>
              </div>
            </div>

            {/* Entry Cost with Override */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Coût d'Entrée (Coins)</label>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <input
                    type="number"
                    value={formData.entry_cost}
                    onChange={(e) => setFormData({ ...formData, entry_cost: parseInt(e.target.value) || 0 })}
                    disabled={!formData.custom_entry_cost_enabled}
                    min="0"
                    step="100"
                    required
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {!formData.custom_entry_cost_enabled && (
                    <p className="text-xs text-gray-400 mt-1">
                      Auto: {getTierLabel(formData.tier)} × {getDurationLabel(formData.duration_type)} = {calculatedCost.toLocaleString()} coins
                    </p>
                  )}
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.custom_entry_cost_enabled}
                    onChange={(e) => setFormData({ ...formData, custom_entry_cost_enabled: e.target.checked })}
                    className="accent-blue-500"
                  />
                  Override
                </label>
              </div>
            </div>
          </div>

          {/* Access Conditions */}
          <div className="mb-6 p-4 bg-gray-750 rounded-lg border border-gray-700">
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Conditions d'Accès</h4>

            {/* Subscriber Only */}
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={formData.requires_subscription}
                onChange={(e) => setFormData({ ...formData, requires_subscription: e.target.checked })}
                className="accent-blue-500"
              />
              Réservé aux abonnés
            </label>

            {/* Minimum Level */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Niveau Minimum</label>
              <select
                value={formData.minimum_level}
                onChange={(e) => setFormData({ ...formData, minimum_level: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              >
                {levels.map((level) => (
                  <option key={level.id} value={level.name}>
                    {level.name} ({level.xp_required} XP)
                  </option>
                ))}
              </select>
            </div>

            {/* Required Badges */}
            <div>
              <label className="block text-sm font-medium mb-2">Badges Requis</label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {badges.map((badge) => (
                  <label key={badge.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-700 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={formData.required_badges.includes(badge.id)}
                      onChange={() => handleBadgeToggle(badge.id)}
                      className="accent-blue-500"
                    />
                    <div>
                      <div className="font-medium">{badge.name}</div>
                      <div className="text-xs text-gray-500">{badge.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Player Limits */}
          <div className="mb-6 p-4 bg-gray-750 rounded-lg border border-gray-700">
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Limites de Joueurs</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Minimum de Joueurs</label>
                <input
                  type="number"
                  value={formData.min_players}
                  onChange={(e) => setFormData({ ...formData, min_players: parseInt(e.target.value) || 2 })}
                  min="2"
                  required
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Maximum de Joueurs</label>
                <input
                  type="number"
                  value={formData.max_players}
                  onChange={(e) => setFormData({ ...formData, max_players: parseInt(e.target.value) || 100 })}
                  min={formData.min_players}
                  required
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Création...' : 'Créer le Jeu'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-6 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {loading && games.length === 0 ? (
          <div className="text-center py-8 text-gray-400">Chargement...</div>
        ) : games.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            Aucun jeu Fantasy. Créez-en un pour commencer!
          </div>
        ) : (
          games.map((game) => (
            <div key={game.id} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="text-xl font-semibold">{game.name}</h3>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(game.status)}`}>
                      {game.status}
                    </span>
                    {game.tier && (
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getTierColor(game.tier)}`}>
                        {getTierLabel(game.tier)}
                      </span>
                    )}
                    {game.duration_type && (
                      <span className="px-2 py-1 text-xs bg-blue-600 rounded-full">
                        {getDurationLabel(game.duration_type)}
                      </span>
                    )}
                    {game.is_linkable && (
                      <span className="px-2 py-1 text-xs bg-purple-600 rounded-full">Linkable</span>
                    )}
                    {game.requires_subscription && (
                      <span className="px-2 py-1 text-xs bg-yellow-600 rounded-full">Subscriber Only</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm text-gray-300">
                    <div>
                      <span className="text-gray-500">Ligue:</span>
                      <p className="font-medium">{(game as any).league_id?.name || 'Non définie'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Début:</span>
                      <p className="font-medium">{new Date(game.start_date).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Fin:</span>
                      <p className="font-medium">{new Date(game.end_date).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Coût:</span>
                      <p className="font-medium">{game.entry_cost} coins</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Joueurs:</span>
                      <p className="font-medium">{game.min_players || 2} - {game.max_players || 100}</p>
                    </div>
                  </div>

                  {game.minimum_level && (
                    <div className="mt-2 text-xs text-gray-500">
                      Niveau minimum: {game.minimum_level}
                    </div>
                  )}

                  <div className="mt-2 text-xs text-gray-500">
                    ID: {game.id}
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <select
                    value={game.status}
                    onChange={(e) => handleUpdateStatus(game.id, e.target.value as any)}
                    className="px-3 py-1 text-sm bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="Completed">Completed</option>
                  </select>

                  <button
                    onClick={() => handleDeleteGame(game.id)}
                    className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 rounded-lg transition"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
