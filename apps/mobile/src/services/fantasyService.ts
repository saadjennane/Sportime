import {
  FantasyPlayer,
  UserFantasyTeam,
  PlayerLast10Stats,
  PlayerGameWeekStats,
  FantasyGameWeek,
  FantasyLeaderboardEntry,
} from '../types';
import {
  computePGS,
  getPlayerCategoryFromPGS,
  calculateFatigue,
  computePlayerPoints,
  computeTeamTotal,
  FANTASY_CONFIG
} from '../lib/fantasy/engine';
import { supabase } from './supabase';

// ============================================================================
// Database Row Types (from Supabase)
// ============================================================================

interface FantasyPlayerRow {
  id: string;
  api_player_id: number;
  name: string;
  photo: string | null;
  position: 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Attacker';
  status: 'Star' | 'Key' | 'Wild';
  fatigue: number;
  team_name: string;
  team_logo: string | null;
  birthdate: string | null;
  pgs: number;
  created_at?: string;
  updated_at?: string;
}

interface FantasyGameRow {
  id: string;
  name: string;
  status: 'Upcoming' | 'Ongoing' | 'Finished' | 'Cancelled';
  start_date: string;
  end_date: string;
  entry_cost: number;
  total_players: number;
  is_linkable: boolean;
  created_at?: string;
  updated_at?: string;
}

interface FantasyGameWeekRow {
  id: string;
  fantasy_game_id: string;
  name: string;
  start_date: string;
  end_date: string;
  leagues: string[];
  status: 'upcoming' | 'live' | 'finished';
  conditions: any; // JSONB
  created_at?: string;
  updated_at?: string;
}

interface UserFantasyTeamRow {
  id: string;
  user_id: string;
  game_id: string;
  game_week_id: string;
  starters: string[];
  substitutes: string[];
  captain_id: string | null;
  booster_used: number | null;
  fatigue_state: Record<string, number>;
  total_points: number;
  created_at?: string;
  updated_at?: string;
}

interface FantasyBoosterRow {
  id: number;
  name: string;
  description: string;
  icon: string | null;
  type: 'regular' | 'live';
  created_at?: string;
}

// ============================================================================
// Supabase API Functions
// ============================================================================

/**
 * Fetch all available Fantasy players (fatigue > 0)
 */
export async function getAvailableFantasyPlayers(): Promise<FantasyPlayer[]> {
  const { data, error } = await supabase
    .rpc('get_available_fantasy_players');

  if (error) {
    console.error('Error fetching fantasy players:', error);
    throw error;
  }

  return (data || []).map(mapPlayerRowToPlayer);
}

/**
 * Fetch a specific Fantasy game by ID
 */
export async function getFantasyGame(gameId: string): Promise<FantasyGameRow | null> {
  const { data, error } = await supabase
    .from('fantasy_games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (error) {
    console.error('Error fetching fantasy game:', error);
    return null;
  }

  return data;
}

/**
 * Fetch all game weeks for a Fantasy game
 */
export async function getGameWeeks(gameId: string): Promise<FantasyGameWeek[]> {
  const { data, error } = await supabase
    .from('fantasy_game_weeks')
    .select('*')
    .eq('fantasy_game_id', gameId)
    .order('start_date', { ascending: true });

  if (error) {
    console.error('Error fetching game weeks:', error);
    throw error;
  }

  return (data || []).map(mapGameWeekRowToGameWeek);
}

/**
 * Fetch current live game week
 */
export async function getCurrentGameWeek(gameId: string): Promise<FantasyGameWeek | null> {
  const { data, error } = await supabase
    .from('fantasy_game_weeks')
    .select('*')
    .eq('fantasy_game_id', gameId)
    .eq('status', 'live')
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('Error fetching current game week:', error);
    return null;
  }

  return data ? mapGameWeekRowToGameWeek(data) : null;
}

/**
 * Fetch user's Fantasy team for a game week
 */
export async function getUserFantasyTeam(
  userId: string,
  gameWeekId: string
): Promise<UserFantasyTeam | null> {
  const { data, error } = await supabase
    .from('user_fantasy_teams')
    .select('*')
    .eq('user_id', userId)
    .eq('game_week_id', gameWeekId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching user fantasy team:', error);
    return null;
  }

  return data ? mapTeamRowToTeam(data) : null;
}

/**
 * Save or update user's Fantasy team
 */
export async function saveUserFantasyTeam(team: UserFantasyTeam): Promise<boolean> {
  const teamRow: Partial<UserFantasyTeamRow> = {
    user_id: team.userId,
    game_id: team.gameId,
    game_week_id: team.gameWeekId,
    starters: team.starters,
    substitutes: team.substitutes,
    captain_id: team.captain_id,
    booster_used: team.booster_used,
    fatigue_state: team.fatigue_state,
  };

  const { error } = await supabase
    .from('user_fantasy_teams')
    .upsert(teamRow, {
      onConflict: 'user_id,game_id,game_week_id'
    });

  if (error) {
    console.error('Error saving fantasy team:', error);
    throw error;
  }

  return true;
}

/**
 * Fetch Fantasy leaderboard for a game week
 */
export async function getFantasyLeaderboard(
  gameId: string,
  gameWeekId: string
): Promise<FantasyLeaderboardEntry[]> {
  const { data, error } = await supabase
    .rpc('calculate_fantasy_leaderboard', {
      p_game_id: gameId,
      p_game_week_id: gameWeekId
    });

  if (error) {
    console.error('Error fetching fantasy leaderboard:', error);
    throw error;
  }

  return (data || []).map((row: any) => ({
    rank: row.rank,
    username: row.username,
    avatar: row.avatar || '',
    totalPoints: parseFloat(row.total_points),
    boosterUsed: row.booster_used,
    userId: row.user_id
  }));
}

/**
 * Fetch all Fantasy boosters
 */
export async function getFantasyBoosters(): Promise<FantasyBoosterRow[]> {
  const { data, error } = await supabase
    .from('fantasy_boosters')
    .select('*')
    .eq('type', 'regular')
    .order('id', { ascending: true });

  if (error) {
    console.error('Error fetching fantasy boosters:', error);
    throw error;
  }

  return data || [];
}

// ============================================================================
// Mapper Functions (Database -> Frontend Types)
// ============================================================================

function mapPlayerRowToPlayer(row: FantasyPlayerRow): FantasyPlayer {
  return {
    id: row.id,
    name: row.name,
    photo: row.photo || '',
    position: row.position as any,
    status: row.status as any,
    fatigue: row.fatigue,
    teamName: row.team_name,
    teamLogo: row.team_logo || '',
    birthdate: row.birthdate || '',
    pgs: row.pgs,
  };
}

function mapGameWeekRowToGameWeek(row: FantasyGameWeekRow): FantasyGameWeek {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    leagues: row.leagues,
    status: row.status,
    conditions: Array.isArray(row.conditions) ? row.conditions : [],
  };
}

function mapTeamRowToTeam(row: UserFantasyTeamRow): UserFantasyTeam {
  return {
    userId: row.user_id,
    gameId: row.game_id,
    gameWeekId: row.game_week_id,
    starters: row.starters,
    substitutes: row.substitutes,
    captain_id: row.captain_id || '',
    booster_used: row.booster_used,
    fatigue_state: row.fatigue_state || {},
  };
}

// ============================================================================
// Local Calculation Functions (kept from original)
// ============================================================================

/**
 * Pre-GameWeek function to update status for all players.
 * In a real app, this would be a backend process.
 */
export function updateAllPlayerStatuses(
  players: FantasyPlayer[],
  playerStats: Record<string, PlayerLast10Stats>
): FantasyPlayer[] {
  return players.map(player => {
    const stats = playerStats[player.id];
    if (!stats) return player;

    const { pgs, playtime_ratio } = computePGS(stats);
    const status = getPlayerCategoryFromPGS(pgs);

    return {
      ...player,
      pgs: parseFloat(pgs.toFixed(2)),
      status,
      playtime_ratio: parseFloat(playtime_ratio.toFixed(2)),
    };
  });
}

export interface GameWeekSimulationResult {
  playerResults: Record<string, {
    points: number;
    basePoints: number;
    breakdown: Record<string, number>;
    initialFatigue: number;
    finalFatigue: number;
  }>;
  teamResult: {
    totalPoints: number;
    bonusApplied: string | null;
    boosterStatus?: string;
    boosterRefunded?: boolean;
  };
}

/**
 * Simulates a full GameWeek calculation for a user's team.
 */
export function processGameWeek(
  userTeam: UserFantasyTeam,
  allPlayers: FantasyPlayer[],
  gameWeekStats: Record<string, PlayerGameWeekStats>
): { simulationResult: GameWeekSimulationResult, updatedTeam: UserFantasyTeam } {
  const playerResults: GameWeekSimulationResult['playerResults'] = {};
  const playerPoints: Record<string, number> = {};
  let boosterStatus: string | undefined = undefined;
  let boosterRefunded = false;
  
  let teamForProcessing = JSON.parse(JSON.stringify(userTeam));

  // 1. Handle Recovery Boost
  let fatigueState = { ...teamForProcessing.fatigue_state };
  if (teamForProcessing.booster_used === 3) { // 3 = Recovery Boost
    const targetId = teamForProcessing.booster_target_id;
    if (targetId) {
      const player = allPlayers.find(p => p.id === targetId);
      const stats = gameWeekStats[targetId];
      if (player && player.position !== 'Goalkeeper') {
        if (stats && stats.minutes_played > 0) {
          fatigueState[targetId] = 1.0;
          boosterStatus = `Recovery Boost applied to ${player.name}.`;
        } else {
          boosterStatus = `Recovery Boost refunded: ${player.name} did not play.`;
          teamForProcessing.booster_used = null;
          teamForProcessing.booster_target_id = null;
          boosterRefunded = true;
        }
      } else {
        boosterStatus = "Recovery Boost ignored: Target is a Goalkeeper or invalid.";
      }
    } else {
      boosterStatus = "Recovery Boost ignored: No target player selected.";
    }
  }

  // 2. Calculate points and new fatigue for each starter
  teamForProcessing.starters.forEach(playerId => {
    const player = allPlayers.find(p => p.id === playerId);
    const stats = gameWeekStats[playerId];
    if (!player || !stats) return;

    const initialFatigue = fatigueState[playerId] || 1.0;
    const isCaptain = player.id === teamForProcessing.captain_id;
    const isDoubleImpactActive = teamForProcessing.booster_used === 1; // 1 = Double Impact

    const { totalPoints, breakdown, basePoints } = computePlayerPoints(
      stats,
      player.position,
      initialFatigue,
      isCaptain,
      isDoubleImpactActive
    );
    
    playerPoints[playerId] = totalPoints;
    
    const finalFatigue = calculateFatigue(initialFatigue, player.status, stats.minutes_played > 0);
    fatigueState[playerId] = finalFatigue;

    playerResults[playerId] = {
      points: totalPoints,
      basePoints,
      breakdown,
      initialFatigue,
      finalFatigue,
    };
  });

  // 3. Update fatigue for subs (rested)
  teamForProcessing.substitutes.forEach(playerId => {
      const player = allPlayers.find(p => p.id === playerId);
      if (!player) return;

      const initialFatigue = fatigueState[playerId] || 1.0;
      const finalFatigue = calculateFatigue(initialFatigue, player.status, false);
      fatigueState[playerId] = finalFatigue;
      
      playerResults[playerId] = {
          points: 0,
          basePoints: 0,
          breakdown: {},
          initialFatigue,
          finalFatigue,
      }
  });

  // 4. Calculate final team score with bonuses
  const teamPlayers = teamForProcessing.starters.map(id => allPlayers.find(p => p.id === id)).filter(Boolean) as FantasyPlayer[];
  const isGoldenGameActive = teamForProcessing.booster_used === 2; // 2 = Golden Game
  const { finalScore, bonusApplied } = computeTeamTotal(
    teamPlayers,
    playerPoints,
    isGoldenGameActive
  );

  const updatedTeam = { ...teamForProcessing, fatigue_state: fatigueState };

  return {
    simulationResult: {
      playerResults,
      teamResult: {
        totalPoints: finalScore,
        bonusApplied,
        boosterStatus,
        boosterRefunded,
      },
    },
    updatedTeam,
  };
}
