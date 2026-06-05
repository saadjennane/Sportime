// ============================================================================
// Fantasy Data Seeding Edge Function
// Batch processes API-Football data for leagues, teams, players, and stats
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// TYPES
// ============================================================================

interface LeagueConfig {
  api_id: number;
  name: string;
  country: string;
  priority: boolean; // true = full data, false = basic only
}

interface SeedProgress {
  stage: string;
  current: number;
  total: number;
  message: string;
  errors: string[];
}

interface ApiFootballResponse<T> {
  response: T[];
  errors?: string[];
  paging?: {
    current: number;
    total: number;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function callApiFootball<T>(
  endpoint: string,
  params: Record<string, string | number>
): Promise<T[]> {
  const apiKey = Deno.env.get('API_FOOTBALL_KEY');
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY not configured');
  }

  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    queryParams.append(key, String(value));
  });

  const url = `https://v3.football.api-sports.io/${endpoint}?${queryParams}`;

  const response = await fetch(url, {
    headers: {
      'x-apisports-key': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`API Football error: ${response.statusText}`);
  }

  const data: ApiFootballResponse<T> = await response.json();

  if (data.errors && data.errors.length > 0) {
    console.error('[API-Football] Errors:', data.errors);
  }

  return data.response || [];
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// SEED FUNCTIONS
// ============================================================================

/**
 * Seed basic league data (name, logo, country)
 */
async function seedLeagueBasic(
  supabase: any,
  league: LeagueConfig,
  season: number
): Promise<void> {
  console.log(`[seedLeagueBasic] Processing ${league.name}...`);

  // Fetch league info from API
  const leagueData = await callApiFootball('leagues', {
    id: league.api_id,
    season,
  });

  if (leagueData.length === 0) {
    throw new Error(`League ${league.api_id} not found`);
  }

  const apiLeague = leagueData[0] as any;

  // Upsert to fb_leagues (staging)
  const { error } = await supabase
    .from('fb_leagues')
    .upsert({
      api_league_id: league.api_id,
      name: apiLeague.league.name,
      type: apiLeague.league.type,
      logo: apiLeague.league.logo,
      country: apiLeague.country.name,
      season: season,
      payload: apiLeague, // Store full response
    }, {
      onConflict: 'api_league_id',
    });

  if (error) {
    throw error;
  }

  console.log(`[seedLeagueBasic] ✓ ${league.name} saved`);
}

/**
 * Seed teams for a league
 */
async function seedLeagueTeams(
  supabase: any,
  leagueApiId: number,
  season: number
): Promise<number[]> {
  console.log(`[seedLeagueTeams] Fetching teams for league ${leagueApiId}...`);

  const teams = await callApiFootball('teams', {
    league: leagueApiId,
    season,
  });

  const teamApiIds: number[] = [];

  for (const teamData of teams as any[]) {
    const { error } = await supabase
      .from('fb_teams')
      .upsert({
        id: teamData.team.id,
        name: teamData.team.name,
        code: teamData.team.code,
        country: teamData.team.country,
        founded: teamData.team.founded,
        national: teamData.team.national,
        logo: teamData.team.logo,
        venue_name: teamData.venue?.name,
        venue_city: teamData.venue?.city,
        venue_capacity: teamData.venue?.capacity,
      }, {
        onConflict: 'id',
      });

    if (error) {
      console.error(`[seedLeagueTeams] Error saving team ${teamData.team.name}:`, error);
    } else {
      teamApiIds.push(teamData.team.id);
    }
  }

  console.log(`[seedLeagueTeams] ✓ ${teams.length} teams saved`);
  return teamApiIds;
}

/**
 * Seed full squad (30 players) for a team
 */
async function seedTeamSquad(
  supabase: any,
  teamApiId: number,
  season: number
): Promise<number[]> {
  console.log(`[seedTeamSquad] Fetching squad for team ${teamApiId}...`);

  const squad = await callApiFootball('players/squads', {
    team: teamApiId,
  });

  if (squad.length === 0) {
    console.warn(`[seedTeamSquad] No squad data for team ${teamApiId}`);
    return [];
  }

  const players = (squad[0] as any).players || [];
  const playerApiIds: number[] = [];

  for (const playerData of players) {
    const { error } = await supabase
      .from('fb_players')
      .upsert({
        id: playerData.id,
        name: playerData.name,
        firstname: playerData.firstname,
        lastname: playerData.lastname,
        age: playerData.age,
        birth_date: playerData.birth?.date,
        birth_place: playerData.birth?.place,
        birth_country: playerData.birth?.country,
        nationality: playerData.nationality,
        height: playerData.height,
        weight: playerData.weight,
        photo: playerData.photo,
        position: playerData.position,
        number: playerData.number,
      }, {
        onConflict: 'id',
      });

    if (error) {
      console.error(`[seedTeamSquad] Error saving player ${playerData.name}:`, error);
    } else {
      playerApiIds.push(playerData.id);
    }
  }

  console.log(`[seedTeamSquad] ✓ ${players.length} players saved`);
  return playerApiIds;
}

/**
 * Seed player statistics for a season
 */
async function seedPlayerStats(
  supabase: any,
  playerApiId: number,
  season: number
): Promise<void> {
  console.log(`[seedPlayerStats] Fetching stats for player ${playerApiId}...`);

  const stats = await callApiFootball('players', {
    id: playerApiId,
    season,
  });

  if (stats.length === 0) {
    console.warn(`[seedPlayerStats] No stats for player ${playerApiId}`);
    return;
  }

  const playerData = (stats[0] as any).player;
  const statistics = (stats[0] as any).statistics || [];

  // Get player UUID from api_id
  const { data: playerRecord, error: playerError } = await supabase
    .from('players')
    .select('id')
    .eq('api_id', playerApiId)
    .single();

  if (playerError || !playerRecord) {
    console.error(`[seedPlayerStats] Player ${playerApiId} not found in DB`);
    return;
  }

  const playerId = playerRecord.id;

  // Process each team the player played for in this season
  for (const stat of statistics) {
    const team = stat.team;
    const league = stat.league;
    const games = stat.games;
    const goals = stat.goals;
    const passes = stat.passes;
    const tackles = stat.tackles;
    const duels = stat.duels;
    const dribbles = stat.dribbles;
    const shots = stat.shots;
    const cards = stat.cards;

    // Get team UUID
    const { data: teamRecord } = await supabase
      .from('teams')
      .select('id')
      .eq('api_id', team.id)
      .single();

    // Get league UUID
    const { data: leagueRecord } = await supabase
      .from('leagues')
      .select('id')
      .eq('api_id', league.id)
      .single();

    if (!teamRecord || !leagueRecord) {
      console.warn(`[seedPlayerStats] Team or league not found for player ${playerApiId}`);
      continue;
    }

    // Calculate impact score
    const impactScore = await calculateImpactScore(supabase, {
      goals: goals.total || 0,
      assists: goals.assists || 0,
      passesKey: passes.key || 0,
      dribblesSuccess: dribbles.success || 0,
      tacklesTotal: tackles.total || 0,
      shotsOnTarget: shots.on || 0,
      appearances: games.appearences || 0,
    });

    // Insert player season stats
    const { error: statsError } = await supabase
      .from('player_season_stats')
      .upsert({
        player_id: playerId,
        season,
        team_id: teamRecord.id,
        league_id: leagueRecord.id,
        api_id: playerApiId,

        // Appearances
        appearances: games.appearences || 0,
        minutes_played: games.minutes || 0,
        starting_xi: games.lineups || 0,
        substitute_in: games.substitute_in || 0,
        substitute_out: games.substitute_out || 0,
        bench: games.bench || 0,

        // Performance
        rating: games.rating ? parseFloat(games.rating) : null,
        goals: goals.total || 0,
        assists: goals.assists || 0,

        // Detailed stats
        shots_total: shots.total || 0,
        shots_on_target: shots.on || 0,
        passes_total: passes.total || 0,
        passes_key: passes.key || 0,
        passes_accuracy: passes.accuracy || 0,
        tackles_total: tackles.total || 0,
        tackles_interceptions: tackles.interceptions || 0,
        duels_total: duels.total || 0,
        duels_won: duels.won || 0,
        dribbles_attempts: dribbles.attempts || 0,
        dribbles_success: dribbles.success || 0,
        fouls_drawn: stat.fouls?.drawn || 0,
        fouls_committed: stat.fouls?.committed || 0,

        // Discipline
        yellow_cards: cards.yellow || 0,
        red_cards: cards.red || 0,

        // Goalkeeper (if applicable)
        saves: stat.goals?.saves || 0,
        goals_conceded: stat.goals?.conceded || 0,
        clean_sheets: stat.penalty?.saved || 0,

        // Impact (calculated)
        impact_score: impactScore,
      }, {
        onConflict: 'player_id,season,team_id',
      });

    if (statsError) {
      console.error(`[seedPlayerStats] Error saving stats:`, statsError);
    }
  }

  console.log(`[seedPlayerStats] ✓ Stats saved for player ${playerApiId}`);
}

/**
 * Seed player transfers
 */
async function seedPlayerTransfers(
  supabase: any,
  playerApiId: number
): Promise<void> {
  console.log(`[seedPlayerTransfers] Fetching transfers for player ${playerApiId}...`);

  const transfers = await callApiFootball('transfers', {
    player: playerApiId,
  });

  if (transfers.length === 0) {
    console.warn(`[seedPlayerTransfers] No transfers for player ${playerApiId}`);
    return;
  }

  // Get player UUID
  const { data: playerRecord } = await supabase
    .from('players')
    .select('id')
    .eq('api_id', playerApiId)
    .single();

  if (!playerRecord) {
    console.error(`[seedPlayerTransfers] Player ${playerApiId} not found`);
    return;
  }

  const playerId = playerRecord.id;
  const transferList = (transfers[0] as any).transfers || [];

  for (const transfer of transferList) {
    // Get team UUIDs if they exist
    let fromTeamId = null;
    let toTeamId = null;

    if (transfer.teams?.out?.id) {
      const { data: fromTeam } = await supabase
        .from('teams')
        .select('id')
        .eq('api_id', transfer.teams.out.id)
        .single();
      fromTeamId = fromTeam?.id;
    }

    if (transfer.teams?.in?.id) {
      const { data: toTeam } = await supabase
        .from('teams')
        .select('id')
        .eq('api_id', transfer.teams.in.id)
        .single();
      toTeamId = toTeam?.id;
    }

    const { error } = await supabase
      .from('player_transfers')
      .upsert({
        player_id: playerId,
        transfer_date: transfer.date,
        from_team_id: fromTeamId,
        from_team_name: transfer.teams?.out?.name || 'Unknown',
        to_team_id: toTeamId,
        to_team_name: transfer.teams?.in?.name || 'Unknown',
        transfer_type: transfer.type || 'N/A',
      }, {
        onConflict: 'player_id,transfer_date',
      });

    if (error) {
      console.error(`[seedPlayerTransfers] Error saving transfer:`, error);
    }
  }

  console.log(`[seedPlayerTransfers] ✓ ${transferList.length} transfers saved`);
}

/**
 * Helper: Calculate impact score
 */
async function calculateImpactScore(
  supabase: any,
  stats: {
    goals: number;
    assists: number;
    passesKey: number;
    dribblesSuccess: number;
    tacklesTotal: number;
    shotsOnTarget: number;
    appearances: number;
  }
): Promise<number> {
  const { data, error } = await supabase.rpc('calculate_impact_score', {
    p_goals: stats.goals,
    p_assists: stats.assists,
    p_passes_key: stats.passesKey,
    p_dribbles_success: stats.dribblesSuccess,
    p_tackles_total: stats.tacklesTotal,
    p_shots_on_target: stats.shotsOnTarget,
    p_appearances: stats.appearances,
  });

  if (error) {
    console.error('[calculateImpactScore] Error:', error);
    return 0;
  }

  return data || 0;
}

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

async function seedFantasyData(
  supabase: any,
  leagues: LeagueConfig[],
  season: number,
  progressCallback?: (progress: SeedProgress) => void
): Promise<void> {
  const progress: SeedProgress = {
    stage: 'Starting',
    current: 0,
    total: leagues.length,
    message: 'Initializing...',
    errors: [],
  };

  try {
    // Phase 1: Seed all leagues (basic data)
    progress.stage = 'Leagues';
    progress.message = 'Seeding league data...';
    progressCallback?.(progress);

    for (let i = 0; i < leagues.length; i++) {
      const league = leagues[i];
      progress.current = i + 1;
      progress.message = `Processing ${league.name}...`;
      progressCallback?.(progress);

      try {
        await seedLeagueBasic(supabase, league, season);
        await delay(500); // Rate limiting
      } catch (error) {
        console.error(`[seedFantasyData] Error seeding league ${league.name}:`, error);
        progress.errors.push(`League ${league.name}: ${error.message}`);
      }
    }

    // Phase 2: Seed teams and players (priority leagues only)
    const priorityLeagues = leagues.filter((l) => l.priority);
    progress.stage = 'Teams & Players';
    progress.current = 0;
    progress.total = priorityLeagues.length;
    progressCallback?.(progress);

    for (let i = 0; i < priorityLeagues.length; i++) {
      const league = priorityLeagues[i];
      progress.current = i + 1;
      progress.message = `Processing teams for ${league.name}...`;
      progressCallback?.(progress);

      try {
        // Seed teams
        const teamApiIds = await seedLeagueTeams(supabase, league.api_id, season);
        await delay(500);

        // Seed players for each team
        for (const teamApiId of teamApiIds) {
          await seedTeamSquad(supabase, teamApiId, season);
          await delay(500);
        }
      } catch (error) {
        console.error(`[seedFantasyData] Error seeding teams/players for ${league.name}:`, error);
        progress.errors.push(`Teams/Players ${league.name}: ${error.message}`);
      }
    }

    // Phase 2.5: Sync staging data to production tables
    progress.stage = 'Syncing to Production';
    progress.message = 'Syncing leagues, teams and players to production tables...';
    progressCallback?.(progress);

    try {
      // Sync leagues: fb_leagues → leagues (CRITICAL FOR PHASE 3!)
      const { data: fbLeagues } = await supabase.from('fb_leagues').select('*');

      if (fbLeagues && fbLeagues.length > 0) {
        // Get first user to use as created_by
        const { data: firstUser } = await supabase
          .from('users')
          .select('id')
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        const createdBy = firstUser?.id || '00000000-0000-0000-0000-000000000000';

        for (const fbLeague of fbLeagues) {
          await supabase.from('leagues').upsert({
            api_id: fbLeague.api_league_id,
            name: fbLeague.name,
            invite_code: `AUTO-${fbLeague.api_league_id}`,
            created_by: createdBy,
            logo: fbLeague.logo,
            type: fbLeague.type,
            season: fbLeague.season?.toString(),
          }, {
            onConflict: 'api_id',
          });
        }
        console.log(`[syncProduction] Synced ${fbLeagues.length} leagues`);
      }

      // Sync teams: fb_teams → teams (FIX COLUMN NAMES)
      const { data: fbTeams } = await supabase.from('fb_teams').select('*');

      if (fbTeams && fbTeams.length > 0) {
        for (const fbTeam of fbTeams) {
          await supabase.from('teams').upsert({
            api_id: fbTeam.id,
            name: fbTeam.name,
            code: fbTeam.code,
            logo_url: fbTeam.logo || 'https://via.placeholder.com/150', // FIX: logo → logo_url
            country: fbTeam.country,
          }, {
            onConflict: 'api_id',
          });
        }
        console.log(`[syncProduction] Synced ${fbTeams.length} teams`);
      }

      // Sync players: fb_players → players (FIX COLUMN NAMES)
      const { data: fbPlayers } = await supabase.from('fb_players').select('*');

      if (fbPlayers && fbPlayers.length > 0) {
        for (const fbPlayer of fbPlayers) {
          // Extract first/last name from full name
          const nameParts = (fbPlayer.name || '').split(' ');
          const firstName = fbPlayer.firstname || nameParts[0] || 'Unknown';
          const lastName = fbPlayer.lastname || nameParts.slice(1).join(' ') || 'Player';

          await supabase.from('players').upsert({
            api_id: fbPlayer.id,
            first_name: firstName, // FIX: name → first_name
            last_name: lastName, // FIX: added last_name
            photo_url: fbPlayer.photo || 'https://via.placeholder.com/150', // FIX: photo → photo_url
            position: fbPlayer.position || 'Unknown',
            nationality: fbPlayer.nationality || 'Unknown',
            birthdate: fbPlayer.birth_date || '2000-01-01', // FIX: added birthdate
          }, {
            onConflict: 'api_id',
          });
        }
        console.log(`[syncProduction] Synced ${fbPlayers.length} players`);
      }
    } catch (error) {
      console.error('[syncProduction] Error syncing to production:', error);
      progress.errors.push(`Sync to production: ${error.message}`);
    }

    // Phase 3: Seed player stats (BATCHED to avoid timeout)
    progress.stage = 'Player Statistics';
    progress.message = 'Fetching player statistics (batched)...';
    progressCallback?.(progress);

    // BATCH PROCESSING: Only process 20 players without stats (reduced to avoid timeout)
    const BATCH_SIZE = 20;

    // Get players that don't have season stats yet
    const { data: allPlayers, error: playersError } = await supabase
      .from('players')
      .select('id, api_id')
      .not('api_id', 'is', null);

    if (playersError) {
      throw playersError;
    }

    // Filter to only players without stats
    const playersToProcess = [];
    for (const player of allPlayers) {
      if (playersToProcess.length >= BATCH_SIZE) break;

      const { data: existingStats } = await supabase
        .from('player_season_stats')
        .select('id')
        .eq('player_id', player.id)
        .eq('season', season)
        .limit(1);

      if (!existingStats || existingStats.length === 0) {
        playersToProcess.push(player);
      }
    }

    if (playersToProcess.length === 0) {
      console.log('[Phase 3] All players already have stats, skipping...');
    } else {
      progress.total = playersToProcess.length;
      console.log(`[Phase 3] Processing ${playersToProcess.length} players`);

      for (let i = 0; i < playersToProcess.length; i++) {
        const player = playersToProcess[i];
        progress.current = i + 1;
        progress.message = `Processing player ${player.api_id}... (${i + 1}/${playersToProcess.length})`;
        progressCallback?.(progress);

        try {
          await seedPlayerStats(supabase, player.api_id, season);
          await delay(500);
        } catch (error) {
          console.error(`[seedFantasyData] Error seeding stats for player ${player.api_id}:`, error);
          progress.errors.push(`Player stats ${player.api_id}: ${error.message}`);
        }
      }
    }

    // Phase 4: SKIP transfers for now to avoid timeout
    // Will run Phase 4 separately after Phase 3 is complete
    console.log('[Phase 4] Skipping transfers (will run separately after Phase 3 complete)');

    /* COMMENTED OUT - Will re-enable after Phase 3 is complete
    if (playersToProcess.length > 0) {
      progress.stage = 'Transfers';
      progress.message = 'Fetching transfer history (batched)...';
      progressCallback?.(progress);

      for (let i = 0; i < playersToProcess.length; i++) {
        const player = playersToProcess[i];
        progress.current = i + 1;
        progress.message = `Processing transfers for player ${player.api_id}... (${i + 1}/${playersToProcess.length})`;
        progressCallback?.(progress);

        try {
          await seedPlayerTransfers(supabase, player.api_id);
          await delay(500);
        } catch (error) {
          console.error(`[seedFantasyData] Error seeding transfers for player ${player.api_id}:`, error);
          progress.errors.push(`Transfers ${player.api_id}: ${error.message}`);
        }
      }
    }
    */

    progress.stage = 'Complete';
    progress.message = 'Fantasy data seeding complete!';
    progressCallback?.(progress);
  } catch (error) {
    console.error('[seedFantasyData] Fatal error:', error);
    progress.errors.push(`Fatal: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// EDGE FUNCTION HANDLER
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[seed-fantasy-data] Request received');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    console.log('[seed-fantasy-data] Environment variables OK');

    const supabase = createClient(supabaseUrl, supabaseKey);

    let body;
    try {
      body = await req.json();
      console.log('[seed-fantasy-data] Body parsed:', JSON.stringify(body));
    } catch (parseError) {
      console.error('[seed-fantasy-data] JSON parse error:', parseError);
      throw new Error(`Failed to parse request body: ${parseError.message}`);
    }

    const { leagues, season = 2025 } = body;

    if (!leagues || !Array.isArray(leagues)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: leagues array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const progress: SeedProgress[] = [];

    await seedFantasyData(supabase, leagues, season, (p) => {
      progress.push({ ...p });
      console.log(`[Progress] ${p.stage}: ${p.message} (${p.current}/${p.total})`);
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Fantasy data seeded successfully',
        progress,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[seed-fantasy-data] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
