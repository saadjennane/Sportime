import { useState, useEffect } from 'react';
import { confirmDialog } from '../components/ui/Confirm';
import { Spinner } from '../components/ui/States';
import {
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Edit2,
  Gamepad2,
  Trophy,
  Users,
  Coins,
  Gift
} from 'lucide-react';
import {
  liveGameConfigService,
  LevelConfig,
  FreeRewardConfig,
  RewardTier,
} from '../services/liveGameConfigService';

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
  const [activeTab, setActiveTab] = useState<'levels' | 'rewards'>('levels');
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
    if (!await confirmDialog('Reset all level configurations to defaults?')) return;
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
    if (!await confirmDialog('Delete this reward configuration?')) return;
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
    if (!await confirmDialog('Delete this reward tier?')) return;
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

  if (isLoading) {
    return (
      <Spinner label="Loading configuration…" />
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
    </div>
  );
}
