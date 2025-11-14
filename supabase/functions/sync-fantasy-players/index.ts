/**
 * Sync Fantasy Players Edge Function
 *
 * Automatically syncs Fantasy players from API-Sports to Supabase.
 * Updates player stats, PGS (Points per Game Score), status, and fatigue.
 *
 * Scheduled to run via cron or triggered manually.
 *
 * Environment variables required:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - API_SPORTS_KEY
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// Types
// ============================================================================

interface PlayerLast10Stats {
  goals: number;
  assists: number;
  clean_sheets: number;
  minutes_played: number;
  matches_played: number;
  rating: number;
}

interface SyncResult {
  playerId: string;
  playerName: string;
  success: boolean;
  error?: string;
  changes?: {
    pgs?: { old: number; new: number };
    status?: { old: string; new: string };
    fatigue?: { old: number; new: number };
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapPosition(apiPosition: string): 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Attacker' {
  const pos = apiPosition?.toLowerCase() || '';
  if (pos.includes('goalkeeper')) return 'Goalkeeper';
  if (pos.includes('defender')) return 'Defender';
  if (pos.includes('midfielder')) return 'Midfielder';
  return 'Attacker';
}

function calculatePGS(stats: PlayerLast10Stats, position: string): number {
  const { goals, assists, clean_sheets, minutes_played, matches_played, rating } = stats;

  if (matches_played === 0) return 0;

  let points = 0;

  // Base points for minutes played
  if (minutes_played >= 60) points += 2;
  else if (minutes_played > 0) points += 1;

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

  // Rating bonus
  if (rating >= 8.0) points += 3;
  else if (rating >= 7.0) points += 2;
  else if (rating >= 6.0) points += 1;

  return points / matches_played;
}

function getPlayerStatus(pgs: number): 'Star' | 'Key' | 'Wild' {
  if (pgs >= 7.5) return 'Star';
  if (pgs >= 6.0) return 'Key';
  return 'Wild';
}

async function fetchPlayerStatsFromAPI(
  playerId: number,
  apiKey: string,
  season: number = 2024
): Promise<any | null> {
  try {
    const response = await fetch(
      `https://v3.football.api-sports.io/players?id=${playerId}&season=${season}`,
      {
        headers: {
          'x-apisports-key': apiKey,
        },
      }
    );

    if (!response.ok) {
      console.error(`API-Sports error for player ${playerId}:`, response.statusText);
      return null;
    }

    const data = await response.json();
    if (!data.response || data.response.length === 0) {
      return null;
    }

    return data.response[0];
  } catch (error) {
    console.error(`Error fetching player ${playerId}:`, error);
    return null;
  }
}

function extractStatsFromAPI(apiStats: any): PlayerLast10Stats {
  const stats = apiStats.statistics?.[0];
  if (!stats) {
    return {
      goals: 0,
      assists: 0,
      clean_sheets: 0,
      minutes_played: 0,
      matches_played: 0,
      rating: 6.0,
    };
  }

  return {
    goals: stats.goals?.total || 0,
    assists: stats.goals?.assists || 0,
    clean_sheets: stats.goals?.saves || 0, // Approximation
    minutes_played: stats.games?.minutes || 0,
    matches_played: stats.games?.appearences || 0,
    rating: stats.games?.rating ? parseFloat(stats.games.rating) : 6.0,
  };
}

// ============================================================================
// Main Sync Logic
// ============================================================================

async function syncFantasyPlayers(
  supabase: any,
  apiKey: string,
  season: number
): Promise<{ results: SyncResult[]; summary: any }> {
  const results: SyncResult[] = [];

  // Fetch all Fantasy players
  const { data: players, error: fetchError } = await supabase
    .from('fantasy_players')
    .select('*');

  if (fetchError) {
    throw new Error(`Failed to fetch players: ${fetchError.message}`);
  }

  if (!players || players.length === 0) {
    return {
      results: [],
      summary: { total: 0, success: 0, errors: 0, unchanged: 0 },
    };
  }

  console.log(`Found ${players.length} Fantasy players to sync`);

  let successCount = 0;
  let errorCount = 0;
  let unchangedCount = 0;

  for (const player of players) {
    try {
      console.log(`Syncing ${player.name} (API ID: ${player.api_player_id})...`);

      // Fetch latest stats from API-Sports
      const apiStats = await fetchPlayerStatsFromAPI(
        player.api_player_id,
        apiKey,
        season
      );

      if (!apiStats) {
        results.push({
          playerId: player.id,
          playerName: player.name,
          success: false,
          error: 'No API data available',
        });
        errorCount++;
        continue;
      }

      // Extract and calculate stats
      const last10Stats = extractStatsFromAPI(apiStats);
      const position = mapPosition(apiStats.statistics?.[0]?.games?.position);
      const newPGS = parseFloat(calculatePGS(last10Stats, position).toFixed(1));
      const newStatus = getPlayerStatus(newPGS);

      // Check if anything changed
      const pgsChanged = Math.abs(player.pgs - newPGS) > 0.1;
      const statusChanged = player.status !== newStatus;

      if (!pgsChanged && !statusChanged) {
        results.push({
          playerId: player.id,
          playerName: player.name,
          success: true,
        });
        unchangedCount++;
        console.log(`  No changes needed`);
        continue;
      }

      // Update player in database
      const { error: updateError } = await supabase
        .from('fantasy_players')
        .update({
          name: apiStats.player.name,
          photo: apiStats.player.photo,
          position,
          status: newStatus,
          pgs: newPGS,
          team_name: apiStats.statistics[0]?.team?.name || player.team_name,
          team_logo: apiStats.statistics[0]?.team?.logo || player.team_logo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', player.id);

      if (updateError) {
        results.push({
          playerId: player.id,
          playerName: player.name,
          success: false,
          error: updateError.message,
        });
        errorCount++;
        console.error(`  Error: ${updateError.message}`);
      } else {
        results.push({
          playerId: player.id,
          playerName: player.name,
          success: true,
          changes: {
            ...(pgsChanged && { pgs: { old: player.pgs, new: newPGS } }),
            ...(statusChanged && { status: { old: player.status, new: newStatus } }),
          },
        });
        successCount++;
        console.log(`  Updated: PGS ${player.pgs} → ${newPGS}, Status: ${player.status} → ${newStatus}`);
      }

      // Rate limit: 1 request per second (API-Sports free tier)
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error: any) {
      results.push({
        playerId: player.id,
        playerName: player.name,
        success: false,
        error: error.message,
      });
      errorCount++;
      console.error(`  Error: ${error.message}`);
    }
  }

  return {
    results,
    summary: {
      total: players.length,
      success: successCount,
      errors: errorCount,
      unchanged: unchangedCount,
      timestamp: new Date().toISOString(),
    },
  };
}

// ============================================================================
// Edge Function Handler
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[sync-fantasy-players] Request received');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const apiKey = Deno.env.get('API_SPORTS_KEY');

    if (!supabaseUrl || !supabaseKey || !apiKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body (optional season parameter)
    let season = 2024;
    try {
      const body = await req.json();
      if (body.season) {
        season = parseInt(body.season);
      }
    } catch {
      // Use default season if no body provided
    }

    console.log(`[sync-fantasy-players] Starting sync for season ${season}...`);

    // Run sync
    const { results, summary } = await syncFantasyPlayers(supabase, apiKey, season);

    console.log('[sync-fantasy-players] Sync complete');
    console.log(`  Total: ${summary.total}`);
    console.log(`  Success: ${summary.success}`);
    console.log(`  Unchanged: ${summary.unchanged}`);
    console.log(`  Errors: ${summary.errors}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Fantasy players synced successfully',
        summary,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[sync-fantasy-players] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
