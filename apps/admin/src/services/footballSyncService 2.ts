import { apiFootball } from '../lib/apiFootballService'
import { supabase } from './supabase'

interface APIFootballLeague {
  league: {
    id: number
    name: string
    type: string
    logo: string
  }
  country: {
    name: string
    code: string
    flag: string
  }
}

interface APIFootballTeam {
  team: {
    id: number
    name: string
    code: string
    country: string
    founded: number
    national: boolean
    logo: string
  }
  venue: {
    id: number
    name: string
    address: string
    city: string
    capacity: number
    surface: string
    image: string
  }
}

interface APIFootballPlayer {
  player: {
    id: number
    name: string
    firstname: string
    lastname: string
    age: number
    birth: {
      date: string
      place: string
      country: string
    }
    nationality: string
    height: string
    weight: string
    injured: boolean
    photo: string
  }
  statistics: Array<{
    team: {
      id: number
      name: string
      logo: string
    }
    league: {
      id: number
      name: string
      country: string
      logo: string
      flag: string
      season: number
    }
    games: {
      appearences: number
      lineups: number
      minutes: number
      number: number | null
      position: string
      rating: string
      captain: boolean
    }
  }>
}

export interface SyncProgress {
  step: string
  current: number
  total: number
  message: string
}

export type SyncProgressCallback = (progress: SyncProgress) => void

/**
 * Sync a specific league from API-Football
 */
export async function syncLeague(
  leagueApiId: number,
  season: number = 2024,
  onProgress?: SyncProgressCallback
): Promise<{ success: boolean; error?: string; leagueId?: string }> {
  try {
    console.log(`[syncLeague] Starting sync for league ${leagueApiId}, season ${season}`)
    onProgress?.({ step: 'league', current: 0, total: 1, message: `Fetching league ${leagueApiId}...` })

    // Get user ID for created_by field (optional)
    // Try to get current user, otherwise leave as null (field is now nullable)
    let userId: string | null = null

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      userId = user.id
      console.log(`[syncLeague] Using authenticated user ID: ${userId}`)
    } else {
      console.log('[syncLeague] No authenticated user, created_by will be null')
    }

    // Fetch league data from API-Football
    const response = await apiFootball<{ response: APIFootballLeague[] }>('/leagues', {
      id: leagueApiId,
      season,
    })

    console.log(`[syncLeague] API Response:`, response)

    if (!response.response || response.response.length === 0) {
      console.error('[syncLeague] No league found in API response')
      return { success: false, error: 'League not found in API-Football' }
    }

    const leagueData = response.response[0]
    console.log(`[syncLeague] League data:`, leagueData)

    onProgress?.({ step: 'league', current: 1, total: 1, message: 'Inserting league into database...' })

    // Step 1: Ensure country exists in countries table
    console.log(`[syncLeague] Ensuring country exists: ${leagueData.country.name}`)
    const { error: countryError } = await supabase
      .from('countries')
      .upsert(
        {
          id: leagueData.country.name, // id is the country name (e.g., "England", "Spain")
          code: leagueData.country.code,
          flag: leagueData.country.flag,
        },
        { onConflict: 'id' }
      )

    if (countryError) {
      console.error('[syncLeague] Country insert error:', countryError)
      return { success: false, error: `Failed to create country: ${countryError.message}` }
    }

    // Step 2: Generate a unique invite code based on league name
    const inviteCode = leagueData.league.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .substring(0, 20) + '-' + leagueData.league.id;

    // Step 3: Insert league with country_id
    const leaguePayload = {
      api_id: leagueData.league.id,
      name: leagueData.league.name,
      type: 'football_competition',
      logo: leagueData.league.logo,
      country_id: leagueData.country.name, // Foreign key to countries.id
      invite_code: inviteCode,
      created_by: userId, // Optional field (nullable)
      api_league_id: leagueData.league.id, // API-Football league ID
    }

    console.log(`[syncLeague] Inserting with payload:`, leaguePayload)

    // Insert league into Supabase
    const { data: league, error: leagueError } = await supabase
      .from('fb_leagues')
      .upsert(leaguePayload, { onConflict: 'api_id' })
      .select('id')
      .single()

    if (leagueError) {
      console.error('[syncLeague] Insert error:', leagueError)
      return { success: false, error: leagueError.message }
    }

    console.log(`[syncLeague] Success! League ID:`, league?.id)
    return { success: true, leagueId: league.id }
  } catch (error: any) {
    console.error('[syncLeague] Caught error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Sync all teams for a specific league
 */
export async function syncLeagueTeams(
  leagueId: string,
  leagueApiId: number,
  season: number = 2025,
  onProgress?: SyncProgressCallback
): Promise<{ success: boolean; error?: string; teamsCount?: number }> {
  try {
    onProgress?.({ step: 'teams', current: 0, total: 100, message: 'Fetching teams from API-Football...' })

    // Fetch teams for this league from API-Football
    const response = await apiFootball<{ response: APIFootballTeam[] }>('/teams', {
      league: leagueApiId,
      season,
    })

    if (!response.response || response.response.length === 0) {
      return { success: false, error: 'No teams found for this league' }
    }

    const teams = response.response
    let inserted = 0

    for (let i = 0; i < teams.length; i++) {
      const teamData = teams[i]

      onProgress?.({
        step: 'teams',
        current: i + 1,
        total: teams.length,
        message: `Importing ${teamData.team.name}...`,
      })

      // Insert team
      const { data: team, error: teamError } = await supabase
        .from('fb_teams')
        .upsert(
          {
            api_id: teamData.team.id,
            name: teamData.team.name,
            code: teamData.team.code,
            country: teamData.team.country,
            logo_url: teamData.team.logo || '',
          },
          { onConflict: 'api_id' }
        )
        .select('id')
        .single()

      if (teamError) {
        console.error(`Error inserting team ${teamData.team.name}:`, teamError)
        continue
      }

      // Create team-league association
      const { error: assocError } = await supabase
        .from('fb_team_league_participation')
        .upsert(
          {
            team_id: team.id,
            league_id: leagueId,
            season: season.toString(),
          },
          { onConflict: 'team_id,league_id,season' }
        )

      if (assocError) {
        console.error(`Error creating team-league association:`, assocError)
      } else {
        inserted++
      }
    }

    return { success: true, teamsCount: inserted }
  } catch (error: any) {
    console.error('syncLeagueTeams error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Sync players for a specific team
 */
export async function syncTeamPlayers(
  teamId: string,
  teamApiId: number,
  season: number = 2024,
  onProgress?: SyncProgressCallback
): Promise<{ success: boolean; error?: string; playersCount?: number }> {
  try {
    onProgress?.({ step: 'players', current: 0, total: 100, message: 'Fetching players from API-Football...' })

    // Fetch players for this team from API-Football
    const response = await apiFootball<{ response: APIFootballPlayer[] }>('/players/squads', {
      team: teamApiId,
    })

    if (!response.response || response.response.length === 0) {
      return { success: false, error: 'No players found for this team' }
    }

    const squad = response.response[0]
    if (!squad || !squad.players) {
      return { success: false, error: 'Invalid squad data' }
    }

    const players = squad.players
    let inserted = 0

    for (let i = 0; i < players.length; i++) {
      const playerData = players[i]

      onProgress?.({
        step: 'players',
        current: i + 1,
        total: players.length,
        message: `Importing ${playerData.name}...`,
      })

      // Debug: Log player data from API
      console.log('📥 Player data from API:', {
        id: playerData.id,
        name: playerData.name,
        nationality: playerData.nationality,
        photo: playerData.photo,
        birth: playerData.birth,
      })

      // Insert player
      const { data: player, error: playerError } = await supabase
        .from('fb_players')
        .upsert(
          {
            api_id: playerData.id,
            name: playerData.name,
            first_name: playerData.firstname || 'Unknown',
            last_name: playerData.lastname || 'Unknown',
            birthdate: playerData.birth?.date || '2000-01-01',
            nationality: playerData.nationality || 'Unknown',
            height_cm: playerData.height ? parseInt(playerData.height) : null,
            weight_kg: playerData.weight ? parseInt(playerData.weight) : null,
            photo_url: playerData.photo || '',
            photo: playerData.photo || null,
            position: playerData.position || 'Unknown',
          },
          { onConflict: 'api_id' }
        )
        .select('id')
        .single()

      if (playerError) {
        console.error(`❌ Error inserting player ${playerData.name}:`, playerError)
        continue
      }

      console.log(`✅ Player inserted with ID: ${player.id}`)

      // Create player-team association
      const { error: assocError } = await supabase
        .from('fb_player_team_association')
        .upsert(
          {
            player_id: player.id,
            team_id: teamId,
            start_date: new Date().toISOString().split('T')[0], // Current date in YYYY-MM-DD format
          },
          { onConflict: 'player_id,team_id' }
        )

      if (assocError) {
        console.error(`❌ Error creating player-team association for ${playerData.name}:`, assocError)
        console.error('Association data:', { player_id: player.id, team_id: teamId })
      } else {
        console.log(`✅ Association created for ${playerData.name}`)
        inserted++
      }
    }

    return { success: true, playersCount: inserted }
  } catch (error: any) {
    console.error('syncTeamPlayers error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Sync all 4 major leagues (Premier League, La Liga, Bundesliga, Serie A)
 */
export async function syncAllMajorLeagues(
  season: number = 2025,
  onProgress?: SyncProgressCallback
): Promise<{ success: boolean; error?: string; results?: any }> {
  const majorLeagues = [
    { id: 39, name: 'Premier League' },
    { id: 140, name: 'La Liga' },
    { id: 78, name: 'Bundesliga' },
    { id: 135, name: 'Serie A' },
  ]

  const results = []

  for (let i = 0; i < majorLeagues.length; i++) {
    const league = majorLeagues[i]

    onProgress?.({
      step: 'leagues',
      current: i + 1,
      total: majorLeagues.length,
      message: `Syncing ${league.name}...`,
    })

    const result = await syncLeague(league.id, season, onProgress)
    results.push({ league: league.name, ...result })

    if (result.success && result.leagueId) {
      // Sync teams for this league
      const teamsResult = await syncLeagueTeams(result.leagueId, league.id, season, onProgress)
      results[i].teamsResult = teamsResult
    }
  }

  return { success: true, results }
}

/**
 * Sync fixtures for a specific league
 */
export async function syncLeagueFixtures(
  leagueId: string,
  leagueApiId: number,
  season: number = 2025,
  onProgress?: SyncProgressCallback
): Promise<{ success: boolean; error?: string; fixturesCount?: number }> {
  try {
    onProgress?.({ step: 'fixtures', current: 0, total: 100, message: 'Fetching fixtures from API-Football...' })

    // Fetch fixtures for this league from API-Football
    const response = await apiFootball<{ response: any[] }>('/fixtures', {
      league: leagueApiId,
      season,
    })

    if (!response.response || response.response.length === 0) {
      return { success: false, error: 'No fixtures found for this league' }
    }

    const fixtures = response.response
    let inserted = 0

    for (let i = 0; i < fixtures.length; i++) {
      const fixtureData = fixtures[i]

      onProgress?.({
        step: 'fixtures',
        current: i + 1,
        total: fixtures.length,
        message: `Importing fixture ${i + 1} of ${fixtures.length}...`,
      })

      // Get team UUIDs from database using API IDs
      const { data: homeTeam } = await supabase
        .from('fb_teams')
        .select('id')
        .eq('api_id', fixtureData.teams.home.id)
        .single()

      const { data: awayTeam } = await supabase
        .from('fb_teams')
        .select('id')
        .eq('api_id', fixtureData.teams.away.id)
        .single()

      if (!homeTeam || !awayTeam) {
        console.warn(`Teams not found in database for fixture ${fixtureData.fixture.id} (home: ${fixtureData.teams.home.id}, away: ${fixtureData.teams.away.id})`)
        continue
      }

      // Insert fixture with UUIDs for team references
      // Don't set 'id' - it's auto-generated UUID. Use api_id for upsert conflict.
      const { error: fixtureError } = await supabase
        .from('fb_fixtures')
        .upsert(
          {
            api_id: fixtureData.fixture.id, // API-Football fixture ID
            league_id: leagueId,
            home_team_id: homeTeam.id, // UUID from fb_teams
            away_team_id: awayTeam.id, // UUID from fb_teams
            date: fixtureData.fixture.date,
            status: fixtureData.fixture.status.short,
            goals_home: fixtureData.goals.home,
            goals_away: fixtureData.goals.away,
            round: fixtureData.league?.round || null, // Matchday/Round info
          },
          { onConflict: 'api_id' }
        )

      if (fixtureError) {
        console.error(`Error inserting fixture ${fixtureData.fixture.id}:`)
        console.error('Error details:', JSON.stringify(fixtureError, null, 2))
        console.error('Fixture data we tried to insert:', {
          api_id: fixtureData.fixture.id,
          league_id: leagueId,
          home_team_id: homeTeam.id,
          away_team_id: awayTeam.id,
          date: fixtureData.fixture.date,
          status: fixtureData.fixture.status.short,
          goals_home: fixtureData.goals.home,
          goals_away: fixtureData.goals.away,
          round: fixtureData.league?.round || null,
        })
        continue
      }

      inserted++
    }

    return { success: true, fixturesCount: inserted }
  } catch (error: any) {
    console.error('syncLeagueFixtures error:', error)
    return { success: false, error: error.message }
  }
}
