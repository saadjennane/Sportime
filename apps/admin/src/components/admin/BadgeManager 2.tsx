/**
 * Badge Manager Component
 *
 * Admin interface for creating and managing dynamic badges with configurable conditions.
 * Allows admins to:
 * - Create new badges with custom conditions
 * - Edit existing badges
 * - Activate/deactivate badges
 * - Preview badge conditions
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { Plus, Edit2, Power, PowerOff, Trash2, Award, Loader2 } from 'lucide-react';

interface Badge {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  xp_bonus: number;
  condition_type: string | null;
  condition_value: any;
  condition_query: string | null;
  is_active: boolean;
  created_at: string;
}

interface BadgeFormData {
  name: string;
  description: string;
  icon_url: string;
  xp_bonus: number;
  condition_type: string;
  condition_value: any;
  condition_query: string;
}

const CONDITION_TYPES = [
  { value: 'win_streak', label: 'Win Streak', description: 'X consecutive correct predictions' },
  { value: 'total_wins', label: 'Total Wins', description: 'X total correct predictions' },
  { value: 'accuracy_threshold', label: 'Accuracy %', description: 'Minimum accuracy percentage' },
  { value: 'coins_earned', label: 'Coins Earned', description: 'Total coins earned' },
  { value: 'games_played', label: 'Games Played', description: 'Total games participated in' },
  { value: 'custom_query', label: 'Custom Query', description: 'Custom SQL condition' },
];

export const BadgeManager: React.FC<{ addToast: (msg: string, type: 'success' | 'error' | 'info') => void }> = ({
  addToast,
}) => {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null);

  const [formData, setFormData] = useState<BadgeFormData>({
    name: '',
    description: '',
    icon_url: '',
    xp_bonus: 150,
    condition_type: 'total_wins',
    condition_value: {},
    condition_query: '',
  });

  useEffect(() => {
    loadBadges();
  }, []);

  const loadBadges = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('badges')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBadges(data || []);
    } catch (err: any) {
      console.error('Error loading badges:', err);
      addToast('Failed to load badges', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBadge = async () => {
    if (!formData.name.trim()) {
      addToast('Badge name is required', 'error');
      return;
    }

    try {
      const { error } = await supabase.from('badges').insert({
        name: formData.name,
        description: formData.description || null,
        icon_url: formData.icon_url || null,
        xp_bonus: formData.xp_bonus,
        condition_type: formData.condition_type,
        condition_value: getConditionValueForType(formData.condition_type, formData.condition_value),
        condition_query: formData.condition_type === 'custom_query' ? formData.condition_query : null,
        is_active: true,
      });

      if (error) throw error;

      addToast(`Badge "${formData.name}" created successfully!`, 'success');
      setIsCreating(false);
      resetForm();
      await loadBadges();
    } catch (err: any) {
      console.error('Error creating badge:', err);
      addToast(err.message || 'Failed to create badge', 'error');
    }
  };

  const handleUpdateBadge = async () => {
    if (!editingBadge) return;

    try {
      const { error } = await supabase
        .from('badges')
        .update({
          name: formData.name,
          description: formData.description || null,
          icon_url: formData.icon_url || null,
          xp_bonus: formData.xp_bonus,
          condition_type: formData.condition_type,
          condition_value: getConditionValueForType(formData.condition_type, formData.condition_value),
          condition_query: formData.condition_type === 'custom_query' ? formData.condition_query : null,
        })
        .eq('id', editingBadge.id);

      if (error) throw error;

      addToast(`Badge "${formData.name}" updated!`, 'success');
      setEditingBadge(null);
      resetForm();
      await loadBadges();
    } catch (err: any) {
      console.error('Error updating badge:', err);
      addToast(err.message || 'Failed to update badge', 'error');
    }
  };

  const handleToggleActive = async (badge: Badge) => {
    try {
      const { error } = await supabase
        .from('badges')
        .update({ is_active: !badge.is_active })
        .eq('id', badge.id);

      if (error) throw error;

      addToast(`Badge "${badge.name}" ${!badge.is_active ? 'activated' : 'deactivated'}`, 'success');
      await loadBadges();
    } catch (err: any) {
      console.error('Error toggling badge:', err);
      addToast('Failed to toggle badge status', 'error');
    }
  };

  const handleDeleteBadge = async (badge: Badge) => {
    if (!confirm(`Are you sure you want to delete badge "${badge.name}"?`)) return;

    try {
      const { error } = await supabase.from('badges').delete().eq('id', badge.id);

      if (error) throw error;

      addToast(`Badge "${badge.name}" deleted`, 'success');
      await loadBadges();
    } catch (err: any) {
      console.error('Error deleting badge:', err);
      addToast('Failed to delete badge', 'error');
    }
  };

  const startEdit = (badge: Badge) => {
    setEditingBadge(badge);
    setFormData({
      name: badge.name,
      description: badge.description || '',
      icon_url: badge.icon_url || '',
      xp_bonus: badge.xp_bonus,
      condition_type: badge.condition_type || 'total_wins',
      condition_value: badge.condition_value || {},
      condition_query: badge.condition_query || '',
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      icon_url: '',
      xp_bonus: 150,
      condition_type: 'total_wins',
      condition_value: {},
      condition_query: '',
    });
  };

  const getConditionValueForType = (type: string, value: any) => {
    // Convert form input to JSONB format expected by database
    switch (type) {
      case 'win_streak':
      case 'total_wins':
      case 'games_played':
        return { threshold: parseInt(value.threshold || 0) };
      case 'accuracy_threshold':
        return { percentage: parseFloat(value.percentage || 0) };
      case 'coins_earned':
        return { amount: parseInt(value.amount || 0) };
      case 'custom_query':
        return value;
      default:
        return value;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="animate-spin text-electric-blue" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-bold text-lg text-electric-blue">Badge Management</h2>
        <button
          onClick={() => {
            setIsCreating(!isCreating);
            setEditingBadge(null);
            if (!isCreating) resetForm();
          }}
          className="flex items-center gap-2 text-sm font-semibold bg-lime-glow/20 text-lime-glow px-4 py-3 rounded-lg hover:bg-lime-glow/30"
        >
          <Plus size={16} />
          {isCreating ? 'Cancel' : 'Create Badge'}
        </button>
      </div>

      {(isCreating || editingBadge) && (
        <BadgeForm
          formData={formData}
          setFormData={setFormData}
          onSubmit={editingBadge ? handleUpdateBadge : handleCreateBadge}
          onCancel={() => {
            setIsCreating(false);
            setEditingBadge(null);
            resetForm();
          }}
          isEditing={!!editingBadge}
        />
      )}

      <div className="space-y-3">
        {badges.length === 0 ? (
          <div className="card-base p-6 text-center text-text-disabled">No badges created yet</div>
        ) : (
          badges.map(badge => (
            <BadgeCard
              key={badge.id}
              badge={badge}
              onEdit={startEdit}
              onToggle={handleToggleActive}
              onDelete={handleDeleteBadge}
            />
          ))
        )}
      </div>
    </div>
  );
};

// ============================================================================
// BADGE FORM
// ============================================================================

const BadgeForm: React.FC<{
  formData: BadgeFormData;
  setFormData: React.Dispatch<React.SetStateAction<BadgeFormData>>;
  onSubmit: () => void;
  onCancel: () => void;
  isEditing: boolean;
}> = ({ formData, setFormData, onSubmit, onCancel, isEditing }) => {
  return (
    <div className="card-base p-4 space-y-3">
      <h3 className="font-bold text-text-primary">{isEditing ? 'Edit Badge' : 'Create New Badge'}</h3>

      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-1">Badge Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={e => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., First Victory"
          className="w-full p-2 bg-navy-accent text-text-primary rounded-lg text-sm border border-white/10 focus:outline-none focus:border-electric-blue"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-1">Description</label>
        <textarea
          value={formData.description}
          onChange={e => setFormData({ ...formData, description: e.target.value })}
          placeholder="Badge description..."
          className="w-full p-2 bg-navy-accent text-text-primary rounded-lg text-sm border border-white/10 focus:outline-none focus:border-electric-blue"
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">Icon URL (emoji or image)</label>
          <input
            type="text"
            value={formData.icon_url}
            onChange={e => setFormData({ ...formData, icon_url: e.target.value })}
            placeholder="🏆 or https://..."
            className="w-full p-2 bg-navy-accent text-text-primary rounded-lg text-sm border border-white/10 focus:outline-none focus:border-electric-blue"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">XP Bonus</label>
          <input
            type="number"
            value={formData.xp_bonus}
            onChange={e => setFormData({ ...formData, xp_bonus: parseInt(e.target.value) || 150 })}
            className="w-full p-2 bg-navy-accent text-text-primary rounded-lg text-sm border border-white/10 focus:outline-none focus:border-electric-blue"
            min="0"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-1">Condition Type</label>
        <select
          value={formData.condition_type}
          onChange={e => setFormData({ ...formData, condition_type: e.target.value, condition_value: {} })}
          className="w-full p-2 bg-navy-accent text-text-primary rounded-lg text-sm border border-white/10 focus:outline-none focus:border-electric-blue"
        >
          {CONDITION_TYPES.map(ct => (
            <option key={ct.value} value={ct.value}>
              {ct.label} - {ct.description}
            </option>
          ))}
        </select>
      </div>

      <ConditionValueInput
        conditionType={formData.condition_type}
        conditionValue={formData.condition_value}
        setConditionValue={v => setFormData({ ...formData, condition_value: v })}
        conditionQuery={formData.condition_query}
        setConditionQuery={q => setFormData({ ...formData, condition_query: q })}
      />

      <div className="flex gap-2 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2 bg-navy-accent text-text-secondary rounded-lg font-semibold hover:bg-white/10"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          className="flex-1 py-2 bg-electric-blue text-white rounded-lg font-semibold hover:bg-electric-blue/80"
        >
          {isEditing ? 'Update' : 'Create'} Badge
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// CONDITION VALUE INPUT
// ============================================================================

const ConditionValueInput: React.FC<{
  conditionType: string;
  conditionValue: any;
  setConditionValue: (v: any) => void;
  conditionQuery: string;
  setConditionQuery: (q: string) => void;
}> = ({ conditionType, conditionValue, setConditionValue, conditionQuery, setConditionQuery }) => {
  switch (conditionType) {
    case 'win_streak':
    case 'total_wins':
    case 'games_played':
      return (
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">Threshold</label>
          <input
            type="number"
            value={conditionValue.threshold || 0}
            onChange={e => setConditionValue({ threshold: e.target.value })}
            placeholder="e.g., 10"
            className="w-full p-2 bg-navy-accent text-text-primary rounded-lg text-sm border border-white/10 focus:outline-none focus:border-electric-blue"
            min="1"
          />
        </div>
      );

    case 'accuracy_threshold':
      return (
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">Accuracy % (e.g., 75)</label>
          <input
            type="number"
            value={conditionValue.percentage || 0}
            onChange={e => setConditionValue({ percentage: e.target.value })}
            placeholder="e.g., 75"
            className="w-full p-2 bg-navy-accent text-text-primary rounded-lg text-sm border border-white/10 focus:outline-none focus:border-electric-blue"
            min="0"
            max="100"
          />
        </div>
      );

    case 'coins_earned':
      return (
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">Coins Amount</label>
          <input
            type="number"
            value={conditionValue.amount || 0}
            onChange={e => setConditionValue({ amount: e.target.value })}
            placeholder="e.g., 1000"
            className="w-full p-2 bg-navy-accent text-text-primary rounded-lg text-sm border border-white/10 focus:outline-none focus:border-electric-blue"
            min="0"
          />
        </div>
      );

    case 'custom_query':
      return (
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">Custom SQL Query</label>
          <textarea
            value={conditionQuery}
            onChange={e => setConditionQuery(e.target.value)}
            placeholder="SELECT COUNT(*) FROM ... WHERE user_id = $1"
            className="w-full p-2 bg-navy-accent text-text-primary rounded-lg text-sm border border-white/10 focus:outline-none focus:border-electric-blue font-mono"
            rows={3}
          />
          <p className="text-xs text-text-disabled mt-1">⚠️ Use $1 as placeholder for user_id</p>
        </div>
      );

    default:
      return null;
  }
};

// ============================================================================
// BADGE CARD
// ============================================================================

const BadgeCard: React.FC<{
  badge: Badge;
  onEdit: (badge: Badge) => void;
  onToggle: (badge: Badge) => void;
  onDelete: (badge: Badge) => void;
}> = ({ badge, onEdit, onToggle, onDelete }) => {
  const conditionDesc = () => {
    const type = CONDITION_TYPES.find(ct => ct.value === badge.condition_type);
    if (!type) return 'No condition';

    const val = badge.condition_value;
    if (!val) return type.label;

    switch (badge.condition_type) {
      case 'win_streak':
      case 'total_wins':
      case 'games_played':
        return `${type.label}: ${val.threshold || '?'}`;
      case 'accuracy_threshold':
        return `${type.label}: ${val.percentage || '?'}%`;
      case 'coins_earned':
        return `${type.label}: ${val.amount || '?'} coins`;
      case 'custom_query':
        return 'Custom SQL';
      default:
        return type.label;
    }
  };

  return (
    <div className="card-base p-4 space-y-2">
      <div className="flex justify-between items-start">
        <div className="flex items-start gap-3">
          <div className="text-3xl">{badge.icon_url || <Award />}</div>
          <div className="flex-1">
            <h3 className="font-bold text-text-primary">{badge.name}</h3>
            {badge.description && <p className="text-xs text-text-secondary">{badge.description}</p>}
            <div className="flex items-center gap-3 mt-2 text-xs text-text-disabled">
              <span>+{badge.xp_bonus} XP</span>
              <span>•</span>
              <span>{conditionDesc()}</span>
            </div>
          </div>
        </div>
        <span
          className={`text-xs font-bold px-2 py-1 rounded-full ${
            badge.is_active
              ? 'bg-lime-glow/20 text-lime-glow'
              : 'bg-gray-500/20 text-gray-400'
          }`}
        >
          {badge.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="flex gap-2 pt-2 border-t border-white/5">
        <button
          onClick={() => onEdit(badge)}
          className="flex items-center gap-1 text-xs font-semibold bg-electric-blue/20 text-electric-blue px-3 py-2 rounded-lg hover:bg-electric-blue/30"
        >
          <Edit2 size={14} /> Edit
        </button>
        <button
          onClick={() => onToggle(badge)}
          className={`flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg ${
            badge.is_active
              ? 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
              : 'bg-lime-glow/20 text-lime-glow hover:bg-lime-glow/30'
          }`}
        >
          {badge.is_active ? <PowerOff size={14} /> : <Power size={14} />}
          {badge.is_active ? 'Deactivate' : 'Activate'}
        </button>
        <button
          onClick={() => onDelete(badge)}
          className="flex items-center gap-1 text-xs font-semibold bg-hot-red/20 text-hot-red px-3 py-2 rounded-lg hover:bg-hot-red/30 ml-auto"
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </div>
  );
};
