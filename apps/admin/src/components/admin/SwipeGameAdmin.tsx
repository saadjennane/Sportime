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
import { Play, Square, RefreshCw, Calendar, Trophy, Coins, ChevronDown, Edit3, Trash2, Filter, SortAsc, SortDesc, Users, X, Archive, RotateCcw, CheckSquare } from 'lucide-react'
import { supabase } from '../../services/supabase'
import * as swipeService from '../../services/swipeGameService'
import { MultiSelect } from './MultiSelect'
import { getMatchdayDate } from '../../features/swipe/swipeMappers';

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

// Helper to extract round number from "Regular Season - 14" -> "J14"
function extractRoundNumber(round: string): string {
  const match = round.match(/\d+/)
  return match ? `J${match[0]}` : round
}

// Helper to format date for display
function formatMatchDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

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
  description?: string;
  start_date: string;
  end_date: string;
  entry_cost: number;
  status: string;
  game_type: string;
  tier?: string;
  participants_count: number;
  league?: League;
}

// Filter and Sort types
type FilterStatus = 'all' | 'draft' | 'scheduled' | 'upcoming' | 'active' | 'finished';
type FilterGameType = 'all' | 'betting' | 'prediction' | 'fantasy';
type FilterTier = 'all' | 'amateur' | 'master' | 'apex';
type SortField = 'date' | 'players';
type SortOrder = 'asc' | 'desc';

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
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);

  // Filter states
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterGameType, setFilterGameType] = useState<FilterGameType>('all');
  const [filterTier, setFilterTier] = useState<FilterTier>('all');
  const [filterLeague, setFilterLeague] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Sort states
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Show archived toggle
  const [showArchived, setShowArchived] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Load leagues
  useEffect(() => {
    loadLeagues();
    loadChallenges();
    loadLevels()
    loadBadges()
  }, []);

  // Reload challenges when showArchived changes
  useEffect(() => {
    loadChallenges();
  }, [showArchived]);

  const loadLeagues = async () => {
    try {
      // Load from 'fb_leagues' table (renamed from leagues)
      const { data, error } = await supabase
        .from('fb_leagues')
        .select('id, name, logo')
        .order('name')

      if (error) throw error

      setLeagues(
        (data ?? []).map((league) => ({
          id: league.id, // Already a UUID, no need to convert to String
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
      // Step 1: Load challenges (filter archived based on toggle)
      let query = supabase
        .from('challenges')
        .select('id, name, description, start_date, end_date, entry_cost, status, game_type')
        .in('game_type', ['prediction', 'betting', 'fantasy']);

      // Note: 'archived' status doesn't exist in challenge_status_enum
      // Load all challenges without status filter

      const { data: challengesData, error: challengesError } = await query
        .order('start_date', { ascending: false });

      if (challengesError) throw challengesError;

      if (!challengesData || challengesData.length === 0) {
        setChallenges([]);
        return;
      }

      // Step 2: Load challenge_leagues mappings
      const challengeIds = challengesData.map(c => c.id);
      const { data: leagueMappings, error: mappingsError } = await supabase
        .from('challenge_leagues')
        .select('challenge_id, league_id')
        .in('challenge_id', challengeIds);

      if (mappingsError) throw mappingsError;

      // Step 3: Get unique league IDs
      const leagueIds = [...new Set(leagueMappings?.map(m => m.league_id) || [])];

      // Step 4: Load leagues (only if we have league IDs)
      let leaguesData: any[] = [];
      if (leagueIds.length > 0) {
        const { data, error: leaguesError } = await supabase
          .from('fb_leagues')
          .select('id, name, logo')
          .in('id', leagueIds);

        if (leaguesError) throw leaguesError;
        leaguesData = data || [];
      }

      // Step 5: Load participants count for each challenge
      const { data: participantsCounts, error: participantsError } = await supabase
        .from('challenge_participants')
        .select('challenge_id')
        .in('challenge_id', challengeIds);

      if (participantsError) throw participantsError;

      // Count participants per challenge
      const participantsCountMap = new Map<string, number>();
      (participantsCounts || []).forEach(p => {
        participantsCountMap.set(p.challenge_id, (participantsCountMap.get(p.challenge_id) || 0) + 1);
      });

      // Step 6: Load tier configs (tier can be in config_type='tier' OR in config_type='swipe' inside config_data)
      const { data: tierConfigs, error: configsError } = await supabase
        .from('challenge_configs')
        .select('challenge_id, config_type, config_data')
        .in('config_type', ['tier', 'swipe'])
        .in('challenge_id', challengeIds);

      if (configsError) throw configsError;

      // Create tier map - check both config_type='tier' and config_type='swipe'
      const tierMap = new Map<string, string>();
      (tierConfigs || []).forEach((cfg: any) => {
        // If we already have a tier for this challenge, skip
        if (tierMap.has(cfg.challenge_id)) return;
        // Extract tier from config_data (works for both 'tier' and 'swipe' config types)
        const tier = cfg.config_data?.tier;
        if (tier) {
          tierMap.set(cfg.challenge_id, tier);
        }
      });

      // Step 7: Create a map of challenge_id -> league
      const leagueMap = new Map(leaguesData.map(l => [l.id, l]));
      const challengeLeagueMap = new Map(
        leagueMappings?.map(m => [m.challenge_id, leagueMap.get(m.league_id)]) || []
      );

      // Step 8: Transform data with league information and participant counts
      const transformed = challengesData.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        start_date: c.start_date,
        end_date: c.end_date,
        entry_cost: c.entry_cost,
        status: c.status,
        game_type: c.game_type,
        tier: tierMap.get(c.id) || null,
        participants_count: participantsCountMap.get(c.id) || 0,
        league: challengeLeagueMap.get(c.id),
      }));

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
    period_type: 'matchdays' | 'calendar';
    starting_round?: string;
    number_of_rounds?: number;
  }) => {
    setIsLoading(true);
    try {
      // Validate league is selected
      if (!formData.league_id || formData.league_id === '') {
        addToast('Please select a league', 'error');
        setIsLoading(false);
        return;
      }

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
        period_type: formData.period_type,
      });

      addToast('Challenge created successfully!', 'success');

      // 2. Auto-generate matchdays and link fixtures
      await generateMatchdays(
        challenge.id,
        formData.league_id,
        formData.start_date,
        formData.end_date,
        formData.period_type,
        formData.starting_round,
        formData.number_of_rounds
      );

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
    endDate: string,
    periodType: 'matchdays' | 'calendar' = 'matchdays',
    startingRound?: string,
    numberOfRounds?: number
  ) => {
    if (periodType === 'calendar') {
      // CALENDAR MODE: One matchday per calendar day, using date range
      const { data: fixtures, error } = await supabase
        .from('fb_fixtures')
        .select('id, date, league_id')
        .eq('league_id', leagueId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date');

      if (error) throw error;

      const start = new Date(startDate);
      const end = new Date(endDate);
      let currentDate = new Date(start);

      while (currentDate <= end) {
        const dateStr = currentDate.toISOString().split('T')[0];

        // Find fixtures for this day
        const fixturesForDay = fixtures?.filter(f =>
          getMatchdayDate(f.date) === dateStr
        ) || [];

        // Create matchday even if no fixtures
        const matchday = await swipeService.getOrCreateMatchday(challengeId, dateStr);

        // Link fixtures if any
        if (fixturesForDay.length > 0) {
          await swipeService.linkFixturesToMatchday(matchday.id, fixturesForDay.map(f => f.id));

          // Set deadline to first kickoff time
          const firstFixture = fixturesForDay[0];
          if (firstFixture) {
            await swipeService.updateMatchdayDeadline(matchday.id, firstFixture.date);
          }
        } else {
          // No fixtures, set deadline to end of day
          await swipeService.updateMatchdayDeadline(matchday.id, `${dateStr}T23:59:59Z`);
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else {
      // MATCHDAYS MODE: Group by round (championship gameweek)
      // First, get all unique rounds for this league in date range
      const { data: allFixtures, error: fixturesError } = await supabase
        .from('fb_fixtures')
        .select('id, date, round')
        .eq('league_id', leagueId)
        .gte('date', new Date().toISOString())
        .order('date');

      if (fixturesError) throw fixturesError;

      if (!allFixtures || allFixtures.length === 0) {
        throw new Error('No fixtures found for the selected league');
      }

      // Get unique rounds sorted by first match date
      const roundsMap = new Map<string, { round: string, firstMatch: string, fixtures: typeof allFixtures }>();
      for (const fixture of allFixtures) {
        if (!fixture.round) continue;
        const existing = roundsMap.get(fixture.round);
        if (!existing) {
          roundsMap.set(fixture.round, { round: fixture.round, firstMatch: fixture.date, fixtures: [fixture] });
        } else {
          existing.fixtures.push(fixture);
        }
      }

      const sortedRounds = [...roundsMap.values()].sort((a, b) =>
        new Date(a.firstMatch).getTime() - new Date(b.firstMatch).getTime()
      );

      // If startingRound is provided, find which rounds to use
      let roundsToCreate = sortedRounds;
      if (startingRound && numberOfRounds) {
        const startIdx = sortedRounds.findIndex(r => r.round === startingRound);
        if (startIdx >= 0) {
          roundsToCreate = sortedRounds.slice(startIdx, startIdx + numberOfRounds);
        }
      }

      if (roundsToCreate.length === 0) {
        throw new Error('No rounds found for the selected criteria');
      }

      // Create one matchday per round
      for (const roundData of roundsToCreate) {
        const firstMatchDate = roundData.fixtures.sort((a, b) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
        )[0]?.date;

        if (!firstMatchDate) continue;

        const dateStr = getMatchdayDate(firstMatchDate);
        const matchday = await swipeService.getOrCreateMatchday(challengeId, dateStr);
        await swipeService.linkFixturesToMatchday(matchday.id, roundData.fixtures.map(f => f.id));
        await swipeService.updateMatchdayDeadline(matchday.id, firstMatchDate);
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

  const handleDeleteChallenge = async (challengeId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce jeu ? Cette action est irréversible.')) {
      return;
    }

    setIsLoading(true);
    try {
      // Supprimer dans l'ordre pour respecter les contraintes FK
      // 1. Supprimer les predictions
      await supabase.from('swipe_predictions').delete().eq('challenge_id', challengeId);

      // 2. Récupérer les matchdays pour supprimer les fixtures liées
      const { data: matchdays } = await supabase
        .from('challenge_matchdays')
        .select('id')
        .eq('challenge_id', challengeId);

      if (matchdays?.length) {
        const matchdayIds = matchdays.map(m => m.id);
        // 3. Supprimer les matchday_fixtures
        await supabase.from('matchday_fixtures').delete().in('matchday_id', matchdayIds);
        // 4. Supprimer les matchday_participants
        await supabase.from('matchday_participants').delete().in('matchday_id', matchdayIds);
      }

      // 5. Supprimer les matchdays
      await supabase.from('challenge_matchdays').delete().eq('challenge_id', challengeId);

      // 6. Supprimer les participants
      await supabase.from('challenge_participants').delete().eq('challenge_id', challengeId);

      // 7. Supprimer les challenge_leagues
      await supabase.from('challenge_leagues').delete().eq('challenge_id', challengeId);

      // 8. Supprimer les challenge_configs
      await supabase.from('challenge_configs').delete().eq('challenge_id', challengeId);

      // 9. Supprimer le challenge lui-même
      const { error } = await supabase.from('challenges').delete().eq('id', challengeId);

      if (error) throw error;

      addToast('Challenge supprimé avec succès', 'success');
      await loadChallenges();
    } catch (err: any) {
      console.error('Error deleting challenge:', err);
      addToast(err.message || 'Erreur lors de la suppression', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleArchiveChallenge = async (challengeId: string) => {
    if (!confirm('Archiver ce jeu ? Il ne sera plus visible pour les utilisateurs mais les données seront conservées.')) {
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('challenges')
        .update({ status: 'archived' })
        .eq('id', challengeId);

      if (error) throw error;

      addToast('Challenge archivé avec succès', 'success');
      await loadChallenges();
    } catch (err: any) {
      console.error('Error archiving challenge:', err);
      addToast(err.message || 'Erreur lors de l\'archivage', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreChallenge = async (challengeId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('challenges')
        .update({ status: 'upcoming' })
        .eq('id', challengeId);

      if (error) throw error;

      addToast('Challenge restauré avec succès', 'success');
      await loadChallenges();
    } catch (err: any) {
      console.error('Error restoring challenge:', err);
      addToast(err.message || 'Erreur lors de la restauration', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditChallenge = (challenge: Challenge) => {
    // Only allow editing draft or scheduled challenges
    if (challenge.status !== 'draft' && challenge.status !== 'scheduled') {
      addToast('Seuls les jeux en draft ou scheduled peuvent être modifiés', 'error');
      return;
    }
    setEditingChallenge(challenge);
    setShowCreateForm(true);
  };

  const handleCancelEdit = () => {
    setEditingChallenge(null);
    setShowCreateForm(false);
  };

  // Filter and sort challenges
  const filteredAndSortedChallenges = useMemo(() => {
    let result = [...challenges];

    // Apply filters
    if (filterStatus !== 'all') {
      result = result.filter(c => c.status === filterStatus);
    }
    if (filterGameType !== 'all') {
      result = result.filter(c => c.game_type === filterGameType);
    }
    if (filterTier !== 'all') {
      result = result.filter(c => c.tier === filterTier);
    }
    if (filterLeague !== 'all') {
      result = result.filter(c => c.league?.id === filterLeague);
    }

    // Apply sorting
    result.sort((a, b) => {
      if (sortField === 'date') {
        const dateA = new Date(a.start_date).getTime();
        const dateB = new Date(b.start_date).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      } else {
        // players
        return sortOrder === 'asc'
          ? a.participants_count - b.participants_count
          : b.participants_count - a.participants_count;
      }
    });

    return result;
  }, [challenges, filterStatus, filterGameType, filterTier, filterLeague, sortField, sortOrder]);

  // Check if any filter is active
  const hasActiveFilters = filterStatus !== 'all' || filterGameType !== 'all' || filterTier !== 'all' || filterLeague !== 'all';

  const clearAllFilters = () => {
    setFilterStatus('all');
    setFilterGameType('all');
    setFilterTier('all');
    setFilterLeague('all');
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Bulk selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAndSortedChallenges.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSortedChallenges.map(c => c.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const confirmed = window.confirm(`Are you sure you want to permanently delete ${selectedIds.size} game(s)? This action cannot be undone.`);
    if (!confirmed) return;

    setIsLoading(true);
    try {
      const ids = Array.from(selectedIds);

      // Delete challenge_matchdays first (foreign key constraint)
      await supabase
        .from('challenge_matchdays')
        .delete()
        .in('challenge_id', ids);

      // Delete challenge_configs
      await supabase
        .from('challenge_configs')
        .delete()
        .in('challenge_id', ids);

      // Delete challenge_entries
      await supabase
        .from('challenge_entries')
        .delete()
        .in('challenge_id', ids);

      // Delete challenges
      const { error } = await supabase
        .from('challenges')
        .delete()
        .in('id', ids);

      if (error) throw error;

      addToast(`${selectedIds.size} game(s) deleted successfully`, 'success');
      setSelectedIds(new Set());
      loadChallenges();
    } catch (error) {
      console.error('Bulk delete error:', error);
      addToast('Failed to delete some games', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkArchive = async () => {
    if (selectedIds.size === 0) return;

    const confirmed = window.confirm(`Archive ${selectedIds.size} game(s)? Archived games can be restored later.`);
    if (!confirmed) return;

    setIsLoading(true);
    try {
      const ids = Array.from(selectedIds);

      // Update status to 'finished' (since 'archived' doesn't exist in enum)
      // We'll use a metadata flag or just change status
      const { error } = await supabase
        .from('challenges')
        .update({ status: 'finished' })
        .in('id', ids);

      if (error) throw error;

      addToast(`${selectedIds.size} game(s) archived successfully`, 'success');
      setSelectedIds(new Set());
      loadChallenges();
    } catch (error) {
      console.error('Bulk archive error:', error);
      addToast('Failed to archive some games', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-bold text-lg text-electric-blue">Swipe Prediction Games</h2>
        <button
          onClick={() => {
            setEditingChallenge(null);
            setShowCreateForm(!showCreateForm);
          }}
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
          onCancel={handleCancelEdit}
          isLoading={isLoading}
          editingChallenge={editingChallenge}
        />
      )}

      {/* Filters and Sort Bar */}
      <div className="card-base p-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg ${
              hasActiveFilters
                ? 'bg-electric-blue/20 text-electric-blue'
                : 'bg-navy-accent text-text-secondary hover:bg-white/10'
            }`}
          >
            <Filter size={16} />
            Filters
            {hasActiveFilters && (
              <span className="bg-electric-blue text-white text-xs px-1.5 py-0.5 rounded-full">
                {[filterStatus, filterGameType, filterTier, filterLeague].filter(f => f !== 'all').length}
              </span>
            )}
          </button>

          {/* Sort Buttons */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-disabled">Sort by:</span>
            <button
              onClick={() => toggleSort('date')}
              className={`flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg ${
                sortField === 'date'
                  ? 'bg-electric-blue/20 text-electric-blue'
                  : 'bg-navy-accent text-text-secondary hover:bg-white/10'
              }`}
            >
              <Calendar size={14} />
              Date
              {sortField === 'date' && (sortOrder === 'asc' ? <SortAsc size={12} /> : <SortDesc size={12} />)}
            </button>
            <button
              onClick={() => toggleSort('players')}
              className={`flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg ${
                sortField === 'players'
                  ? 'bg-electric-blue/20 text-electric-blue'
                  : 'bg-navy-accent text-text-secondary hover:bg-white/10'
              }`}
            >
              <Users size={14} />
              Players
              {sortField === 'players' && (sortOrder === 'asc' ? <SortAsc size={12} /> : <SortDesc size={12} />)}
            </button>
          </div>

          {/* Show Archived Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="accent-electric-blue"
            />
            <span className="text-xs text-text-secondary flex items-center gap-1">
              <Archive size={12} />
              {showArchived ? 'Showing Archived' : 'Show Archived'}
            </span>
          </label>

          {/* Results count */}
          <span className="text-xs text-text-disabled">
            {filteredAndSortedChallenges.length} / {challenges.length} games
          </span>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="pt-3 border-t border-white/5 space-y-3">
            <div className="grid grid-cols-4 gap-3">
              {/* Status Filter */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                  className="w-full p-2 bg-navy-accent text-text-primary rounded-lg text-sm border border-white/10 focus:outline-none focus:border-electric-blue"
                >
                  <option value="all">All</option>
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="active">Active</option>
                  <option value="finished">Finished</option>
                </select>
              </div>

              {/* Game Type Filter */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Type</label>
                <select
                  value={filterGameType}
                  onChange={(e) => setFilterGameType(e.target.value as FilterGameType)}
                  className="w-full p-2 bg-navy-accent text-text-primary rounded-lg text-sm border border-white/10 focus:outline-none focus:border-electric-blue"
                >
                  <option value="all">All</option>
                  <option value="betting">Betting</option>
                  <option value="prediction">Prediction</option>
                  <option value="fantasy">Fantasy</option>
                </select>
              </div>

              {/* Tier Filter */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Tier</label>
                <select
                  value={filterTier}
                  onChange={(e) => setFilterTier(e.target.value as FilterTier)}
                  className="w-full p-2 bg-navy-accent text-text-primary rounded-lg text-sm border border-white/10 focus:outline-none focus:border-electric-blue"
                >
                  <option value="all">All</option>
                  <option value="amateur">Amateur</option>
                  <option value="master">Master</option>
                  <option value="apex">Apex</option>
                </select>
              </div>

              {/* League Filter */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">League</label>
                <select
                  value={filterLeague}
                  onChange={(e) => setFilterLeague(e.target.value)}
                  className="w-full p-2 bg-navy-accent text-text-primary rounded-lg text-sm border border-white/10 focus:outline-none focus:border-electric-blue"
                >
                  <option value="all">All</option>
                  {leagues.map(league => (
                    <option key={league.id} value={league.id}>{league.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1 text-xs text-hot-red hover:text-hot-red/80"
              >
                <X size={14} />
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {filteredAndSortedChallenges.length > 0 && (
        <div className="card-base p-3 flex items-center gap-4">
          {/* Select All Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedIds.size === filteredAndSortedChallenges.length && filteredAndSortedChallenges.length > 0}
              onChange={toggleSelectAll}
              className="w-4 h-4 accent-electric-blue"
            />
            <span className="text-sm text-text-secondary">
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
            </span>
          </label>

          {/* Bulk Action Buttons */}
          {selectedIds.size > 0 && (
            <>
              <div className="h-6 w-px bg-white/10" />
              <button
                onClick={handleBulkArchive}
                disabled={isLoading}
                className="flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 disabled:opacity-50"
              >
                <Archive size={16} />
                Archive ({selectedIds.size})
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isLoading}
                className="flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg bg-hot-red/20 text-hot-red hover:bg-hot-red/30 disabled:opacity-50"
              >
                <Trash2 size={16} />
                Delete ({selectedIds.size})
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary"
              >
                <X size={16} />
                Clear selection
              </button>
            </>
          )}
        </div>
      )}

      {/* Challenges List */}
      <div className="space-y-3">
        {filteredAndSortedChallenges.length === 0 ? (
          <div className="card-base p-6 text-center text-text-disabled">
            {challenges.length === 0 ? 'No swipe games created yet' : 'No games match the current filters'}
          </div>
        ) : (
          filteredAndSortedChallenges.map(challenge => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              isSelected={selectedIds.has(challenge.id)}
              onToggleSelect={() => toggleSelectOne(challenge.id)}
              onCalculatePoints={handleCalculatePoints}
              onUpdateStatus={handleUpdateStatus}
              onDelete={handleDeleteChallenge}
              onEdit={handleEditChallenge}
              onArchive={handleArchiveChallenge}
              onRestore={handleRestoreChallenge}
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
    period_type: 'matchdays' | 'calendar';
  }) => void;
  onCancel: () => void;
  isLoading: boolean;
  editingChallenge?: Challenge | null;
}

const CreateSwipeGameForm: React.FC<CreateSwipeGameFormProps> = ({
  leagues,
  levels,
  badges,
  onSubmit,
  onCancel,
  isLoading,
  editingChallenge,
}) => {
  const today = useMemo(() => new Date().toISOString().split('T')[0], [])
  const nextWeek = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  }, [])

  // Initialize state with editing values if provided
  const [name, setName] = useState(editingChallenge?.name || '')
  const [description, setDescription] = useState(editingChallenge?.description || '')
  const [leagueId, setLeagueId] = useState(editingChallenge?.league?.id || '')
  const [startDate, setStartDate] = useState(editingChallenge?.start_date?.split('T')[0] || today)
  const [endDate, setEndDate] = useState(editingChallenge?.end_date?.split('T')[0] || nextWeek)
  const [gameType, setGameType] = useState<'betting' | 'prediction' | 'fantasy'>(
    (editingChallenge?.game_type as 'betting' | 'prediction' | 'fantasy') || 'prediction'
  )
  const [tier, setTier] = useState<SwipeTier>((editingChallenge?.tier as SwipeTier) || DEFAULT_TIER)
  const [durationType, setDurationType] = useState<DurationKey>(DEFAULT_DURATION)
  const [customEntryEnabled, setCustomEntryEnabled] = useState(!!editingChallenge)
  const [entryCost, setEntryCost] = useState<number>(editingChallenge?.entry_cost || computeEntryCost(DEFAULT_TIER, DEFAULT_DURATION))
  const [minimumPlayers, setMinimumPlayers] = useState<number>(0)
  const [maximumPlayers, setMaximumPlayers] = useState<number>(0)
  const [minimumLevel, setMinimumLevel] = useState<string>(DEFAULT_MIN_LEVEL)
  const [requiredBadges, setRequiredBadges] = useState<string[]>([])
  const [requiresSubscription, setRequiresSubscription] = useState(false)
  const [periodType, setPeriodType] = useState<'matchdays' | 'calendar'>('matchdays')
  const [periodInfo, setPeriodInfo] = useState<{ type: string; count: number } | null>(null)

  // Matchdays mode - round selection
  const [availableRounds, setAvailableRounds] = useState<{round: string, firstMatch: string, lastMatch: string, fixtureCount: number}[]>([])
  const [startingRound, setStartingRound] = useState<string>('')
  const [numberOfRounds, setNumberOfRounds] = useState<number>(1)
  const [publishMode, setPublishMode] = useState<'now' | 'later'>('now')
  const [publishDate, setPublishDate] = useState('')
  const [publishTime, setPublishTime] = useState('09:00')
  const [isRewardsOpen, setIsRewardsOpen] = useState(false)

  const isEditing = !!editingChallenge

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

  // Load available rounds when league changes (for matchdays mode)
  useEffect(() => {
    if (!leagueId) {
      setAvailableRounds([])
      return
    }

    const loadAvailableRounds = async () => {
      try {
        const { data, error } = await supabase
          .from('fb_fixtures')
          .select('round, date')
          .eq('league_id', leagueId)
          .gte('date', new Date().toISOString())
          .order('date')

        if (error) throw error

        // Group by round and calculate first/last match + count
        const roundsMap = new Map<string, {round: string, firstMatch: string, lastMatch: string, fixtureCount: number}>()
        data?.forEach((f: {round: string, date: string}) => {
          if (!f.round) return
          const existing = roundsMap.get(f.round)
          if (!existing) {
            roundsMap.set(f.round, { round: f.round, firstMatch: f.date, lastMatch: f.date, fixtureCount: 1 })
          } else {
            existing.fixtureCount++
            if (f.date > existing.lastMatch) existing.lastMatch = f.date
          }
        })

        // Sort by first match date
        const sorted = [...roundsMap.values()].sort((a, b) =>
          new Date(a.firstMatch).getTime() - new Date(b.firstMatch).getTime()
        )

        setAvailableRounds(sorted)
        if (sorted.length > 0 && !startingRound) {
          setStartingRound(sorted[0].round)
        }
      } catch (error) {
        console.error('Error loading available rounds:', error)
        setAvailableRounds([])
      }
    }

    loadAvailableRounds()
  }, [leagueId])

  // Calculate period count when dates, league, or period type changes
  useEffect(() => {
    const calculatePeriodCount = async () => {
      if (!startDate || !endDate || !leagueId) {
        setPeriodInfo(null)
        return
      }

      try {
        if (periodType === 'calendar') {
          // Calculate calendar days
          const start = new Date(startDate)
          const end = new Date(endDate)
          const diffTime = Math.abs(end.getTime() - start.getTime())
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
          setPeriodInfo({ type: 'calendar', count: diffDays })
        } else {
          // Calculate matchdays based on fixtures
          const { data: fixtures, error } = await supabase
            .from('fb_fixtures')
            .select('date')
            .eq('league_id', leagueId)
            .gte('date', startDate)
            .lte('date', endDate)

          if (error) throw error

          if (fixtures && fixtures.length > 0) {
            const uniqueDates = [...new Set(fixtures.map((f: any) => f.date.split('T')[0]))]
            setPeriodInfo({ type: 'matchdays', count: uniqueDates.length })
          } else {
            setPeriodInfo({ type: 'matchdays', count: 0 })
          }
        }
      } catch (error) {
        console.error('Error calculating period count:', error)
        setPeriodInfo(null)
      }
    }

    calculatePeriodCount()
  }, [startDate, endDate, leagueId, periodType])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // For matchdays mode, calculate dates from selected rounds
    let effectiveStartDate = startDate;
    let effectiveEndDate = endDate;

    if (periodType === 'matchdays' && availableRounds.length > 0) {
      const startIdx = availableRounds.findIndex(r => r.round === startingRound);
      const selectedRounds = availableRounds.slice(startIdx, startIdx + numberOfRounds);
      if (selectedRounds.length > 0) {
        effectiveStartDate = selectedRounds[0].firstMatch.split('T')[0];
        effectiveEndDate = selectedRounds[selectedRounds.length - 1].lastMatch.split('T')[0];
      }
    }

    onSubmit({
      name,
      league_id: leagueId,
      start_date: effectiveStartDate,
      end_date: effectiveEndDate,
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
      period_type: periodType,
      // Pass round info for matchdays mode
      starting_round: periodType === 'matchdays' ? startingRound : undefined,
      number_of_rounds: periodType === 'matchdays' ? numberOfRounds : undefined,
    });
  };

  const levelOptions = levels.length ? levels : [{ name: DEFAULT_MIN_LEVEL }]
  const badgeOptions = badges.map((badge) => ({ value: badge.id, label: badge.name }))

  const effectiveEntryCost = customEntryEnabled ? entryCost : computeEntryCost(tier, durationType)
  const tierLabel = (value: SwipeTier) => value.charAt(0).toUpperCase() + value.slice(1)
  const durationLabel = (value: DurationKey) => value.charAt(0).toUpperCase() + value.slice(1)

  return (
    <form onSubmit={handleSubmit} className="card-base p-4 space-y-3">
      <h3 className="font-bold text-text-primary">
        {isEditing ? `Edit: ${editingChallenge?.name}` : 'Create New Swipe Game'}
      </h3>

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

      {/* Period Type Selection */}
      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-1">
          Period Type
        </label>
        <select
          value={periodType}
          onChange={(e) => setPeriodType(e.target.value as 'matchdays' | 'calendar')}
          className="w-full p-2 bg-navy-accent text-text-primary rounded-lg text-sm border border-white/10 focus:outline-none focus:border-electric-blue"
        >
          <option value="matchdays">Matchdays (by round/gameweek)</option>
          <option value="calendar">Calendar Days (by date range)</option>
        </select>
        <p className="text-xs text-text-disabled mt-1">
          {periodType === 'matchdays'
            ? 'Select championship rounds (e.g., J14, J15, J16...)'
            : 'One period for each calendar day from start to end'}
        </p>
      </div>

      {/* MATCHDAYS MODE - Round selection */}
      {periodType === 'matchdays' && (
        <>
          {availableRounds.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Starting Round
                  </label>
                  <select
                    value={startingRound}
                    onChange={e => {
                      setStartingRound(e.target.value)
                      // Reset number of rounds if it exceeds max
                      const startIdx = availableRounds.findIndex(r => r.round === e.target.value)
                      const maxRounds = availableRounds.length - startIdx
                      if (numberOfRounds > maxRounds) setNumberOfRounds(maxRounds)
                    }}
                    className="w-full p-2 bg-navy-accent text-text-primary rounded-lg text-sm border border-white/10 focus:outline-none focus:border-electric-blue"
                  >
                    {availableRounds.map(r => (
                      <option key={r.round} value={r.round}>
                        {extractRoundNumber(r.round)} - {formatMatchDate(r.firstMatch)} ({r.fixtureCount} matchs)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Number of Rounds
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={availableRounds.length - availableRounds.findIndex(r => r.round === startingRound)}
                    value={numberOfRounds}
                    onChange={e => setNumberOfRounds(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full p-2 bg-navy-accent text-text-primary rounded-lg text-sm border border-white/10 focus:outline-none focus:border-electric-blue"
                  />
                  <p className="text-xs text-text-disabled mt-1">
                    Max: {availableRounds.length - availableRounds.findIndex(r => r.round === startingRound)} rounds disponibles
                  </p>
                </div>
              </div>

              {/* Preview */}
              {(() => {
                const startIdx = availableRounds.findIndex(r => r.round === startingRound)
                const selectedRounds = availableRounds.slice(startIdx, startIdx + numberOfRounds)
                const endRound = selectedRounds[selectedRounds.length - 1]
                const totalFixtures = selectedRounds.reduce((sum, r) => sum + r.fixtureCount, 0)
                return (
                  <div className="bg-electric-blue/10 border border-electric-blue/20 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">⚽</div>
                      <div className="flex-1">
                        <p className="font-bold text-lg text-electric-blue">
                          {numberOfRounds} journée{numberOfRounds > 1 ? 's' : ''}
                        </p>
                        <p className="text-sm text-text-primary">
                          De {extractRoundNumber(startingRound)} à {extractRoundNumber(endRound?.round || startingRound)}
                        </p>
                        <p className="text-xs text-text-secondary">
                          Du {formatMatchDate(selectedRounds[0]?.firstMatch)} au {formatMatchDate(endRound?.lastMatch || selectedRounds[0]?.lastMatch)}
                        </p>
                        <p className="text-xs text-text-disabled mt-1">
                          {totalFixtures} matchs au total
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </>
          ) : (
            <div className="bg-hot-red/10 border border-hot-red/20 rounded-lg p-4">
              <p className="text-hot-red text-sm">
                {leagueId ? '⚠️ Aucune journée future trouvée pour cette ligue' : 'Sélectionnez une ligue pour voir les journées disponibles'}
              </p>
            </div>
          )}
        </>
      )}

      {/* CALENDAR MODE - Date range selection */}
      {periodType === 'calendar' && (
        <>
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

          {periodInfo && (
            <div className="bg-electric-blue/10 border border-electric-blue/20 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="text-3xl">📅</div>
                <div className="flex-1">
                  <p className="font-bold text-lg text-electric-blue">
                    {periodInfo.count} jours calendaires
                  </p>
                  <p className="text-xs text-text-secondary">
                    Du {new Date(startDate).toLocaleDateString('fr-FR')} au {new Date(endDate).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

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

      {/* Publishing Options */}
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Publishing Date
              </label>
              <input
                type="date"
                value={publishDate}
                onChange={(e) => setPublishDate(e.target.value)}
                className="w-full p-2 bg-navy-accent text-text-primary rounded-lg text-sm border border-white/10 focus:outline-none focus:border-electric-blue"
                min={today}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Publishing Time
              </label>
              <input
                type="time"
                value={publishTime}
                onChange={(e) => setPublishTime(e.target.value)}
                className="w-full p-2 bg-navy-accent text-text-primary rounded-lg text-sm border border-white/10 focus:outline-none focus:border-electric-blue"
              />
            </div>
            <p className="text-xs text-electric-blue col-span-2">
              Game will be <strong>Scheduled</strong> and editable until this date. Once published, users can join.
            </p>
          </div>
        )}
      </div>

      {/* Rewards Configuration */}
      <div className="border-t border-disabled/50 pt-4">
        <button
          type="button"
          onClick={() => setIsRewardsOpen(!isRewardsOpen)}
          className="w-full flex justify-between items-center"
        >
          <h4 className="text-sm font-semibold text-text-secondary">Rewards Configuration</h4>
          <ChevronDown className={`w-4 h-4 transition-transform ${isRewardsOpen ? 'rotate-180' : ''}`} />
        </button>
        {isRewardsOpen && (
          <div className="mt-4 p-3 bg-navy-accent/50 rounded-lg">
            <p className="text-xs text-text-disabled">
              Rewards are automatically configured based on Tier ({tier}) and Duration ({durationType}).
              Custom rewards configuration coming soon.
            </p>
          </div>
        )}
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
          {isLoading ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Game' : 'Create Game')}
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
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onCalculatePoints: (challengeId: string) => void;
  onUpdateStatus: (challengeId: string, newStatus: string) => void;
  onDelete: (challengeId: string) => void;
  onEdit: (challenge: Challenge) => void;
  onArchive: (challengeId: string) => void;
  onRestore: (challengeId: string) => void;
  isLoading: boolean;
}

const ChallengeCard: React.FC<ChallengeCardProps> = ({
  challenge,
  isSelected = false,
  onToggleSelect,
  onCalculatePoints,
  onUpdateStatus,
  onDelete,
  onEdit,
  onArchive,
  onRestore,
  isLoading,
}) => {
  const canEdit = challenge.status === 'draft' || challenge.status === 'scheduled';
  const isArchived = challenge.status === 'archived';
  const statusColors: Record<string, string> = {
    draft: 'bg-purple-500/20 text-purple-400',
    scheduled: 'bg-amber-500/20 text-amber-400',
    upcoming: 'bg-blue-500/20 text-blue-400',
    active: 'bg-lime-glow/20 text-lime-glow',
    finished: 'bg-gray-500/20 text-gray-400',
    archived: 'bg-gray-600/20 text-gray-500',
  };

  const tierColors: Record<string, string> = {
    amateur: 'text-green-400',
    master: 'text-blue-400',
    apex: 'text-purple-400',
  };

  const statusColor = statusColors[challenge.status] || 'bg-gray-500/20 text-gray-400';
  const tierColor = challenge.tier ? tierColors[challenge.tier] || 'text-text-secondary' : 'text-text-secondary';

  return (
    <div className={`card-base p-4 space-y-3 ${isSelected ? 'ring-2 ring-electric-blue' : ''}`}>
      <div className="flex justify-between items-start">
        {/* Selection Checkbox */}
        {onToggleSelect && (
          <label className="flex items-center mr-3 cursor-pointer" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              className="w-4 h-4 accent-electric-blue"
            />
          </label>
        )}
        <div className="flex-1">
          <h3 className="font-bold text-text-primary">{challenge.name}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {challenge.league && (
              <div className="flex items-center gap-1">
                {challenge.league.logo && <img src={challenge.league.logo} alt="" className="w-4 h-4" />}
                <span className="text-xs text-text-secondary">{challenge.league.name}</span>
              </div>
            )}
            {challenge.tier && (
              <span className={`text-xs font-semibold ${tierColor}`}>
                • {challenge.tier.charAt(0).toUpperCase() + challenge.tier.slice(1)}
              </span>
            )}
            {challenge.game_type && (
              <span className="text-xs text-text-disabled">
                • {challenge.game_type}
              </span>
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
            <span className="flex items-center gap-1">
              <Users size={12} />
              {challenge.participants_count} players
            </span>
          </div>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusColor}`}>
          {challenge.status}
        </span>
      </div>

      <div className="flex gap-2 pt-2 border-t border-white/5">
        {/* Edit - seulement pour draft/scheduled */}
        {canEdit && (
          <button
            onClick={() => onEdit(challenge)}
            className="flex items-center gap-1 text-xs font-semibold bg-amber-500/20 text-amber-400 px-3 py-2 rounded-lg hover:bg-amber-500/30"
            disabled={isLoading}
          >
            <Edit3 size={14} /> Edit
          </button>
        )}

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

        {/* Archive - disponible pour les jeux non archivés */}
        {!isArchived && (
          <button
            onClick={() => onArchive(challenge.id)}
            className="flex items-center gap-1 text-xs font-semibold bg-gray-500/20 text-gray-400 px-3 py-2 rounded-lg hover:bg-gray-500/30"
            disabled={isLoading}
          >
            <Archive size={14} /> Archive
          </button>
        )}

        {/* Restore - disponible seulement pour les jeux archivés */}
        {isArchived && (
          <button
            onClick={() => onRestore(challenge.id)}
            className="flex items-center gap-1 text-xs font-semibold bg-lime-glow/20 text-lime-glow px-3 py-2 rounded-lg hover:bg-lime-glow/30"
            disabled={isLoading}
          >
            <RotateCcw size={14} /> Restore
          </button>
        )}

        {/* Delete - toujours disponible */}
        <button
          onClick={() => onDelete(challenge.id)}
          className="flex items-center gap-1 text-xs font-semibold bg-hot-red/20 text-hot-red px-3 py-2 rounded-lg hover:bg-hot-red/30 ml-auto"
          disabled={isLoading}
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </div>
  );
};
