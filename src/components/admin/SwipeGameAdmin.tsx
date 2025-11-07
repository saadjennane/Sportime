/**
 * Swipe Game Admin Component
 *
 * Admin interface for creating and managing swipe prediction games
 * - Create multi-day swipe challenges from fixtures
 * - Automatically generates matchdays from league fixtures
 * - Manual fixture result resolution (triggers points calculation)
 * - Challenge status management
 */

import React, { useEffect, useMemo, useState } from 'react'
import { Play, Square, RefreshCw, Calendar, Trophy, Coins, ChevronDown } from 'lucide-react'
import { supabase } from '../../services/supabase'
import * as swipeService from '../../services/swipeGameService'
import { MultiSelect } from './MultiSelect'
import { getMatchdayDate, formatMatchdayDate } from '../../features/swipe/swipeMappers';
import type { GameRewardTier } from '../../types'

type DurationKey = 'flash' | 'series' | 'season'
type SwipeTier = 'amateur' | 'master' | 'apex'

const SWIPE_TIER_COSTS: Record<SwipeTier, { base: number; multipliers: Record<DurationKey, number> }> = {
  amateur: { base: 2000, multipliers: { flash: 1, series: 2, season: 4 } },
  master: { base: 10000, multipliers: { flash: 1, series: 2, season: 4 } },
  apex: { base: 20000, multipliers: { flash: 1, series: 2, season: 4 } },
}

const DEFAULT_DURATION: DurationKey = 'flash'
const DEFAULT_TIER: SwipeTier = 'amateur'
const DEFAULT_MIN_LEVEL = 'Rookie' // Progression level, not tier

interface SwipeGameAdminProps {
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

interface League {
  id: string
  name: string
  logo: string | null
}

interface Challenge {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  entry_cost: number;
  status: string;
  league?: League;
}

interface LevelOption {
  name: string
}

interface BadgeOption {
  id: string
  name: string
}

export const SwipeGameAdmin: React.FC<SwipeGameAdminProps> = ({ addToast }) => {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [levels, setLevels] = useState<LevelOption[]>([])
  const [badges, setBadges] = useState<BadgeOption[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load leagues
  useEffect(() => {
    loadLeagues();
    loadChallenges();
    loadLevels()
    loadBadges()
  }, []);

  const loadLeagues = async () => {
    try {
      const primary = await supabase
        .from('fb_leagues')
        .select('id, name, logo, api_league_id')
        .order('name')

      if (primary.error) throw primary.error

      const records = (primary.data ?? []).map((league) => ({
        id: String(league.id),
        name: league.name,
        logo:
          league.logo ??
          (league.api_league_id
            ? `https://media.api-sports.io/football/leagues/${league.api_league_id}.png`
            : null),
      }))

      if (records.length) {
        setLeagues(records)
        return
      }

      const fallback = await supabase
        .from('leagues')
        .select('id, name, logo')
        .order('name')

      if (fallback.error) throw fallback.error

      setLeagues(
        (fallback.data ?? []).map((league) => ({
          id: String(league.id),
          name: league.name,
          logo: league.logo ?? null,
        }))
      )
    } catch (err) {
      console.error('Error loading leagues:', err)
      addToast('Failed to load leagues', 'error')
      setLeagues([])
    }
  }

  const loadChallenges = async () => {
    try {
      const { data, error } = await supabase
        .from('challenges')
        .select(`
          id,
          name,
          start_date,
          end_date,
          entry_cost,
          status,
          challenge_leagues!inner(
            league:leagues(id, name, logo)
          )
        `)
        .eq('game_type', 'prediction')
        .order('start_date', { ascending: false });

      if (error) throw error;

      // Transform data
      const transformed = data?.map(c => ({
        id: c.id,
        name: c.name,
        start_date: c.start_date,
        end_date: c.end_date,
        entry_cost: c.entry_cost,
        status: c.status,
        league: c.challenge_leagues?.[0]?.league,
      })) || [];

      setChallenges(transformed);
    } catch (err) {
      console.error('Error loading challenges:', err);
      addToast('Failed to load challenges', 'error');
    }
  };

  const loadLevels = async () => {
    try {
      const { data, error } = await supabase.from('levels_config').select('name').order('level')
      if (error) throw error
      setLevels((data ?? []).map(({ name }) => ({ name })))
    } catch (err) {
      console.error('Error loading levels:', err)
      addToast('Failed to load levels', 'error')
      setLevels([{ name: DEFAULT_MIN_LEVEL }])
    }
  }

  const loadBadges = async () => {
    try {
      const { data, error } = await supabase.from('badges').select('id, name').order('name')
      if (error) throw error
      setBadges(data ?? [])
    } catch (err) {
      console.error('Error loading badges:', err)
      addToast('Failed to load badges', 'error')
      setBadges([])
    }
  }

  const handleCreateChallenge = async (formData: {
    name: string;
    description?: string;
    league_id: string;
    start_date: string;
    end_date: string;
    entry_cost: number;
    game_type: 'betting' | 'prediction' | 'fantasy';
    tier: SwipeTier;
    duration_type: DurationKey;
    custom_entry_cost_enabled: boolean;
    minimum_level: string;
    minimum_players: number;
    maximum_players: number;
    required_badges: string[];
    requires_subscription: boolean;
  }) => {
    setIsLoading(true);
    try {
      // 1. Create challenge
      const challenge = await swipeService.createSwipeChallenge({
        name: formData.name,
        description: formData.description || `Swipe predictions for ${formData.name}`,
        league_id: formData.league_id,
        start_date: formData.start_date,
        end_date: formData.end_date,
        entry_cost: formData.entry_cost,
        game_type: formData.game_type,
        tier: formData.tier,
        duration_type: formData.duration_type,
        minimum_level: formData.minimum_level,
        minimum_players: formData.minimum_players,
        maximum_players: formData.maximum_players,
        required_badges: formData.required_badges,
        requires_subscription: formData.requires_subscription,
      });

      addToast('Challenge created successfully!', 'success');

      // 2. Auto-generate matchdays and link fixtures
      await generateMatchdays(challenge.id, formData.league_id, formData.start_date, formData.end_date);

      addToast('Matchdays generated successfully!', 'success');
      setShowCreateForm(false);
      await loadChallenges();
    } catch (err: any) {
      console.error('Error creating challenge:', err);
      addToast(err.message || 'Failed to create challenge', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const generateMatchdays = async (
    challengeId: string,
    leagueId: string,
    startDate: string,
    endDate: string
  ) => {
    // Get all fixtures in the date range for this league
    const { data: fixtures, error } = await supabase
      .from('fixtures')
      .select('id, date, league_id')
      .eq('league_id', leagueId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date');

    if (error) throw error;

    if (!fixtures || fixtures.length === 0) {
      throw new Error('No fixtures found in this date range for the selected league');
    }

    // Group fixtures by date
    const fixturesByDate = new Map<string, string[]>();
    for (const fixture of fixtures) {
      const date = getMatchdayDate(fixture.date);
      const existing = fixturesByDate.get(date) || [];
      fixturesByDate.set(date, [...existing, fixture.id]);
    }

    // Create matchdays and link fixtures
    for (const [date, fixtureIds] of fixturesByDate.entries()) {
      const matchday = await swipeService.getOrCreateMatchday(challengeId, date);
      await swipeService.linkFixturesToMatchday(matchday.id, fixtureIds);

      // Set deadline to first kickoff time
      const firstFixture = fixtures.find(f => getMatchdayDate(f.date) === date);
      if (firstFixture) {
        await swipeService.updateMatchdayDeadline(matchday.id, firstFixture.date);
      }
    }
  };

  const handleCalculatePoints = async (challengeId: string) => {
    setIsLoading(true);
    try {
      // Call edge function to calculate points for all fixtures in challenge
      const { data, error } = await supabase.functions.invoke('calculate-swipe-points', {
        body: { challengeId },
      });

      if (error) throw error;

      addToast(`Points calculated: ${data.updatedPredictions} predictions updated`, 'success');
    } catch (err: any) {
      console.error('Error calculating points:', err);
      addToast(err.message || 'Failed to calculate points', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (challengeId: string, newStatus: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('challenges')
        .update({ status: newStatus })
        .eq('id', challengeId);

      if (error) throw error;

      addToast(`Challenge status updated to ${newStatus}`, 'success');
      await loadChallenges();
    } catch (err: any) {
      console.error('Error updating status:', err);
      addToast(err.message || 'Failed to update status', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-bold text-lg text-electric-blue">Swipe Prediction Games</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 text-sm font-semibold bg-lime-glow/20 text-lime-glow px-4 py-3 rounded-lg hover:bg-lime-glow/30"
          disabled={isLoading}
        >
          {showCreateForm ? 'Cancel' : '+ Create Swipe Game'}
        </button>
      </div>

      {showCreateForm && (
        <CreateSwipeGameForm
          leagues={leagues}
          levels={levels}
          badges={badges}
          onSubmit={handleCreateChallenge}
          onCancel={() => setShowCreateForm(false)}
          isLoading={isLoading}
        />
      )}

      {/* Challenges List */}
      <div className="space-y-3">
        {challenges.length === 0 ? (
          <div className="card-base p-6 text-center text-text-disabled">
            No swipe games created yet
          </div>
        ) : (
          challenges.map(challenge => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              onCalculatePoints={handleCalculatePoints}
              onUpdateStatus={handleUpdateStatus}
              isLoading={isLoading}
            />
          ))
        )}
      </div>
    </div>
  );
};

// ============================================================================
// CREATE FORM
// ============================================================================

interface CreateSwipeGameFormProps {
  leagues: League[];
  levels: LevelOption[];
  badges: BadgeOption[];
  onSubmit: (data: {
    name: string;
    description?: string;
    league_id: string;
    start_date: string;
    end_date: string;
    entry_cost: number;
    game_type: 'betting' | 'prediction' | 'fantasy';
    tier: SwipeTier;
    duration_type: DurationKey;
    custom_entry_cost_enabled: boolean;
    minimum_level: string;
    minimum_players: number;
    maximum_players: number;
    required_badges: string[];
    requires_subscription: boolean;
  }) => void;
  onCancel: () => void;
  isLoading: boolean;
}

const CreateSwipeGameForm: React.FC<CreateSwipeGameFormProps> = ({
  leagues,
  levels,
  badges,
  onSubmit,
  onCancel,
  isLoading,
}) => {
  const today = useMemo(() => new Date().toISOString().split('T')[0], [])
  const nextWeek = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  }, [])

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [leagueId, setLeagueId] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(nextWeek)
  const [gameType, setGameType] = useState<'betting' | 'prediction' | 'fantasy'>('prediction')
  const [tier, setTier] = useState<SwipeTier>(DEFAULT_TIER)
  const [durationType, setDurationType] = useState<DurationKey>(DEFAULT_DURATION)
  const [customEntryEnabled, setCustomEntryEnabled] = useState(false)
  const [entryCost, setEntryCost] = useState<number>(() => computeEntryCost(DEFAULT_TIER, DEFAULT_DURATION))
  const [minimumPlayers, setMinimumPlayers] = useState<number>(0)
  const [maximumPlayers, setMaximumPlayers] = useState<number>(0)
  const [minimumLevel, setMinimumLevel] = useState<string>(DEFAULT_MIN_LEVEL)
  const [requiredBadges, setRequiredBadges] = useState<string[]>([])
  const [requiresSubscription, setRequiresSubscription] = useState(false)

  useEffect(() => {
    if (!customEntryEnabled) {
      setEntryCost(computeEntryCost(tier, durationType))
    }
  }, [tier, durationType, customEntryEnabled])

  useEffect(() => {
    if (!leagueId && leagues.length) {
      setLeagueId(leagues[0].id)
    }
  }, [leagueId, leagues])

  useEffect(() => {
    if ((!minimumLevel || minimumLevel.trim() === '') && levels.length) {
      setMinimumLevel(levels[0].name)
    }
  }, [levels, minimumLevel])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      league_id: leagueId,
      start_date: startDate,
      end_date: endDate,
      entry_cost: entryCost,
      description,
      game_type: gameType,
      tier,
      duration_type: durationType,
      custom_entry_cost_enabled: customEntryEnabled,
      minimum_level: minimumLevel,
      minimum_players: minimumPlayers,
      maximum_players: maximumPlayers,
      required_badges: requiredBadges,
      requires_subscription: requiresSubscription,
    });
  };

  const levelOptions = levels.length ? levels : [{ name: DEFAULT_MIN_LEVEL }]
  const badgeOptions = badges.map((badge) => ({ value: badge.id, label: badge.name }))

  const effectiveEntryCost = customEntryEnabled ? entryCost : computeEntryCost(tier, durationType)
  const tierLabel = (value: SwipeTier) => value.charAt(0).toUpperCase() + value.slice(1)
  const durationLabel = (value: DurationKey) => value.charAt(0).toUpperCase() + value.slice(1)

  return (
    <form onSubmit={handleSubmit} className="card-base p-4 space-y-3">
      <h3 className="font-bold text-text-primary">Create New Swipe Game</h3>

      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-1">
          Game Name
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g., Champions League November 2025"
          className="w-full p-2 bg-navy-accent text-text-primary rounded-lg text-sm border border-white/10 focus:outline-none focus:border-electric-blue"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-1">
          Description
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Short summary for the game…"
          className="w-full h-20 p-2 bg-navy-accent text-text-primary rounded-lg text-sm border border-white/10 focus:outline-none focus:border-electric-blue"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-1">
          League
        </label>
        <select
          value={leagueId}
          onChange={e => setLeagueId(e.target.value)}
          className="w-full p-2 bg-navy-accent text-text-primary rounded-lg text-sm border border-white/10 focus:outline-none focus:border-electric-blue"
          required
        >
          <option value="">Select a league...</option>
          {leagues.map(league => (
            <option key={league.id} value={league.id}>
              {league.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-full p-2 bg-navy-accent text-text-primary rounded-lg text-sm border border-white/10 focus:outline-none focus:border-electric-blue"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="w-full p-2 bg-navy-accent text-text-primary rounded-lg text-sm border border-white/10 focus:outline-none focus:border-electric-blue"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">
            Game Type
          </label>
          <select
            value={gameType}
            onChange={(e) => setGameType(e.target.value as typeof gameType)}
            className="w-full p-2 bg-navy-accent text-text-primary rounded-lg text-sm border border-white/10 focus:outline-none focus:border-electric-blue"
          >
            <option value="betting">Betting</option>
            <option value="prediction">Prediction</option>
            <option value="fantasy">Fantasy</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">
            Tier
          </label>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as SwipeTier)}
            className="w-full p-2 bg-navy-accent text-text-primary rounded-lg text-sm border border-white/10 focus:outline-none focus:border-electric-blue"
          >
            {(['amateur', 'master', 'apex'] as SwipeTier[]).map((option) => (
              <option key={option} value={option}>
                {tierLabel(option)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">
            Duration
          </label>
          <select
            value={durationType}
            onChange={(e) => setDurationType(e.target.value as DurationKey)}
            className="w-full p-2 bg-navy-accent text-text-primary rounded-lg text-sm border border-white/10 focus:outline-none focus:border-electric-blue"
          >
            {(['flash', 'series', 'season'] as DurationKey[]).map((option) => (
              <option key={option} value={option}>
                {durationLabel(option)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-1">
          Entry Cost (Coins)
        </label>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <input
              type="number"
              value={effectiveEntryCost}
              onChange={e => setEntryCost(parseInt(e.target.value) || 0)}
              className="w-full p-2 bg-navy-accent text-text-primary rounded-lg text-sm border border-white/10 focus:outline-none focus:border-electric-blue disabled:bg-navy-accent"
              min="0"
              disabled={!customEntryEnabled}
              required
            />
            {!customEntryEnabled && (
              <p className="text-xs text-text-disabled mt-1">
                Auto: {tierLabel(tier)} × {durationLabel(durationType)} ({SWIPE_TIER_COSTS[tier].base.toLocaleString()} x {SWIPE_TIER_COSTS[tier].multipliers[durationType]})
              </p>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={customEntryEnabled}
              onChange={(e) => setCustomEntryEnabled(e.target.checked)}
              className="accent-electric-blue"
            />
            Override
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">
            Minimum Players
          </label>
          <input
            type="number"
            value={minimumPlayers || ''}
            onChange={(e) => setMinimumPlayers(Math.max(0, parseInt(e.target.value) || 0))}
            placeholder="0 = no minimum"
            className="w-full p-2 bg-navy-accent text-text-primary rounded-lg text-sm border border-white/10 focus:outline-none focus:border-electric-blue"
            min="0"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">
            Maximum Players
          </label>
          <input
            type="number"
            value={maximumPlayers || ''}
            onChange={(e) => setMaximumPlayers(Math.max(0, parseInt(e.target.value) || 0))}
            placeholder="0 = unlimited"
            className="w-full p-2 bg-navy-accent text-text-primary rounded-lg text-sm border border-white/10 focus:outline-none focus:border-electric-blue"
            min="0"
          />
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-text-secondary">Access Conditions</h4>
        <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
          <input
            type="checkbox"
            checked={requiresSubscription}
            onChange={(e) => setRequiresSubscription(e.target.checked)}
            className="accent-electric-blue"
          />
          Subscriber Only
        </label>
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">
            Minimum Level
          </label>
          <select
            value={minimumLevel}
            onChange={(e) => setMinimumLevel(e.target.value)}
            className="w-full p-2 bg-navy-accent text-text-primary rounded-lg text-sm border border-white/10 focus:outline-none focus:border-electric-blue"
          >
            {levelOptions.map((level) => (
              <option key={level.name} value={level.name}>
                {level.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">
            Required Badges
          </label>
          <MultiSelect
            options={badgeOptions}
            selectedValues={requiredBadges}
            onChange={(values) => setRequiredBadges(values)}
            placeholder="Select badges..."
          />
        </div>
      </div>

      <CollapsibleSummary
        tier={tier}
        duration={durationType}
        cost={effectiveEntryCost}
        minimumLevel={minimumLevel}
        subscription={requiresSubscription}
        dateRange={{ start: startDate, end: endDate }}
        players={{ min: minimumPlayers, max: maximumPlayers }}
      />

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 bg-navy-accent text-text-secondary rounded-lg font-semibold hover:bg-white/10"
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 py-2 bg-electric-blue text-white rounded-lg font-semibold hover:bg-electric-blue/80 disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? 'Creating...' : 'Create Game'}
        </button>
      </div>

      <p className="text-xs text-text-disabled">
        💡 Matchdays will be automatically generated from fixtures in the selected date range
      </p>
    </form>
  );
};

const CollapsibleSummary: React.FC<{
  tier: SwipeTier
  duration: DurationKey
  cost: number
  minimumLevel: string
  subscription: boolean
  dateRange: { start: string; end: string }
  players: { min: number; max: number }
}> = ({ tier, duration, cost, minimumLevel, subscription, dateRange, players }) => {
  const [open, setOpen] = useState(false)
  const formattedDuration = duration.charAt(0).toUpperCase() + duration.slice(1)

  return (
    <div className="border-t border-disabled/50 pt-3">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between text-sm font-semibold text-text-secondary"
      >
        Quick Summary
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-text-secondary">
          <div className="bg-navy-accent rounded-lg p-3">
            <p className="font-semibold text-text-primary mb-1">Game</p>
            <p>Tier: {tier.charAt(0).toUpperCase() + tier.slice(1)}</p>
            <p>Duration: {formattedDuration}</p>
            <p>Cost: {cost.toLocaleString()} coins</p>
          </div>
          <div className="bg-navy-accent rounded-lg p-3">
            <p className="font-semibold text-text-primary mb-1">Eligibility</p>
            <p>Minimum level: {minimumLevel}</p>
            <p>Subscription: {subscription ? 'Required' : 'Optional'}</p>
            <p>
              Players: {players.min || '0'} - {players.max || '∞'}
            </p>
          </div>
          <div className="bg-navy-accent rounded-lg p-3 col-span-2">
            <p className="font-semibold text-text-primary mb-1">Timeline</p>
            <p>
              {new Date(dateRange.start).toLocaleDateString()} → {new Date(dateRange.end).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function computeEntryCost(tier: SwipeTier, duration: DurationKey): number {
  const tierConfig = SWIPE_TIER_COSTS[tier]
  return tierConfig.base * (tierConfig.multipliers[duration] ?? 1)
}

// ============================================================================
// CHALLENGE CARD
// ============================================================================

interface ChallengeCardProps {
  challenge: Challenge;
  onCalculatePoints: (challengeId: string) => void;
  onUpdateStatus: (challengeId: string, newStatus: string) => void;
  isLoading: boolean;
}

const ChallengeCard: React.FC<ChallengeCardProps> = ({
  challenge,
  onCalculatePoints,
  onUpdateStatus,
  isLoading,
}) => {
  const statusColors: Record<string, string> = {
    upcoming: 'bg-blue-500/20 text-blue-400',
    active: 'bg-lime-glow/20 text-lime-glow',
    finished: 'bg-gray-500/20 text-gray-400',
  };

  const statusColor = statusColors[challenge.status] || 'bg-gray-500/20 text-gray-400';

  return (
    <div className="card-base p-4 space-y-3">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="font-bold text-text-primary">{challenge.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            {challenge.league && (
              <div className="flex items-center gap-1">
                <img src={challenge.league.logo} alt="" className="w-4 h-4" />
                <span className="text-xs text-text-secondary">{challenge.league.name}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-text-disabled">
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {new Date(challenge.start_date).toLocaleDateString()} -{' '}
              {new Date(challenge.end_date).toLocaleDateString()}
            </span>
            <span className="flex items-center gap-1">
              <Coins size={12} />
              {challenge.entry_cost} coins
            </span>
          </div>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusColor}`}>
          {challenge.status}
        </span>
      </div>

      <div className="flex gap-2 pt-2 border-t border-white/5">
        {challenge.status === 'upcoming' && (
          <button
            onClick={() => onUpdateStatus(challenge.id, 'active')}
            className="flex items-center gap-1 text-xs font-semibold bg-lime-glow/20 text-lime-glow px-3 py-2 rounded-lg hover:bg-lime-glow/30"
            disabled={isLoading}
          >
            <Play size={14} /> Start Game
          </button>
        )}

        {challenge.status === 'active' && (
          <>
            <button
              onClick={() => onCalculatePoints(challenge.id)}
              className="flex items-center gap-1 text-xs font-semibold bg-electric-blue/20 text-electric-blue px-3 py-2 rounded-lg hover:bg-electric-blue/30"
              disabled={isLoading}
            >
              <RefreshCw size={14} /> Calculate Points
            </button>
            <button
              onClick={() => onUpdateStatus(challenge.id, 'finished')}
              className="flex items-center gap-1 text-xs font-semibold bg-hot-red/20 text-hot-red px-3 py-2 rounded-lg hover:bg-hot-red/30"
              disabled={isLoading}
            >
              <Square size={14} /> End Game
            </button>
          </>
        )}

        {challenge.status === 'finished' && (
          <button
            onClick={() => onCalculatePoints(challenge.id)}
            className="flex items-center gap-1 text-xs font-semibold bg-gray-500/20 text-gray-400 px-3 py-2 rounded-lg hover:bg-gray-500/30"
            disabled={isLoading}
          >
            <Trophy size={14} /> Recalculate Final Scores
          </button>
        )}
      </div>
    </div>
  );
};
