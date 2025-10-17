import React, { useState, useMemo, useEffect } from 'react';
import { SportimeGame, TournamentType, GameType, GameFormat, RewardTier, ConditionsLogic, GameRewardTier } from '../../types';
import { TOURNAMENT_COSTS } from '../../config/constants';
import { mockBadges } from '../../data/mockProgression';
import { mockLeagues } from '../../data/mockLeagues';
import { MultiSelect } from './MultiSelect';
import { RewardsConfigurator } from './RewardsConfigurator';
import { ChevronDown } from 'lucide-react';
import { useMockStore } from '../../store/useMockStore';
import { BASE_REWARD_PACKS } from '../../config/rewardPacks';

interface GameCreationFormProps {
  onCreate: (config: Omit<SportimeGame, 'id' | 'status' | 'totalPlayers' | 'participants'>) => void;
  onCancel: () => void;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const initialFormState: Omit<SportimeGame, 'id' | 'status' | 'totalPlayers' | 'participants'> = {
  name: '',
  description: '',
  league_id: mockLeagues[0].id,
  start_date: new Date().toISOString().split('T')[0],
  end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  game_type: 'betting',
  tier: 'rookie',
  duration_type: 'daily',
  entry_cost: 2000,
  custom_entry_cost_enabled: false,
  is_linkable: true,
  reward_tier: 'tier1',
  format: 'leaderboard',
  requires_subscription: false,
  minimum_level: 'Amateur',
  required_badges: [],
  conditions_logic: 'and',
  minimum_players: 0,
  maximum_players: 0,
  rewards: [],
};

export const GameCreationForm: React.FC<GameCreationFormProps> = ({ onCreate, onCancel, addToast }) => {
  const [formState, setFormState] = useState(initialFormState);
  const [isRewardsOpen, setIsRewardsOpen] = useState(false);
  const { updateBasePack } = useMockStore();

  useEffect(() => {
    if (!formState.tier || !formState.duration_type) return;

    const durationMap: Record<string, string> = {
      daily: 'matchday',
      'mini-series': 'mini-series',
      seasonal: 'season'
    };
    const normalizedKey = durationMap[formState.duration_type] || formState.duration_type;
    const basePack = BASE_REWARD_PACKS?.[formState.tier]?.[normalizedKey];

    if (basePack) {
      const deepCopied = JSON.parse(JSON.stringify(basePack));
      setFormState(prev => ({ ...prev, rewards: deepCopied }));
    } else {
        setFormState(prev => ({ ...prev, rewards: [] }));
    }
  }, [formState.tier, formState.duration_type]);

  const calculatedCost = useMemo(() => {
    const durationKey = formState.duration_type === 'daily' ? 'matchday' : formState.duration_type;
    return TOURNAMENT_COSTS[formState.tier].base * (TOURNAMENT_COSTS[formState.tier].multipliers[durationKey!] || 1);
  }, [formState.tier, formState.duration_type]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let finalValue: any = value;
    if (type === 'checkbox') {
      finalValue = (e.target as HTMLInputElement).checked;
    }
    if (['entry_cost', 'minimum_players', 'maximum_players'].includes(name)) {
      finalValue = Number(value);
    }
    
    const newState = { ...formState, [name]: finalValue };

    if (!newState.custom_entry_cost_enabled && (name === 'tier' || name === 'duration_type')) {
        const durationKey = newState.duration_type === 'daily' ? 'matchday' : newState.duration_type;
        const newCost = TOURNAMENT_COSTS[newState.tier].base * (TOURNAMENT_COSTS[newState.tier].multipliers[durationKey!] || 1);
        newState.entry_cost = newCost;
    }

    setFormState(newState);
  };

  const handleBadgeChange = (selectedBadges: string[]) => {
    setFormState({ ...formState, required_badges: selectedBadges });
  };

  const handleRewardsChange = (newRewards: GameRewardTier[]) => {
    setFormState({ ...formState, rewards: newRewards });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(formState);
  };

  const formFieldClasses = "input-base text-sm";

  return (
    <form onSubmit={handleSubmit} className="card-base p-4 space-y-4">
      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-3">
        <input type="text" name="name" placeholder="Game Name" value={formState.name} onChange={handleChange} className={formFieldClasses} required />
        <select name="league_id" value={formState.league_id} onChange={handleChange} className={formFieldClasses}>
          {mockLeagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>
      <textarea name="description" placeholder="Description..." value={formState.description} onChange={handleChange} className={`${formFieldClasses} h-20`} />
      
      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-text-disabled">Start Date</label>
          <input type="date" name="start_date" value={formState.start_date} onChange={handleChange} className={formFieldClasses} required />
        </div>
        <div>
          <label className="text-xs text-text-disabled">End Date</label>
          <input type="date" name="end_date" value={formState.end_date} onChange={handleChange} className={formFieldClasses} required />
        </div>
      </div>

      {/* Game Type, Tier & Duration */}
      <div className="grid grid-cols-3 gap-3">
        <select name="game_type" value={formState.game_type} onChange={handleChange} className={formFieldClasses}>
          {(['betting', 'prediction', 'fantasy'] as GameType[]).map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
        </select>
        <select name="tier" value={formState.tier} onChange={handleChange} className={formFieldClasses}>
          {(['rookie', 'pro', 'elite'] as TournamentType[]).map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
        </select>
        <select name="duration_type" value={formState.duration_type} onChange={handleChange} className={formFieldClasses}>
          <option value="daily">Daily</option>
          <option value="mini-series">Mini-Series</option>
          <option value="seasonal">Seasonal</option>
        </select>
      </div>

      {/* Entry Cost */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="text-xs text-text-disabled">Entry Cost</label>
          <input type="number" name="entry_cost" value={formState.custom_entry_cost_enabled ? formState.entry_cost : calculatedCost} onChange={handleChange} disabled={!formState.custom_entry_cost_enabled} className={`${formFieldClasses} disabled:bg-navy-accent`} />
        </div>
        <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
          <input type="checkbox" name="custom_entry_cost_enabled" checked={formState.custom_entry_cost_enabled} onChange={handleChange} className="accent-electric-blue" />
          Override
        </label>
      </div>

      {/* Player Limits */}
      <div className="grid grid-cols-2 gap-3">
        <input type="number" name="minimum_players" placeholder="Min Players (0=none)" value={formState.minimum_players || ''} onChange={handleChange} className={formFieldClasses} />
        <input type="number" name="maximum_players" placeholder="Max Players (0=none)" value={formState.maximum_players || ''} onChange={handleChange} className={formFieldClasses} />
      </div>

      {/* Access Conditions */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-text-secondary">Access Conditions</h4>
        <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
          <input type="checkbox" name="requires_subscription" checked={formState.requires_subscription} onChange={handleChange} className="accent-electric-blue" />
          Subscriber Only
        </label>
        <select name="minimum_level" value={formState.minimum_level} onChange={handleChange} className={formFieldClasses}>
          <option value="Amateur">Min Level: Amateur</option>
          <option value="Pro">Min Level: Pro</option>
          <option value="Expert">Min Level: Expert</option>
          <option value="Master">Min Level: Master</option>
          <option value="Legend">Min Level: Legend</option>
          <option value="GOAT">Min Level: GOAT</option>
        </select>
        <MultiSelect options={mockBadges.map(b => ({ value: b.id, label: b.name }))} selectedValues={formState.required_badges} onChange={handleBadgeChange} placeholder="Select required badges..." />
      </div>

      {/* Rewards Section */}
      <div className="border-t border-disabled/50 pt-4">
        <button type="button" onClick={() => setIsRewardsOpen(!isRewardsOpen)} className="w-full flex justify-between items-center">
          <h4 className="text-sm font-semibold text-text-secondary">Rewards Configuration</h4>
          <ChevronDown className={`transition-transform ${isRewardsOpen ? 'rotate-180' : ''}`} />
        </button>
        {isRewardsOpen && (
          <div className="mt-4">
            <RewardsConfigurator
              rewards={formState.rewards || []}
              onRewardsChange={handleRewardsChange}
              tier={formState.tier}
              format={formState.duration_type!}
              updateBasePack={updateBasePack}
              addToast={addToast}
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-3">
        <button type="button" onClick={onCancel} className="flex-1 py-2 bg-disabled text-text-secondary rounded-lg font-semibold">Cancel</button>
        <button type="submit" className="flex-1 primary-button py-2">Create Game</button>
      </div>
    </form>
  );
};
