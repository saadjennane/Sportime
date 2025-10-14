import React, { useState, useEffect, useMemo } from 'react';
import { SportimeGame, GameType, TournamentType, GameFormat, RewardTier, ConditionsLogic, DurationType } from '../../types';
import { TOURNAMENT_COSTS } from '../../config/constants';
import { mockBadges, mockLevelsConfig } from '../../data/mockProgression';
import { MultiSelect } from './MultiSelect';
import { mockLeagues } from '../../data/mockLeagues';

interface GameCreationFormProps {
  onCreate: (config: Omit<SportimeGame, 'id' | 'status' | 'totalPlayers' | 'participants'>) => void;
  onCancel: () => void;
}

const formFieldClasses = "input-base !bg-deep-navy/50";

export const GameCreationForm: React.FC<GameCreationFormProps> = ({ onCreate, onCancel }) => {
  const [config, setConfig] = useState<Partial<Omit<SportimeGame, 'id'>>>({
    name: '',
    game_type: 'betting',
    tier: 'rookie',
    duration_type: 'daily',
    entry_cost: TOURNAMENT_COSTS.rookie.base,
    custom_entry_cost_enabled: false,
    is_linkable: true,
    requires_subscription: false,
    minimum_level: 'Amateur',
    required_badges: [],
    minimum_players: 0,
    maximum_players: 0,
  });

  useEffect(() => {
    if (!config.custom_entry_cost_enabled && config.tier && config.duration_type) {
      const cost = TOURNAMENT_COSTS[config.tier].base * (TOURNAMENT_COSTS[config.tier].multipliers[config.duration_type] || 1);
      setConfig(prev => ({ ...prev, entry_cost: cost }));
    }
  }, [config.tier, config.duration_type, config.custom_entry_cost_enabled]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    // @ts-ignore
    const val = isCheckbox ? e.target.checked : value;
    setConfig(prev => ({ ...prev, [name]: val }));
  };

  const handleNumericChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(config as Omit<SportimeGame, 'id' | 'status' | 'totalPlayers' | 'participants'>);
  };

  const badgeOptions = useMemo(() => mockBadges.map(b => ({ value: b.id, label: b.name })), []);
  const levelOptions = useMemo(() => mockLevelsConfig.map(l => l.level_name), []);

  return (
    <form onSubmit={handleSubmit} className="bg-navy-accent/50 p-4 rounded-xl space-y-6 border border-disabled">
      <h3 className="font-bold text-lg text-electric-blue">Create New Game</h3>
      
      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input type="text" name="name" placeholder="Game Name" onChange={handleChange} className={formFieldClasses} required />
        <select name="game_type" onChange={handleChange} value={config.game_type} className={formFieldClasses}>
          <option value="betting">Betting</option>
          <option value="prediction">Prediction</option>
          <option value="fantasy">Fantasy</option>
        </select>
        <textarea name="description" placeholder="Description (optional)" onChange={handleChange} className={`${formFieldClasses} md:col-span-2 h-20`} />
      </div>

      {/* Economy & Tier */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <select name="tier" onChange={handleChange} value={config.tier} className={formFieldClasses}>
          <option value="rookie">Rookie</option>
          <option value="pro">Pro</option>
          <option value="elite">Elite</option>
        </select>
        <select name="duration_type" onChange={handleChange} value={config.duration_type} className={formFieldClasses}>
          <option value="daily">Matchday / Daily</option>
          <option value="mini">Mini-Series</option>
          <option value="season">Season</option>
        </select>
        <div className="relative">
          <input type="number" name="entry_cost" value={config.entry_cost} onChange={handleNumericChange} disabled={!config.custom_entry_cost_enabled} className={`${formFieldClasses} pr-10`} />
          <input type="checkbox" name="custom_entry_cost_enabled" checked={config.custom_entry_cost_enabled} onChange={handleChange} className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4" title="Enable custom cost" />
        </div>
      </div>

      {/* Player Limits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input type="number" name="minimum_players" placeholder="Min Players (0 for none)" onChange={handleNumericChange} className={formFieldClasses} />
        <input type="number" name="maximum_players" placeholder="Max Players (0 for none)" onChange={handleNumericChange} className={formFieldClasses} />
      </div>

      {/* Access Conditions */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
            <input type="checkbox" name="requires_subscription" checked={config.requires_subscription} onChange={handleChange} className="h-4 w-4" />
            Subscriber Only
          </label>
           <label className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
            <input type="checkbox" name="is_linkable" checked={config.is_linkable} onChange={handleChange} className="h-4 w-4" />
            Linkable
          </label>
        </div>
        <select name="minimum_level" onChange={handleChange} value={config.minimum_level} className={formFieldClasses}>
          <option value="Amateur">Min Level: Amateur</option>
          {levelOptions.slice(1).map(level => <option key={level} value={level}>Min Level: {level}</option>)}
        </select>
        <MultiSelect label="Required Badges" options={badgeOptions} selected={config.required_badges || []} onChange={(val) => setConfig(p => ({...p, required_badges: val}))} placeholder="Select badges..." />
      </div>

      {/* Actions */}
      <div className="flex gap-4 pt-4 border-t border-disabled">
        <button type="button" onClick={onCancel} className="secondary-button flex-1 bg-navy-accent border-disabled text-text-secondary hover:border-electric-blue hover:text-electric-blue">Cancel</button>
        <button type="submit" className="primary-button flex-1">Create Game</button>
      </div>
    </form>
  );
};
