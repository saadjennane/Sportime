/**
 * Fantasy Players Sync Script
 *
 * Syncs Fantasy players from API-Sports to Supabase.
 * Updates player stats, PGS (Points per Game Score), and fatigue.
 *
 * Usage:
 *   npx ts-node scripts/sync-fantasy-players.ts
 *
 * Environment variables required:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - API_SPORTS_KEY
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Configuration
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const API_SPORTS_KEY = process.env.API_SPORTS_KEY || '';
const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !API_SPORTS_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, API_SPORTS_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================================================
// Types
// ============================================================================

interface APIPlayerStats {
  player: {
    id: number;
    name: string;
    photo: string;
  };
  statistics: Array<{
    team: {
      id: number;
      name: string;
      logo: string;
    };
    games: {
      appearences: number;
      minutes: number;
      position: string;
    };
    goals: {
      total: number | null;
    };
    assists: {
      total: number | null;
    };
    rating: string | null;
  }>;
}

interface PlayerLast10Stats {
  goals: number;
  assists: number;
  clean_sheets: number;
  minutes_played: number;
  matches_played: number;
  rating: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Maps API-Sports position to Fantasy position
 */
function mapPosition(apiPosition: string): 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Attacker' {
  const pos = apiPosition.toLowerCase();
  if (pos.includes('goalkeeper')) return 'Goalkeeper';
  if (pos.includes('defender')) return 'Defender';
  if (pos.includes('midfielder')) return 'Midfielder';
  return 'Attacker';
}

/**
 * Calculates PGS (Points per Game Score) from player stats
 * Based on the Fantasy scoring rules
 */
function calculatePGS(stats: PlayerLast10Stats, position: string): number {
  const {
    goals,
    assists,
    clean_sheets,
    minutes_played,
    matches_played,
    rating,
  } = stats;

  if (matches_played === 0) return 0;

  let points = 0;

  // Base points for minutes played
  if (minutes_played >= 60) {
    points += 2;
  } else if (minutes_played > 0) {
    points += 1;
  }

  // Goals (position-dependent)
  switch (position) {
    case 'Goalkeeper':
    case 'Defender':
      points += goals * 6;
      break;
    case 'Midfielder':
      points += goals * 5;
      break;
    case 'Attacker':
      points += goals * 4;
      break;
  }

  // Assists
  points += assists * 3;

  // Clean sheets (GK and DEF only)
  if (position === 'Goalkeeper' || position === 'Defender') {
    points += clean_sheets * 4;
  }

  // Rating bonus (if available)
  if (rating >= 8.0) points += 3;
  else if (rating >= 7.0) points += 2;
  else if (rating >= 6.0) points += 1;

  // PGS = average points per match
  return points / matches_played;
}

/**
 * Determines player category from PGS
 */
function getPlayerStatus(pgs: number): 'Star' | 'Key' | 'Wild' {
  if (pgs >= 7.5) return 'Star';
  if (pgs >= 6.0) return 'Key';
  return 'Wild';
}

/**
 * Fetches player stats from API-Sports
 */
async function fetchPlayerStats(playerId: number, season: number = 2024): Promise<APIPlayerStats | null> {
  try {
    const response = await fetch(
      `${API_SPORTS_BASE_URL}/players?id=${playerId}&season=${season}`,
      {
        headers: {
          'x-rapidapi-key': API_SPORTS_KEY,
          'x-rapidapi-host': 'v3.football.api-sports.io',
        },
      }
    );

    if (!response.ok) {
      console.error(`❌ API-Sports error for player ${playerId}:`, response.statusText);
      return null;
    }

    const data = await response.json();
    if (!data.response || data.response.length === 0) {
      console.warn(`⚠️  No stats found for player ${playerId}`);
      return null;
    }

    return data.response[0];
  } catch (error) {
    console.error(`❌ Error fetching player ${playerId}:`, error);
    return null;
  }
}

/**
 * Calculates last 10 matches stats from API data
 */
function calculateLast10Stats(apiStats: APIPlayerStats): PlayerLast10Stats {
  // In a real implementation, you would fetch the last 10 fixture stats
  // For now, we'll use season totals as approximation
  const stats = apiStats.statistics[0];
  const matchesPlayed = stats.games.appearences || 0;

  return {
    goals: stats.goals.total || 0,
    assists: stats.assists.total || 0,
    clean_sheets: 0, // Would need to fetch from fixtures
    minutes_played: stats.games.minutes || 0,
    matches_played: matchesPlayed,
    rating: stats.rating ? parseFloat(stats.rating) : 6.0,
  };
}

// ============================================================================
// Main Sync Functions
// ============================================================================

/**
 * Syncs all Fantasy players with API-Sports data
 */
async function syncFantasyPlayers() {
  console.log('🔄 Starting Fantasy players sync...\n');

  // Fetch all Fantasy players from Supabase
  const { data: players, error: fetchError } = await supabase
    .from('fantasy_players')
    .select('*');

  if (fetchError) {
    console.error('❌ Error fetching players from Supabase:', fetchError);
    return;
  }

  if (!players || players.length === 0) {
    console.log('⚠️  No players found in database');
    return;
  }

  console.log(`📊 Found ${players.length} players to sync\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const player of players) {
    try {
      console.log(`🔄 Syncing ${player.name} (API ID: ${player.api_player_id})...`);

      // Fetch latest stats from API-Sports
      const apiStats = await fetchPlayerStats(player.api_player_id);

      if (!apiStats) {
        console.log(`  ⚠️  Skipping (no API data)\n`);
        errorCount++;
        continue;
      }

      // Calculate stats
      const last10Stats = calculateLast10Stats(apiStats);
      const position = mapPosition(apiStats.statistics[0].games.position);
      const pgs = calculatePGS(last10Stats, position);
      const status = getPlayerStatus(pgs);

      // Update player in Supabase
      const { error: updateError } = await supabase
        .from('fantasy_players')
        .update({
          name: apiStats.player.name,
          photo: apiStats.player.photo,
          position,
          status,
          pgs: parseFloat(pgs.toFixed(1)),
          team_name: apiStats.statistics[0].team.name,
          team_logo: apiStats.statistics[0].team.logo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', player.id);

      if (updateError) {
        console.log(`  ❌ Error updating: ${updateError.message}\n`);
        errorCount++;
      } else {
        console.log(`  ✅ Updated: PGS=${pgs.toFixed(1)}, Status=${status}\n`);
        successCount++;
      }

      // Rate limit: wait 1 second between requests (API-Sports free tier limit)
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`  ❌ Error syncing player:`, error);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Sync complete: ${successCount} success, ${errorCount} errors`);
  console.log('='.repeat(50) + '\n');
}

/**
 * Updates player fatigue based on recent matches
 * This should be run after each game week
 */
async function updatePlayerFatigue() {
  console.log('🔄 Updating player fatigue...\n');

  // Fetch all players
  const { data: players, error } = await supabase
    .from('fantasy_players')
    .select('*');

  if (error) {
    console.error('❌ Error fetching players:', error);
    return;
  }

  if (!players || players.length === 0) {
    console.log('⚠️  No players found');
    return;
  }

  // Update fatigue based on status (this is a simplified version)
  // In a real implementation, you would check if players actually played
  for (const player of players) {
    let newFatigue = player.fatigue;

    // Fatigue decay rules:
    // - Star players: -20% if played
    // - Key players: -10% if played
    // - All players: +10% if rested (up to 100%)

    // For now, we'll just ensure fatigue doesn't go below 0
    if (newFatigue < 0) newFatigue = 0;
    if (newFatigue > 100) newFatigue = 100;

    const { error: updateError } = await supabase
      .from('fantasy_players')
      .update({ fatigue: newFatigue })
      .eq('id', player.id);

    if (updateError) {
      console.error(`  ❌ Error updating fatigue for ${player.name}:`, updateError);
    }
  }

  console.log('✅ Fatigue update complete\n');
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'sync';

  switch (command) {
    case 'sync':
      await syncFantasyPlayers();
      break;
    case 'fatigue':
      await updatePlayerFatigue();
      break;
    case 'all':
      await syncFantasyPlayers();
      await updatePlayerFatigue();
      break;
    default:
      console.log('Usage:');
      console.log('  npx ts-node scripts/sync-fantasy-players.ts sync     - Sync player stats');
      console.log('  npx ts-node scripts/sync-fantasy-players.ts fatigue  - Update fatigue');
      console.log('  npx ts-node scripts/sync-fantasy-players.ts all      - Both operations');
      process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
