import React, { useState, useMemo, useEffect } from 'react';
import { SportimeGame, TournamentType, GameType, GameFormat, RewardTier, ConditionsLogic, GameRewardTier } from '../../types';
import { TOURNAMENT_COSTS } from '../../config/constants';
import { supabase } from '../../services/supabase';
import { MultiSelect } from './MultiSelect';
import { RewardsConfigurator } from './RewardsConfigurator';
import { ChevronDown } from 'lucide-react';
import { useMockStore } from '../../store/useMockStore';
import { BASE_REWARD_PACKS } from '../../config/rewardPacks';

interface GameCreationFormProps {
  onCreate: (config: Omit<SportimeGame, 'id' | 'status' | 'totalPlayers' | 'participants'>, saveAsDraft?: boolean) => void;
  onCancel: () => void;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  initialData?: SportimeGame;
  isEditing?: boolean;
}

interface League {
  id: string;
  name: string;
}

interface Level {
  name: string;
}

interface Badge {
  id: string;
  name: string;
}

const initialFormState: Omit<SportimeGame, 'id' | 'status' | 'totalPlayers' | 'participants'> = {
  name: '',
  description: '',
  league_id: '',
  start_date: new Date().toISOString().split('T')[0],
  end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  game_type: 'betting',
  tier: 'amateur', // Challenge tier (Amateur/Master/Apex)
  duration_type: 'flash',
  entry_cost: 2000,
  custom_entry_cost_enabled: false,
  is_linkable: true,
  reward_tier: 'tier1',
  format: 'leaderboard',
  requires_subscription: false,
  minimum_level: 'Rookie', // Progression level (Rookie/Rising Star/Pro/Elite/Legend/GOAT)
  required_badges: [],
  conditions_logic: 'and',
  minimum_players: 0,
  maximum_players: 0,
  rewards: [],
};

export const GameCreationForm: React.FC<GameCreationFormProps> = ({ onCreate, onCancel, addToast, initialData, isEditing = false }) => {
  const [formState, setFormState] = useState(initialData ? {
    name: initialData.name,
    description: initialData.description || '',
    league_id: initialData.league_id || '',
    start_date: initialData.start_date,
    end_date: initialData.end_date,
    game_type: initialData.game_type,
    tier: initialData.tier,
    duration_type: initialData.duration_type,
    entry_cost: initialData.entry_cost,
    custom_entry_cost_enabled: initialData.custom_entry_cost_enabled || false,
    is_linkable: initialData.is_linkable !== undefined ? initialData.is_linkable : true,
    reward_tier: initialData.reward_tier,
    format: initialData.format,
    requires_subscription: initialData.requires_subscription || false,
    minimum_level: initialData.minimum_level,
    required_badges: initialData.required_badges || [],
    conditions_logic: initialData.conditions_logic || 'and',
    minimum_players: initialData.minimum_players,
    maximum_players: initialData.maximum_players,
    rewards: initialData.rewards || [],
  } : initialFormState);
  const [isRewardsOpen, setIsRewardsOpen] = useState(false);
  const [publishMode, setPublishMode] = useState<'now' | 'later'>('now');
  const [publishDate, setPublishDate] = useState('');
  const [leagues, setLeagues] = useState<League[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const { updateBasePack } = useMockStore();

  // Load leagues, levels, and badges from Supabase
  useEffect(() => {
    loadLeagues();
    loadLevels();
    loadBadges();
  }, []);

  const loadLeagues = async () => {
    try {
      const { data, error } = await supabase
        .from('fb_leagues')
        .select('id, name')
        .order('name');

      if (error) throw error;

      const leagueData = (data || []).map(l => ({ id: l.id, name: l.name })); // UUID is already a string
      setLeagues(leagueData);

      // Set first league as default if form state doesn't have one
      if (leagueData.length > 0 && !formState.league_id) {
        setFormState(prev => ({ ...prev, league_id: leagueData[0].id }));
      }
    } catch (err) {
      console.error('Error loading leagues:', err);
      addToast('Failed to load leagues', 'error');
    }
  };

  const loadLevels = async () => {
    try {
      const { data, error } = await supabase
        .from('levels_config')
        .select('name')
        .order('level');

      if (error) throw error;

      setLevels((data || []).map(l => ({ name: l.name })));
    } catch (err) {
      console.error('Error loading levels:', err);
      addToast('Failed to load levels', 'error');
      // Fallback to default progression levels (NOT tiers)
      setLevels([
        { name: 'Rookie' },
        { name: 'Rising Star' },
        { name: 'Pro' },
        { name: 'Elite' },
        { name: 'Legend' },
        { name: 'GOAT' }
      ]);
    }
  };

  const loadBadges = async () => {
    try {
      const { data, error } = await supabase
        .from('badges')
        .select('id, name')
        .order('name');

      if (error) throw error;

      setBadges(data || []);
    } catch (err) {
      console.error('Error loading badges:', err);
      addToast('Failed to load badges', 'error');
      setBadges([]);
    }
  };

  useEffect(() => {
    if (!formState.tier || !formState.duration_type) return;

    const durationMap: Record<string, string> = {
      flash: 'flash',
      series: 'series',
      season: 'season'
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
    if (!formState.tier || !formState.duration_type) return 0;
    const durationKey = formState.duration_type;
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
        if (newState.tier && newState.duration_type) {
          const durationKey = newState.duration_type;
          const newCost = TOURNAMENT_COSTS[newState.tier].base * (TOURNAMENT_COSTS[newState.tier].multipliers[durationKey!] || 1);
          newState.entry_cost = newCost;
        }
    }

    setFormState(newState);
  };

  const handleBadgeChange = (selectedBadges: string[]) => {
    setFormState({ ...formState, required_badges: selectedBadges });
  };

  const handleRewardsChange = (newRewards: GameRewardTier[]) => {
    setFormState({ ...formState, rewards: newRewards });
  };

  const handleSubmit = (e: React.FormEvent, saveAsDraft: boolean = false) => {
    e.preventDefault();

    // Validate league is selected
    if (!formState.league_id || formState.league_id === '') {
      addToast('Please select a league', 'error');
      return;
    }

    // Validate publish date if scheduling
    if (!saveAsDraft && publishMode === 'later' && !publishDate) {
      addToast('Please select a publish date', 'error');
      return;
    }

    // If scheduling for later, treat as draft with publish_date
    const isDraft = saveAsDraft || publishMode === 'later';
    const configWithPublishDate = {
      ...formState,
      publish_date: publishMode === 'later' ? publishDate : null,
    };

    onCreate(configWithPublishDate as any, isDraft);
  };

  const formFieldClasses = "input-base text-sm";

  return (
    <form onSubmit={handleSubmit} className="card-base p-4 space-y-4">
      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-3">
        <input type="text" name="name" placeholder="Game Name" value={formState.name} onChange={handleChange} className={formFieldClasses} required />
        <select name="league_id" value={formState.league_id} onChange={handleChange} className={formFieldClasses} required>
          {leagues.length === 0 ? (
            <option value="">Loading leagues...</option>
          ) : (
            <>
              <option value="">Select a league</option>
              {leagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </>
          )}
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
          {(['amateur', 'master', 'apex'] as TournamentType[]).map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
        </select>
        <select name="duration_type" value={formState.duration_type} onChange={handleChange} className={formFieldClasses}>
          <option value="flash">Flash</option>
          <option value="series">Series</option>
          <option value="season">Season</option>
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
          {levels.length === 0 ? (
            <option value="Rookie">Min Level: Rookie</option>
          ) : (
            levels.map(l => (
              <option key={l.name} value={l.name}>
                Min Level: {l.name}
              </option>
            ))
          )}
        </select>
        <MultiSelect
          options={badges.map(b => ({ value: b.id, label: b.name }))}
          selectedValues={formState.required_badges}
          onChange={handleBadgeChange}
          placeholder="Select required badges..."
        />
      </div>

      {/* Publishing Options */}
      {!isEditing && (
        <div className="border-t border-disabled/50 pt-4 space-y-3">
          <h4 className="text-sm font-semibold text-text-secondary">Publishing Options</h4>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="publishMode"
                value="now"
                checked={publishMode === 'now'}
                onChange={() => setPublishMode('now')}
                className="accent-electric-blue"
              />
              <span className="text-sm text-text-primary">Publish Now</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="publishMode"
                value="later"
                checked={publishMode === 'later'}
                onChange={() => setPublishMode('later')}
                className="accent-electric-blue"
              />
              <span className="text-sm text-text-primary">Schedule for Later</span>
            </label>
          </div>

          {publishMode === 'later' && (
            <div>
              <label className="text-xs text-text-disabled block mb-1">Publish Date & Time</label>
              <input
                type="datetime-local"
                value={publishDate}
                onChange={(e) => setPublishDate(e.target.value)}
                className={formFieldClasses}
                min={new Date().toISOString().slice(0, 16)}
              />
              <p className="text-xs text-text-disabled mt-1">
                Game will remain in draft until this date. You can edit it anytime before publication.
              </p>
            </div>
          )}
        </div>
      )}

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
        {!isEditing && (
          <button
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            className="flex-1 py-2 bg-warm-yellow/20 text-warm-yellow rounded-lg font-semibold hover:bg-warm-yellow/30"
          >
            Save as Draft
          </button>
        )}
        <button type="submit" className="flex-1 primary-button py-2">
          {isEditing ? 'Update Game' : 'Create & Publish'}
        </button>
      </div>
    </form>
  );
};
