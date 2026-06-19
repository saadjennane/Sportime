/**
 * Live Betting Game Service
 *
 * Handles all operations for the Live Betting Game V2:
 * - Game creation (public & friend games)
 * - Joining games
 * - Placing and managing bets
 * - Leaderboard
 */

import { supabase } from '../lib/supabaseClient';
import type {
  LiveGame,
  LiveGameEntry,
  LiveGameBet,
  LiveGameMode,
  LiveBetCategory,
  LiveGameUserLimits,
} from '../types';

// =============================================
// TYPES
// =============================================

interface PlaceBetRequest {
  category: LiveBetCategory;
  marketId: number;
  marketName: string;
  choice: string;
  choiceLabel: string;
  amount: number;
  odds: number;
  placedAtMinute?: number;
}

interface CreateGameOptions {
  fixtureId: string;
  mode: LiveGameMode;
  entryCost?: number;
  createFriendCode?: boolean;
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatar?: string;
  balance: number;
  totalGains: number;
}

// =============================================
// GAME MANAGEMENT
// =============================================

/**
 * Create a new live game for a fixture
 */
export async function createLiveGame(options: CreateGameOptions): Promise<LiveGame | null> {
  console.log('[liveGameService] createLiveGame V2 called with:', options);

  if (!supabase) {
    console.error('[liveGameService] Supabase not initialized');
    return null;
  }

  const { data: user } = await supabase.auth.getUser();
  console.log('[liveGameService] User:', user?.user?.id);
  if (!user.user) throw new Error('Not authenticated');

  // Check user limits (skip if RPC doesn't exist yet)
  let limits = null;
  try {
    limits = await getUserLimits(user.user.id);
    console.log('[liveGameService] User limits:', limits);
  } catch (limitsError) {
    console.warn('[liveGameService] Could not get user limits, skipping check:', limitsError);
  }

  if (limits && limits.slotsMax !== null && limits.slotsUsed >= limits.slotsMax) {
    throw new Error(`You have reached your maximum of ${limits.slotsMax} active games. Complete a game to join another.`);
  }

  // Validate entry cost against user level
  if (options.mode === 'ranked' && options.entryCost) {
    if (limits && limits.entryMax !== null && options.entryCost > limits.entryMax) {
      throw new Error(`Your maximum entry is ${limits.entryMax} coins. Upgrade your level to increase it.`);
    }
  }

  const gameData: any = {
    fixture_id: options.fixtureId,
    mode: options.mode,
    entry_cost: options.mode === 'ranked' ? (options.entryCost || 1000) : 0,
    status: 'upcoming',
    created_by: user.user.id,
  };
  console.log('[liveGameService] Inserting game data:', gameData);

  // Generate friend code if requested
  if (options.createFriendCode) {
    const { data: code } = await supabase.rpc('generate_friend_code');
    gameData.friend_code = code;
  }

  let result;
  try {
    result = await supabase
      .from('live_games')
      .insert(gameData)
      .select()
      .single();
    console.log('[liveGameService] Insert result:', JSON.stringify(result, null, 2));
  } catch (insertError) {
    console.error('[liveGameService] Insert threw exception:', insertError);
    throw new Error('Database insert failed');
  }

  const { data, error } = result || { data: null, error: { message: 'No result from insert' } };

  if (error) {
    console.error('[liveGameService] Error creating game:', error);
    throw new Error(error.message || 'Failed to create game');
  }

  if (!data) {
    console.error('[liveGameService] No data returned from insert - table may not exist');
    throw new Error('Failed to create game - database error');
  }

  console.log('[liveGameService] Game created successfully:', data);
  return mapGameFromDb(data);
}

/**
 * Join a live game by ID
 */
export async function joinLiveGame(gameId: string): Promise<LiveGameEntry | null> {
  if (!supabase) return null;

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  // Get game details
  const { data: game, error: gameError } = await supabase
    .from('live_games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (gameError || !game) throw new Error('Game not found');
  // Allow joining anytime before match is finished
  // Late joiners have natural handicap: less time = fewer betting opportunities
  if (game.status === 'finished') throw new Error('This game has ended');

  // Check user limits
  const limits = await getUserLimits(user.user.id);
  if (limits && limits.slotsMax !== null && limits.slotsUsed >= limits.slotsMax) {
    throw new Error(`You have reached your maximum of ${limits.slotsMax} active games.`);
  }

  // Eligibility (coin deduction for ranked, unique entry) is enforced SERVER-SIDE
  // by join_live_game. The limits check above is just a friendly pre-check.
  const { data, error } = await supabase.rpc('join_live_game', {
    p_game_id: gameId,
    p_user_id: user.user.id,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.entry_id) return null;

  const { data: entry } = await supabase
    .from('live_game_entries')
    .select('*')
    .eq('id', row.entry_id)
    .single();

  return entry ? mapEntryFromDb(entry) : null;
}

/**
 * Submit (or re-submit before kickoff) a score prediction + bonus answers.
 * Returns the server-generated bonus questions. Validation + bonus generation
 * happen server-side in submit_live_prediction.
 */
export async function submitLivePrediction(
  gameId: string,
  home: number,
  away: number,
  questions: Array<{ key: string; points: number; label: string; format: string }>,
  answers: Record<string, string>
): Promise<void> {
  if (!supabase) return;
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { error } = await supabase.rpc('submit_live_prediction', {
    p_game_id: gameId,
    p_user_id: user.user.id,
    p_home: home,
    p_away: away,
    p_questions: questions,
    p_answers: answers,
  });
  if (error) throw error;
}

/** Edit the predicted scoreline once the match is live (halftime) -> -40% malus. */
export async function editLivePrediction(gameId: string, home: number, away: number): Promise<void> {
  if (!supabase) return;
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { error } = await supabase.rpc('edit_live_prediction', {
    p_game_id: gameId,
    p_user_id: user.user.id,
    p_home: home,
    p_away: away,
  });
  if (error) throw error;
}

/**
 * Per-mode play state for a fixture's Play chooser: have I joined each live game,
 * and completed its action (predicted / built XI)? Used to show status pills.
 */
export interface MatchModes {
  prediction: { joined: boolean; predicted: { home: number; away: number } | null; status: string | null };
  matchRoyale: { joined: boolean; partStatus: string | null; gameStatus: string | null } | null;
  liveFantasy: { joined: boolean; complete: boolean; status: string | null } | null;
}

export async function getMyMatchModes(fixtureId: string, userId: string): Promise<MatchModes | null> {
  if (!supabase) return null;

  // Live Prediction — the user's (non-finished or any) game for this fixture.
  const { data: lg } = await supabase.rpc('get_user_live_games', { p_user_id: userId });
  const pred = (Array.isArray(lg) ? lg : []).find((g: any) => g.fixture_id === fixtureId);
  const prediction = { joined: !!pred, predicted: pred?.predicted_score ?? null, status: pred?.status ?? null };

  // Match Royale — most recent game for the fixture + my participation.
  let matchRoyale: MatchModes['matchRoyale'] = null;
  const { data: mrG } = await supabase.from('mr_games').select('id, status').eq('fixture_id', fixtureId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (mrG?.id) {
    const { data: part } = await supabase.from('mr_participants').select('status').eq('game_id', mrG.id).eq('user_id', userId).maybeSingle();
    matchRoyale = { joined: !!part, partStatus: part?.status ?? null, gameStatus: mrG.status ?? null };
  }

  // Live Fantasy — most recent game for the fixture + my team.
  let liveFantasy: MatchModes['liveFantasy'] = null;
  const { data: lfG } = await supabase.from('lf_games').select('id, status').eq('fixture_id', fixtureId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (lfG?.id) {
    const { data: team } = await supabase.from('lf_teams').select('captain_player_id').eq('game_id', lfG.id).eq('user_id', userId).maybeSingle();
    liveFantasy = { joined: !!team, complete: !!team?.captain_player_id, status: lfG.status ?? null };
  }

  return { prediction, matchRoyale, liveFantasy };
}

/**
 * Join a game using friend code
 */
export async function joinByFriendCode(code: string): Promise<LiveGameEntry | null> {
  if (!supabase) return null;

  const { data: game, error } = await supabase
    .from('live_games')
    .select('id')
    .eq('friend_code', code.toUpperCase())
    .single();

  if (error || !game) throw new Error('Invalid friend code');

  return joinLiveGame(game.id);
}

/**
 * Get user's limits based on their level
 */
export async function getUserLimits(userId: string): Promise<LiveGameUserLimits | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.rpc('get_user_live_game_limits', {
    p_user_id: userId,
  });

  if (error || !data || data.length === 0) {
    console.error('[liveGameService] Error getting user limits:', error);
    return null;
  }

  return {
    levelName: data[0].level_name,
    entryMax: data[0].entry_max,
    slotsMax: data[0].slots_max,
    slotsUsed: data[0].slots_used,
  };
}

// Default tier limits (fallback if database not available)
const DEFAULT_TIER_LIMITS: Record<string, number> = {
  rookie: 500,
  rising_star: 1000,
  pro: 2500,
  legend: 5000,
  goat: 10000,
};

/**
 * Get tier-based entry limits from database
 * These are administrable by admins via the admin dashboard
 */
export async function getTierLimits(): Promise<Record<string, number>> {
  if (!supabase) {
    console.warn('[liveGameService] Supabase not available, using default tier limits');
    return DEFAULT_TIER_LIMITS;
  }

  const { data, error } = await supabase
    .from('live_game_tier_limits')
    .select('tier, max_entry');

  if (error) {
    console.error('[liveGameService] Error fetching tier limits:', error);
    return DEFAULT_TIER_LIMITS;
  }

  if (!data || data.length === 0) {
    console.warn('[liveGameService] No tier limits in database, using defaults');
    return DEFAULT_TIER_LIMITS;
  }

  return data.reduce((acc, row) => {
    acc[row.tier] = row.max_entry;
    return acc;
  }, {} as Record<string, number>);
}

/**
 * Get the max entry allowed for a specific user tier
 */
export function getMaxEntryForTier(tier: string, tierLimits: Record<string, number>): number {
  // Normalize tier name (handle variations like "Rising Star" vs "rising_star")
  const normalizedTier = tier.toLowerCase().replace(/\s+/g, '_');
  return tierLimits[normalizedTier] || DEFAULT_TIER_LIMITS.rookie;
}

// =============================================
// BETTING
// =============================================

/**
 * Place a bet on a market
 */
export async function placeBet(entryId: string, bet: PlaceBetRequest): Promise<LiveGameBet | null> {
  if (!supabase) return null;

  // Validate bet amount
  if (bet.amount < 50) throw new Error('Minimum bet is 50 coins');
  if (bet.amount > 500) throw new Error('Maximum bet is 500 coins');

  // Get entry to check balance
  const { data: entry, error: entryError } = await supabase
    .from('live_game_entries')
    .select('balance, live_game_id')
    .eq('id', entryId)
    .single();

  if (entryError || !entry) throw new Error('Entry not found');
  if (entry.balance < bet.amount) throw new Error('Insufficient balance');

  // Check max 3 bets per market
  const { count } = await supabase
    .from('live_game_bets')
    .select('id', { count: 'exact' })
    .eq('entry_id', entryId)
    .eq('market_id', bet.marketId)
    .in('status', ['pending', 'confirming', 'confirmed']);

  if (count && count >= 3) {
    throw new Error('Maximum 3 bets per market');
  }

  // Create bet with pending status
  const { data: betData, error: betError } = await supabase
    .from('live_game_bets')
    .insert({
      entry_id: entryId,
      category: bet.category,
      market_id: bet.marketId,
      market_name: bet.marketName,
      choice: bet.choice,
      choice_label: bet.choiceLabel,
      amount: bet.amount,
      odds: bet.odds,
      placed_at_minute: bet.placedAtMinute,
      status: 'pending',
    })
    .select()
    .single();

  if (betError) {
    console.error('[liveGameService] Error placing bet:', betError);
    throw betError;
  }

  // Deduct from balance (will be refunded if voided)
  await supabase
    .from('live_game_entries')
    .update({ balance: entry.balance - bet.amount })
    .eq('id', entryId);

  return mapBetFromDb(betData);
}

/**
 * Confirm a pending bet (after 8s delay)
 */
export async function confirmBet(betId: string): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase
    .from('live_game_bets')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', betId)
    .eq('status', 'pending');

  return !error;
}

/**
 * Void a bet (event occurred during confirmation delay)
 */
export async function voidBet(betId: string, reason: string): Promise<boolean> {
  if (!supabase) return false;

  // Get bet details first
  const { data: bet } = await supabase
    .from('live_game_bets')
    .select('entry_id, amount')
    .eq('id', betId)
    .single();

  if (!bet) return false;

  // Void the bet
  const { error } = await supabase
    .from('live_game_bets')
    .update({
      status: 'voided',
      void_reason: reason,
    })
    .eq('id', betId)
    .in('status', ['pending', 'confirming']);

  if (error) return false;

  // Refund the amount
  const { data: entry } = await supabase
    .from('live_game_entries')
    .select('balance')
    .eq('id', bet.entry_id)
    .single();

  if (entry) {
    await supabase
      .from('live_game_entries')
      .update({ balance: entry.balance + bet.amount })
      .eq('id', bet.entry_id);
  }

  return true;
}

/**
 * Resolve a bet as won or lost
 */
export async function resolveBet(betId: string, won: boolean): Promise<boolean> {
  if (!supabase) return false;

  const { data: bet } = await supabase
    .from('live_game_bets')
    .select('entry_id, amount, odds')
    .eq('id', betId)
    .eq('status', 'confirmed')
    .single();

  if (!bet) return false;

  const gain = won ? Math.round(bet.amount * bet.odds) : 0;

  // Update bet status
  const { error } = await supabase
    .from('live_game_bets')
    .update({
      status: won ? 'won' : 'lost',
      resolved_at: new Date().toISOString(),
      gain,
    })
    .eq('id', betId);

  if (error) return false;

  // Update entry balance and total gains
  if (won) {
    const { data: entry } = await supabase
      .from('live_game_entries')
      .select('balance, total_gains')
      .eq('id', bet.entry_id)
      .single();

    if (entry) {
      await supabase
        .from('live_game_entries')
        .update({
          balance: entry.balance + gain,
          total_gains: entry.total_gains + gain,
        })
        .eq('id', bet.entry_id);
    }
  }

  return true;
}

// =============================================
// QUERIES
// =============================================

/**
 * Get a live game by fixture ID
 */
export async function getGameByFixture(fixtureId: string): Promise<LiveGame | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('live_games')
    .select(`
      *,
      fixture:fb_fixtures(
        home_team:fb_teams!fb_fixtures_home_team_id_fkey(name, logo),
        away_team:fb_teams!fb_fixtures_away_team_id_fkey(name, logo),
        date,
        home_score,
        away_score,
        status
      ),
      entries:live_game_entries(count)
    `)
    .eq('fixture_id', fixtureId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) return null;

  return mapGameFromDb(data);
}

/**
 * Get user's entry for a game
 */
export async function getUserEntry(gameId: string, userId: string): Promise<LiveGameEntry | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('live_game_entries')
    .select(`
      *,
      bets:live_game_bets(*)
    `)
    .eq('live_game_id', gameId)
    .eq('user_id', userId)
    .single();

  if (error) return null;

  return mapEntryFromDb(data);
}

/**
 * Get game leaderboard
 */
export async function getLeaderboard(gameId: string): Promise<LeaderboardEntry[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('live_game_entries')
    .select(`
      user_id,
      balance,
      total_gains,
      profile:profiles(username, avatar_url)
    `)
    .eq('live_game_id', gameId)
    .order('balance', { ascending: false });

  if (error || !data) return [];

  return data.map((entry: any, index: number) => ({
    rank: index + 1,
    userId: entry.user_id,
    username: entry.profile?.username || 'Anonymous',
    avatar: entry.profile?.avatar_url,
    balance: entry.balance,
    totalGains: entry.total_gains,
  }));
}

/**
 * Get user's active games (for slot counting)
 */
export async function getUserActiveGames(userId: string): Promise<LiveGame[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('live_game_entries')
    .select(`
      live_game:live_games(
        *,
        fixture:fb_fixtures(
          home_team:fb_teams!fb_fixtures_home_team_id_fkey(name, logo),
          away_team:fb_teams!fb_fixtures_away_team_id_fkey(name, logo),
          date
        )
      )
    `)
    .eq('user_id', userId)
    .in('live_game.status', ['upcoming', 'live']);

  if (error || !data) return [];

  return data
    .filter((entry: any) => entry.live_game)
    .map((entry: any) => mapGameFromDb(entry.live_game));
}

// =============================================
// HELPERS
// =============================================

function mapGameFromDb(data: any): LiveGame {
  return {
    id: data.id,
    fixtureId: data.fixture_id,
    mode: data.mode,
    entryCost: data.entry_cost,
    status: data.status,
    friendCode: data.friend_code,
    createdBy: data.created_by,
    createdAt: data.created_at,
    players: data.entries?.[0]?.count || 0,
    fixture: data.fixture ? {
      homeTeam: {
        name: data.fixture.home_team?.name || 'TBD',
        logo: data.fixture.home_team?.logo,
      },
      awayTeam: {
        name: data.fixture.away_team?.name || 'TBD',
        logo: data.fixture.away_team?.logo,
      },
      kickoffTime: data.fixture.date,
      score: data.fixture.home_score !== null ? {
        home: data.fixture.home_score,
        away: data.fixture.away_score,
      } : undefined,
      status: data.fixture.status,
    } : undefined,
  };
}

function mapEntryFromDb(data: any): LiveGameEntry {
  return {
    id: data.id,
    liveGameId: data.live_game_id,
    userId: data.user_id,
    balance: data.balance,
    totalGains: data.total_gains,
    finalRank: data.final_rank,
    joinedAt: data.joined_at,
    bets: (data.bets || []).map(mapBetFromDb),
  };
}

function mapBetFromDb(data: any): LiveGameBet {
  return {
    id: data.id,
    entryId: data.entry_id,
    category: data.category,
    marketId: data.market_id,
    marketName: data.market_name,
    choice: data.choice,
    choiceLabel: data.choice_label,
    amount: data.amount,
    odds: parseFloat(data.odds),
    placedAtMinute: data.placed_at_minute,
    placedAt: data.placed_at,
    confirmedAt: data.confirmed_at,
    resolvedAt: data.resolved_at,
    status: data.status,
    gain: data.gain,
    voidReason: data.void_reason,
  };
}

// =============================================
// LIVE MARKETS (API-FOOTBALL)
// =============================================

/**
 * Market ID to category mapping
 * Maintained frontend-side for flexibility - no need to redeploy edge function
 * when adding new markets or changing categories
 */
const MARKET_ID_TO_CATEGORY: Record<number, LiveBetCategory> = {
  // Result markets
  19: 'result',   // 1X2 1st Half
  35: 'result',   // To Win 2nd Half
  41: 'result',   // 1X2 50min
  64: 'result',   // HT/FT
  21: 'result',   // 3-Way Handicap
  33: 'result',   // Asian Handicap
  17: 'result',   // Asian Handicap 1st Half
  26: 'result',   // 1X2 2nd Half
  29: 'result',   // Double Chance

  // Goals markets
  36: 'goals',    // Over/Under
  25: 'goals',    // Match Goals
  49: 'goals',    // O/U 1st Half
  24: 'goals',    // Next Goal
  73: 'goals',    // Team Goals
  58: 'goals',    // Score in Both Halves
  39: 'goals',    // BTTS
  27: 'goals',    // BTTS 1st Half
  38: 'goals',    // Final Score
  30: 'goals',    // Home Team Goals
  16: 'goals',    // Away Team Goals
  23: 'goals',    // Exact Goals
  60: 'goals',    // To Score 3+

  // Scorers
  46: 'scorers',  // Goal Scorer
  148: 'scorers', // Player Shots

  // Cards
  119: 'cards',   // Total Cards
  115: 'cards',   // Player to be Booked

  // Quick bets
  18: 'quick',    // Goal in Interval

  // Clean sheet
  57: 'clean_sheet', // Away Clean Sheet
  66: 'clean_sheet', // Home Clean Sheet

  // Corners
  20: 'corners',  // Match Corners
  37: 'corners',  // Total Corners
  32: 'corners',  // Asian Corners
  78: 'corners',  // Corners 1X2
  76: 'corners',  // Race to Corners
  61: 'corners',  // Team Corners
  45: 'corners',  // Corners O/U
  31: 'corners',  // Corners Range

  // Extra Time (knockout only)
  2: 'extra_time',
  1: 'extra_time',
  11: 'extra_time',
  6: 'extra_time',
  9: 'extra_time',

  // Penalties (knockout only)
  107: 'penalties',
  101: 'penalties',
  10: 'penalties',
  8: 'penalties',
};

/**
 * Live market interface for betting
 */
export interface LiveMarket {
  id: number;
  apiId: number;
  name: string;
  category: LiveBetCategory;
  bookmaker: string;
  options: Array<{
    label: string;
    value: string;
    odds: number;
  }>;
}

/**
 * Fetch live markets from API-Football via edge function
 * Edge function returns ALL markets, categorization is done here for flexibility
 */
export async function fetchLiveMarkets(fixtureApiId: number): Promise<LiveMarket[]> {
  if (!supabase) {
    console.warn('[liveGameService] Supabase not available for fetchLiveMarkets');
    return [];
  }

  try {
    const { data, error } = await supabase.functions.invoke('fetch-live-odds', {
      body: { fixtureApiId },
    });

    if (error) {
      console.error('[liveGameService] Error fetching live markets:', error);
      return [];
    }

    if (!data || !data.markets) {
      console.log('[liveGameService] No markets returned from API');
      return [];
    }

    // Categorize markets frontend-side
    // Unknown market IDs are assigned 'other' category
    return data.markets.map((market: any) => ({
      ...market,
      category: MARKET_ID_TO_CATEGORY[market.apiId] || 'other',
    })) as LiveMarket[];
  } catch (err) {
    console.error('[liveGameService] fetchLiveMarkets failed:', err);
    return [];
  }
}

// Export all functions
export const liveGameService = {
  createLiveGame,
  joinLiveGame,
  joinByFriendCode,
  getUserLimits,
  getTierLimits,
  getMaxEntryForTier,
  placeBet,
  confirmBet,
  voidBet,
  resolveBet,
  getGameByFixture,
  getUserEntry,
  getLeaderboard,
  getUserActiveGames,
  fetchLiveMarkets,
  submitLivePrediction,
  editLivePrediction,
};

export default liveGameService;
