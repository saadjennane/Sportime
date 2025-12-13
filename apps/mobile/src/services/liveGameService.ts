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
  console.log('[liveGameService] createLiveGame called with:', options);

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

  const result = await supabase
    .from('live_games')
    .insert(gameData)
    .select()
    .single();

  console.log('[liveGameService] Insert result:', JSON.stringify(result, null, 2));

  const { data, error } = result;

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

  // Check if already joined
  const { data: existing } = await supabase
    .from('live_game_entries')
    .select('id')
    .eq('live_game_id', gameId)
    .eq('user_id', user.user.id)
    .single();

  if (existing) throw new Error('You have already joined this game');

  // Deduct entry cost if ranked
  if (game.mode === 'ranked' && game.entry_cost > 0) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('coins')
      .eq('id', user.user.id)
      .single();

    if (!profile || profile.coins < game.entry_cost) {
      throw new Error(`Not enough coins. You need ${game.entry_cost} coins to join.`);
    }

    // Deduct coins
    const { error: deductError } = await supabase
      .from('profiles')
      .update({ coins: profile.coins - game.entry_cost })
      .eq('id', user.user.id);

    if (deductError) throw deductError;
  }

  // Create entry
  const { data: entry, error: entryError } = await supabase
    .from('live_game_entries')
    .insert({
      live_game_id: gameId,
      user_id: user.user.id,
      balance: game.entry_cost || 1000, // Free mode gets 1000 virtual coins
    })
    .select()
    .single();

  if (entryError) {
    console.error('[liveGameService] Error joining game:', entryError);
    throw entryError;
  }

  return mapEntryFromDb(entry);
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

// Export all functions
export const liveGameService = {
  createLiveGame,
  joinLiveGame,
  joinByFriendCode,
  getUserLimits,
  placeBet,
  confirmBet,
  voidBet,
  resolveBet,
  getGameByFixture,
  getUserEntry,
  getLeaderboard,
  getUserActiveGames,
};

export default liveGameService;
