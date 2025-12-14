import { useState, useEffect } from 'react';
import {
  RefreshCw,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Edit2,
  Gamepad2,
  Trophy,
  Users,
  Coins,
  Gift,
  Tags,
  Check,
  X
} from 'lucide-react';
import {
  liveGameConfigService,
  LevelConfig,
  FreeRewardConfig,
  RewardTier,
} from '../services/liveGameConfigService';
import { supabase } from '../lib/supabaseClient';

interface MarketCategory {
  id: string;
  market_id: number;
  category: string;
  market_name: string;
  description: string | null;
  is_active: boolean;
}

const CATEGORY_OPTIONS = [
  'result', 'goals', 'scorers', 'cards', 'corners',
  'quick', 'clean_sheet', 'extra_time', 'penalties', 'other'
];

const CATEGORY_COLORS: Record<string, string> = {
  result: 'bg-blue-500/20 text-blue-400',
  goals: 'bg-lime-500/20 text-lime-400',
  scorers: 'bg-yellow-500/20 text-yellow-400',
  cards: 'bg-orange-500/20 text-orange-400',
  corners: 'bg-purple-500/20 text-purple-400',
  quick: 'bg-red-500/20 text-red-400',
  clean_sheet: 'bg-teal-500/20 text-teal-400',
  extra_time: 'bg-cyan-500/20 text-cyan-400',
  penalties: 'bg-pink-500/20 text-pink-400',
  other: 'bg-gray-500/20 text-gray-400',
};

const LEVEL_LABELS: Record<string, string> = {
  rookie: 'Rookie',
  rising_star: 'Rising Star',
  pro: 'Pro',
  elite: 'Elite',
  legend: 'Legend',
  master: 'Master',
  goat: 'GOAT',
};

const REWARD_TYPE_LABELS: Record<string, string> = {
  coins: 'Coins',
  xp: 'XP',
  ticket: 'Ticket',
  spin: 'Spin',
};

export function LiveGameConfigPage() {
  // State
  const [levelConfigs, setLevelConfigs] = useState<LevelConfig[]>([]);
  const [rewardConfigs, setRewardConfigs] = useState<FreeRewardConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'levels' | 'rewards' | 'categories'>('levels');
  const [editingLevel, setEditingLevel] = useState<string | null>(null);
  const [editingReward, setEditingReward] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // New reward form
  const [showNewRewardForm, setShowNewRewardForm] = useState(false);
  const [newReward, setNewReward] = useState({ minPlayers: 0, maxPlayers: 0, topX: 3 });

  // New tier form
  const [addingTierTo, setAddingTierTo] = useState<string | null>(null);
  const [newTier, setNewTier] = useState<Omit<RewardTier, 'id' | 'freeRewardId'>>({
    rank: 1,
    rewardType: 'coins',
    rewardAmount: 100,
    rewardTier: null,
  });

  // Market categories state
  const [marketCategories, setMarketCategories] = useState<MarketCategory[]>([]);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showNewCategoryForm, setShowNewCategoryForm] = useState(false);
  const [newCategory, setNewCategory] = useState({ market_id: 0, category: 'other', market_name: '', description: '' });

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [levels, rewards] = await Promise.all([
        liveGameConfigService.getLevelConfigs(),
        liveGameConfigService.getFreeRewardConfigs(),
      ]);
      setLevelConfigs(levels);
      setRewardConfigs(rewards);

      // Load market categories
      if (supabase) {
        const { data: categories } = await supabase
          .from('market_categories')
          .select('*')
          .order('category', { ascending: true })
          .order('market_id', { ascending: true });
        if (categories) {
          setMarketCategories(categories);
        }
      }
    } catch (error) {
      showToast('Failed to load configuration', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Level config handlers
  const handleLevelUpdate = async (id: string, updates: Partial<LevelConfig>) => {
    setIsSaving(true);
    try {
      const success = await liveGameConfigService.updateLevelConfig(id, updates);
      if (success) {
        setLevelConfigs(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
        showToast('Level updated successfully', 'success');
        setEditingLevel(null);
      } else {
        showToast('Failed to update level', 'error');
      }
    } catch (error) {
      showToast('Failed to update level', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetLevels = async () => {
    if (!confirm('Reset all level configurations to defaults?')) return;
    setIsSaving(true);
    try {
      const success = await liveGameConfigService.resetLevelConfigsToDefaults();
      if (success) {
        await loadData();
        showToast('Levels reset to defaults', 'success');
      } else {
        showToast('Failed to reset levels', 'error');
      }
    } catch (error) {
      showToast('Failed to reset levels', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Reward config handlers
  const handleCreateReward = async () => {
    setIsSaving(true);
    try {
      const reward = await liveGameConfigService.createFreeRewardConfig({
        minPlayers: newReward.minPlayers,
        maxPlayers: newReward.maxPlayers || null,
        topX: newReward.topX,
      });
      if (reward) {
        setRewardConfigs(prev => [...prev, reward]);
        setShowNewRewardForm(false);
        setNewReward({ minPlayers: 0, maxPlayers: 0, topX: 3 });
        showToast('Reward config created', 'success');
      } else {
        showToast('Failed to create reward config', 'error');
      }
    } catch (error) {
      showToast('Failed to create reward config', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteReward = async (id: string) => {
    if (!confirm('Delete this reward configuration?')) return;
    setIsSaving(true);
    try {
      const success = await liveGameConfigService.deleteFreeRewardConfig(id);
      if (success) {
        setRewardConfigs(prev => prev.filter(r => r.id !== id));
        showToast('Reward config deleted', 'success');
      } else {
        showToast('Failed to delete reward config', 'error');
      }
    } catch (error) {
      showToast('Failed to delete reward config', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateReward = async (id: string, updates: Partial<FreeRewardConfig>) => {
    setIsSaving(true);
    try {
      const success = await liveGameConfigService.updateFreeRewardConfig(id, updates);
      if (success) {
        setRewardConfigs(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
        showToast('Reward config updated', 'success');
        setEditingReward(null);
      } else {
        showToast('Failed to update reward config', 'error');
      }
    } catch (error) {
      showToast('Failed to update reward config', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Tier handlers
  const handleAddTier = async (freeRewardId: string) => {
    setIsSaving(true);
    try {
      const tier = await liveGameConfigService.addRewardTier(freeRewardId, newTier);
      if (tier) {
        setRewardConfigs(prev => prev.map(r =>
          r.id === freeRewardId
            ? { ...r, tiers: [...r.tiers, tier] }
            : r
        ));
        setAddingTierTo(null);
        setNewTier({ rank: 1, rewardType: 'coins', rewardAmount: 100, rewardTier: null });
        showToast('Tier added', 'success');
      } else {
        showToast('Failed to add tier', 'error');
      }
    } catch (error) {
      showToast('Failed to add tier', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTier = async (tierId: string, freeRewardId: string) => {
    if (!confirm('Delete this reward tier?')) return;
    setIsSaving(true);
    try {
      const success = await liveGameConfigService.deleteRewardTier(tierId);
      if (success) {
        setRewardConfigs(prev => prev.map(r =>
          r.id === freeRewardId
            ? { ...r, tiers: r.tiers.filter(t => t.id !== tierId) }
            : r
        ));
        showToast('Tier deleted', 'success');
      } else {
        showToast('Failed to delete tier', 'error');
      }
    } catch (error) {
      showToast('Failed to delete tier', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Market category handlers
  const handleCreateCategory = async () => {
    if (!supabase || !newCategory.market_id || !newCategory.market_name) {
      showToast('Market ID and name are required', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('market_categories')
        .insert({
          market_id: newCategory.market_id,
          category: newCategory.category,
          market_name: newCategory.market_name,
          description: newCategory.description || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setMarketCategories(prev => [...prev, data]);
        setShowNewCategoryForm(false);
        setNewCategory({ market_id: 0, category: 'other', market_name: '', description: '' });
        showToast('Market category created', 'success');
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to create category', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateCategory = async (id: string, updates: Partial<MarketCategory>) => {
    if (!supabase) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('market_categories')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      setMarketCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
      setEditingCategory(null);
      showToast('Category updated', 'success');
    } catch (error) {
      showToast('Failed to update category', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!supabase || !confirm('Delete this market category?')) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('market_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setMarketCategories(prev => prev.filter(c => c.id !== id));
      showToast('Category deleted', 'success');
    } catch (error) {
      showToast('Failed to delete category', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredCategories = categoryFilter === 'all'
    ? marketCategories
    : marketCategories.filter(c => c.category === categoryFilter);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-electric-blue" />
      </div>
    );
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
          toast.type === 'success' ? 'bg-lime-glow text-black' : 'bg-hot-red text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Gamepad2 className="w-8 h-8 text-electric-blue" />
          <h1 className="text-3xl font-bold">Live Betting Game Config</h1>
        </div>
        <p className="text-text-secondary">
          Configure level limits and free mode rewards for the Live Betting Game
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('levels')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'levels'
              ? 'bg-electric-blue text-white'
              : 'bg-surface text-text-secondary hover:bg-surface-hover'
          }`}
        >
          <Trophy className="w-4 h-4" />
          Level Limits
        </button>
        <button
          onClick={() => setActiveTab('rewards')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'rewards'
              ? 'bg-electric-blue text-white'
              : 'bg-surface text-text-secondary hover:bg-surface-hover'
          }`}
        >
          <Gift className="w-4 h-4" />
          Free Mode Rewards
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'categories'
              ? 'bg-electric-blue text-white'
              : 'bg-surface text-text-secondary hover:bg-surface-hover'
          }`}
        >
          <Tags className="w-4 h-4" />
          Market Categories
        </button>
      </div>

      {/* Level Limits Tab */}
      {activeTab === 'levels' && (
        <div className="bg-surface rounded-xl border border-border-subtle p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-electric-blue" />
              Level Configuration
            </h2>
            <button
              onClick={handleResetLevels}
              disabled={isSaving}
              className="px-3 py-2 rounded-lg bg-warm-yellow/20 text-warm-yellow hover:bg-warm-yellow/30 transition-colors flex items-center gap-2 text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Defaults
            </button>
          </div>

          <p className="text-text-secondary text-sm mb-4">
            Configure entry limits and concurrent game slots per user level
          </p>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Level</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">XP Range</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Max Entry</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Max Slots</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Active</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {levelConfigs.map((level) => (
                  <tr key={level.id} className="border-b border-border-subtle/50 hover:bg-surface-hover/50">
                    <td className="py-3 px-4">
                      <span className="font-medium">{LEVEL_LABELS[level.levelName] || level.levelName}</span>
                    </td>
                    <td className="py-3 px-4 text-text-secondary">
                      {level.minXp.toLocaleString()} - {level.maxXp?.toLocaleString() || '∞'}
                    </td>
                    <td className="py-3 px-4">
                      {editingLevel === level.id ? (
                        <input
                          type="number"
                          defaultValue={level.entryMax || ''}
                          className="w-24 px-2 py-1 bg-background-dark border border-border-subtle rounded"
                          placeholder="∞"
                          onBlur={(e) => handleLevelUpdate(level.id, {
                            entryMax: e.target.value ? parseInt(e.target.value) : null
                          })}
                        />
                      ) : (
                        <span className="flex items-center gap-1">
                          <Coins className="w-4 h-4 text-warm-yellow" />
                          {level.entryMax?.toLocaleString() || '∞'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {editingLevel === level.id ? (
                        <input
                          type="number"
                          defaultValue={level.slotsMax || ''}
                          className="w-20 px-2 py-1 bg-background-dark border border-border-subtle rounded"
                          placeholder="∞"
                          onBlur={(e) => handleLevelUpdate(level.id, {
                            slotsMax: e.target.value ? parseInt(e.target.value) : null
                          })}
                        />
                      ) : (
                        <span>{level.slotsMax || '∞'}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleLevelUpdate(level.id, { isActive: !level.isActive })}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          level.isActive
                            ? 'bg-lime-glow/20 text-lime-glow'
                            : 'bg-hot-red/20 text-hot-red'
                        }`}
                      >
                        {level.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => setEditingLevel(editingLevel === level.id ? null : level.id)}
                        className="p-2 rounded hover:bg-surface-hover transition-colors"
                      >
                        <Edit2 className="w-4 h-4 text-text-secondary" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Free Mode Rewards Tab */}
      {activeTab === 'rewards' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Gift className="w-5 h-5 text-lime-glow" />
                Free Mode Reward Configurations
              </h2>
              <p className="text-text-secondary text-sm mt-1">
                Define rewards based on player count in free games
              </p>
            </div>
            <button
              onClick={() => setShowNewRewardForm(true)}
              className="px-4 py-2 rounded-lg bg-electric-blue text-white hover:bg-electric-blue/90 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Config
            </button>
          </div>

          {/* New Reward Form */}
          {showNewRewardForm && (
            <div className="bg-surface rounded-xl border border-electric-blue/50 p-4">
              <h3 className="font-medium mb-3">New Reward Configuration</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Min Players</label>
                  <input
                    type="number"
                    value={newReward.minPlayers}
                    onChange={(e) => setNewReward(prev => ({ ...prev, minPlayers: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-background-dark border border-border-subtle rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Max Players (0 = unlimited)</label>
                  <input
                    type="number"
                    value={newReward.maxPlayers}
                    onChange={(e) => setNewReward(prev => ({ ...prev, maxPlayers: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-background-dark border border-border-subtle rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Top X Rewarded</label>
                  <input
                    type="number"
                    value={newReward.topX}
                    onChange={(e) => setNewReward(prev => ({ ...prev, topX: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 bg-background-dark border border-border-subtle rounded-lg"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateReward}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg bg-lime-glow text-black font-medium hover:bg-lime-glow/90 transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Create
                </button>
                <button
                  onClick={() => setShowNewRewardForm(false)}
                  className="px-4 py-2 rounded-lg bg-surface-hover text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Reward Configs */}
          {rewardConfigs.map((reward) => (
            <div key={reward.id} className="bg-surface rounded-xl border border-border-subtle p-4">
              {/* Reward Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <span className="text-lg font-bold">
                    {reward.minPlayers} - {reward.maxPlayers || '∞'} players
                  </span>
                  <span className="px-2 py-1 rounded bg-electric-blue/20 text-electric-blue text-sm">
                    Top {reward.topX} rewarded
                  </span>
                  <button
                    onClick={() => handleUpdateReward(reward.id, { isActive: !reward.isActive })}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      reward.isActive
                        ? 'bg-lime-glow/20 text-lime-glow'
                        : 'bg-hot-red/20 text-hot-red'
                    }`}
                  >
                    {reward.isActive ? 'Active' : 'Inactive'}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAddingTierTo(addingTierTo === reward.id ? null : reward.id)}
                    className="p-2 rounded hover:bg-surface-hover transition-colors"
                  >
                    <Plus className="w-4 h-4 text-electric-blue" />
                  </button>
                  <button
                    onClick={() => handleDeleteReward(reward.id)}
                    className="p-2 rounded hover:bg-hot-red/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-hot-red" />
                  </button>
                </div>
              </div>

              {/* Add Tier Form */}
              {addingTierTo === reward.id && (
                <div className="bg-background-dark rounded-lg p-3 mb-4">
                  <h4 className="text-sm font-medium mb-2">Add Reward Tier</h4>
                  <div className="grid grid-cols-4 gap-3 mb-3">
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">Rank</label>
                      <input
                        type="number"
                        value={newTier.rank}
                        onChange={(e) => setNewTier(prev => ({ ...prev, rank: parseInt(e.target.value) || 1 }))}
                        className="w-full px-2 py-1 bg-surface border border-border-subtle rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">Type</label>
                      <select
                        value={newTier.rewardType}
                        onChange={(e) => setNewTier(prev => ({ ...prev, rewardType: e.target.value as any }))}
                        className="w-full px-2 py-1 bg-surface border border-border-subtle rounded text-sm"
                      >
                        <option value="coins">Coins</option>
                        <option value="xp">XP</option>
                        <option value="ticket">Ticket</option>
                        <option value="spin">Spin</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">Amount</label>
                      <input
                        type="number"
                        value={newTier.rewardAmount}
                        onChange={(e) => setNewTier(prev => ({ ...prev, rewardAmount: parseInt(e.target.value) || 0 }))}
                        className="w-full px-2 py-1 bg-surface border border-border-subtle rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">Tier</label>
                      <select
                        value={newTier.rewardTier || ''}
                        onChange={(e) => setNewTier(prev => ({ ...prev, rewardTier: e.target.value as any || null }))}
                        className="w-full px-2 py-1 bg-surface border border-border-subtle rounded text-sm"
                      >
                        <option value="">None</option>
                        <option value="amateur">Amateur</option>
                        <option value="master">Master</option>
                        <option value="apex">Apex</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAddTier(reward.id)}
                      disabled={isSaving}
                      className="px-3 py-1 rounded bg-lime-glow text-black text-sm font-medium"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setAddingTierTo(null)}
                      className="px-3 py-1 rounded bg-surface text-text-secondary text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Reward Tiers Table */}
              {reward.tiers.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-subtle">
                      <th className="text-left py-2 px-3 text-text-secondary text-sm font-medium">Rank</th>
                      <th className="text-left py-2 px-3 text-text-secondary text-sm font-medium">Type</th>
                      <th className="text-left py-2 px-3 text-text-secondary text-sm font-medium">Amount</th>
                      <th className="text-left py-2 px-3 text-text-secondary text-sm font-medium">Tier</th>
                      <th className="text-left py-2 px-3 text-text-secondary text-sm font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {reward.tiers.sort((a, b) => a.rank - b.rank).map((tier) => (
                      <tr key={tier.id} className="border-b border-border-subtle/50">
                        <td className="py-2 px-3 font-medium">#{tier.rank}</td>
                        <td className="py-2 px-3">{REWARD_TYPE_LABELS[tier.rewardType]}</td>
                        <td className="py-2 px-3">{tier.rewardAmount.toLocaleString()}</td>
                        <td className="py-2 px-3">
                          {tier.rewardTier && (
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              tier.rewardTier === 'apex' ? 'bg-hot-red/20 text-hot-red' :
                              tier.rewardTier === 'master' ? 'bg-warm-yellow/20 text-warm-yellow' :
                              'bg-lime-glow/20 text-lime-glow'
                            }`}>
                              {tier.rewardTier}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <button
                            onClick={() => tier.id && handleDeleteTier(tier.id, reward.id)}
                            className="p-1 rounded hover:bg-hot-red/20 transition-colors"
                          >
                            <Trash2 className="w-3 h-3 text-hot-red" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-text-secondary text-sm italic">No reward tiers configured</p>
              )}
            </div>
          ))}

          {rewardConfigs.length === 0 && !showNewRewardForm && (
            <div className="bg-surface rounded-xl border border-border-subtle p-8 text-center">
              <Gift className="w-12 h-12 text-text-disabled mx-auto mb-3" />
              <p className="text-text-secondary">No reward configurations yet</p>
              <button
                onClick={() => setShowNewRewardForm(true)}
                className="mt-4 px-4 py-2 rounded-lg bg-electric-blue text-white"
              >
                Add First Config
              </button>
            </div>
          )}
        </div>
      )}

      {/* Market Categories Tab */}
      {activeTab === 'categories' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Tags className="w-5 h-5 text-purple-400" />
                Market Categories
              </h2>
              <p className="text-text-secondary text-sm mt-1">
                Map API-Football market IDs to betting categories
              </p>
            </div>
            <button
              onClick={() => setShowNewCategoryForm(true)}
              className="px-4 py-2 rounded-lg bg-electric-blue text-white hover:bg-electric-blue/90 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Category
            </button>
          </div>

          {/* Filter */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                categoryFilter === 'all'
                  ? 'bg-electric-blue text-white'
                  : 'bg-surface text-text-secondary hover:bg-surface-hover'
              }`}
            >
              All ({marketCategories.length})
            </button>
            {CATEGORY_OPTIONS.map(cat => {
              const count = marketCategories.filter(c => c.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    categoryFilter === cat
                      ? CATEGORY_COLORS[cat]
                      : 'bg-surface text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  {cat.replace('_', ' ')} ({count})
                </button>
              );
            })}
          </div>

          {/* New Category Form */}
          {showNewCategoryForm && (
            <div className="bg-surface rounded-xl border border-electric-blue/50 p-4">
              <h3 className="font-medium mb-3">New Market Category</h3>
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Market ID *</label>
                  <input
                    type="number"
                    value={newCategory.market_id || ''}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, market_id: parseInt(e.target.value) || 0 }))}
                    placeholder="e.g., 36"
                    className="w-full px-3 py-2 bg-background-dark border border-border-subtle rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Category *</label>
                  <select
                    value={newCategory.category}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 bg-background-dark border border-border-subtle rounded-lg"
                  >
                    {CATEGORY_OPTIONS.map(cat => (
                      <option key={cat} value={cat}>{cat.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Market Name *</label>
                  <input
                    type="text"
                    value={newCategory.market_name}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, market_name: e.target.value }))}
                    placeholder="e.g., Over/Under"
                    className="w-full px-3 py-2 bg-background-dark border border-border-subtle rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Description</label>
                  <input
                    type="text"
                    value={newCategory.description}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional"
                    className="w-full px-3 py-2 bg-background-dark border border-border-subtle rounded-lg"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateCategory}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg bg-lime-glow text-black font-medium hover:bg-lime-glow/90 transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Create
                </button>
                <button
                  onClick={() => setShowNewCategoryForm(false)}
                  className="px-4 py-2 rounded-lg bg-surface-hover text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Categories Table */}
          <div className="bg-surface rounded-xl border border-border-subtle overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-background-dark border-b border-border-subtle">
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Market ID</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Market Name</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Category</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Description</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Active</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((cat) => (
                  <tr key={cat.id} className="border-b border-border-subtle/50 hover:bg-surface-hover/50">
                    <td className="py-3 px-4 font-mono text-sm">{cat.market_id}</td>
                    <td className="py-3 px-4">
                      {editingCategory === cat.id ? (
                        <input
                          type="text"
                          defaultValue={cat.market_name}
                          className="px-2 py-1 bg-background-dark border border-border-subtle rounded w-full"
                          onBlur={(e) => handleUpdateCategory(cat.id, { market_name: e.target.value })}
                        />
                      ) : (
                        <span className="font-medium">{cat.market_name}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {editingCategory === cat.id ? (
                        <select
                          defaultValue={cat.category}
                          className="px-2 py-1 bg-background-dark border border-border-subtle rounded"
                          onChange={(e) => handleUpdateCategory(cat.id, { category: e.target.value })}
                        >
                          {CATEGORY_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{opt.replace('_', ' ')}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${CATEGORY_COLORS[cat.category] || CATEGORY_COLORS.other}`}>
                          {cat.category.replace('_', ' ')}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-text-secondary text-sm">{cat.description || '-'}</td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleUpdateCategory(cat.id, { is_active: !cat.is_active })}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          cat.is_active
                            ? 'bg-lime-glow/20 text-lime-glow'
                            : 'bg-hot-red/20 text-hot-red'
                        }`}
                      >
                        {cat.is_active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditingCategory(editingCategory === cat.id ? null : cat.id)}
                          className="p-2 rounded hover:bg-surface-hover transition-colors"
                        >
                          <Edit2 className="w-4 h-4 text-text-secondary" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="p-2 rounded hover:bg-hot-red/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-hot-red" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredCategories.length === 0 && (
              <div className="p-8 text-center">
                <Tags className="w-12 h-12 text-text-disabled mx-auto mb-3" />
                <p className="text-text-secondary">
                  {categoryFilter === 'all' ? 'No market categories configured' : `No markets in category "${categoryFilter}"`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
