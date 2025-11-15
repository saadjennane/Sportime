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
    onProgress?.({ step: 'league', current: 0, total: 1, message: `Fetching league ${leagueApiId}...` })

    // Fetch league data from API-Football
    const response = await apiFootball<{ response: APIFootballLeague[] }>('/leagues', {
      id: leagueApiId,
      season,
    })

    if (!response.response || response.response.length === 0) {
      return { success: false, error: 'League not found in API-Football' }
    }

    const leagueData = response.response[0]

    onProgress?.({ step: 'league', current: 1, total: 1, message: 'Inserting league into database...' })

    // Insert league into Supabase
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .upsert(
        {
          api_id: leagueData.league.id,
          name: leagueData.league.name,
          type: leagueData.league.type,
          logo: leagueData.league.logo,
          country_id: leagueData.country.code, // Using country code as country_id
        },
        { onConflict: 'api_id' }
      )
      .select('id')
      .single()

    if (leagueError) {
      console.error('League insert error:', leagueError)
      return { success: false, error: leagueError.message }
    }

    return { success: true, leagueId: league.id }
  } catch (error: any) {
    console.error('syncLeague error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Sync all teams for a specific league
 */
export async function syncLeagueTeams(
  leagueId: string,
  leagueApiId: number,
  season: number = 2024,
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
        .from('teams')
        .upsert(
          {
            api_id: teamData.team.id,
            name: teamData.team.name,
            code: teamData.team.code,
            country: teamData.team.country,
            founded: teamData.team.founded,
            national: teamData.team.national,
            logo: teamData.team.logo,
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
        .from('team_league_participation')
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

      // Insert player
      const { data: player, error: playerError } = await supabase
        .from('players')
        .upsert(
          {
            api_id: playerData.id,
            name: playerData.name,
            first_name: playerData.firstname,
            last_name: playerData.lastname,
            age: playerData.age,
            nationality: playerData.nationality,
            height: playerData.height,
            weight: playerData.weight,
            photo: playerData.photo,
            position: playerData.position,
          },
          { onConflict: 'api_id' }
        )
        .select('id')
        .single()

      if (playerError) {
        console.error(`Error inserting player ${playerData.name}:`, playerError)
        continue
      }

      // Create player-team association
      const { error: assocError } = await supabase
        .from('player_team_association')
        .upsert(
          {
            player_id: player.id,
            team_id: teamId,
            season: season.toString(),
            jersey_number: playerData.number,
          },
          { onConflict: 'player_id,team_id,season' }
        )

      if (assocError) {
        console.error(`Error creating player-team association:`, assocError)
      } else {
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

    const result = await syncLeague(league.id, 2024, onProgress)
    results.push({ league: league.name, ...result })

    if (result.success && result.leagueId) {
      // Sync teams for this league
      const teamsResult = await syncLeagueTeams(result.leagueId, league.id, 2024, onProgress)
      results[i].teamsResult = teamsResult
    }
  }

  return { success: true, results }
}
