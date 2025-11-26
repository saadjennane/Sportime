import { useCallback, useEffect, useState } from 'react'
import { apiFootball } from '../../lib/apiFootballService'
import type { TeamStats, H2HMatch, Lineup } from '../../types'

export interface MatchExtrasParams {
  fixtureId: number
  homeTeamId: number
  awayTeamId: number
  leagueApiId?: number
  season?: string | number | null
}

interface MatchExtrasState {
  teams?: { home: TeamStats; away: TeamStats }
  h2h?: H2HMatch[]
  lineup?: Lineup | null
  loading: boolean
  error: string | null
}

type TeamStatisticsResponse = {
  response?: {
    team?: { name?: string }
    league?: { season?: number }
    fixtures?: {
      played?: { total?: number }
      wins?: { total?: number }
      draws?: { total?: number }
      loses?: { total?: number }
    }
    goals?: {
      for?: { total?: { total?: number } }
      against?: { total?: { total?: number } }
    }
    form?: string
  }
}

type FixturesResponse = {
  response?: Array<{
    fixture?: { id?: number; date?: string }
    league?: { name?: string }
    teams?: {
      home?: { id?: number; name?: string }
      away?: { id?: number; name?: string }
    }
    goals?: { home?: number | null; away?: number | null }
  }>
}

type LineupsResponse = {
  response?: Array<{
    team?: { id?: number; name?: string }
    formation?: string | null
    coach?: { name?: string | null }
    startXI?: Array<{ player?: { name?: string | null; pos?: string | null } }>
    substitutes?: Array<{ player?: { name?: string | null; pos?: string | null } }>
    update?: string | null
  }>
}

const EMPTY_STATE: MatchExtrasState = {
  loading: false,
  error: null,
  teams: undefined,
  h2h: undefined,
  lineup: undefined,
}

function formatDate(value?: string | null) {
  if (!value) return 'Unknown date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function buildTeamStats(
  rawStats: TeamStatisticsResponse | null,
  fixtures: FixturesResponse | null,
  teamId: number
): TeamStats {
  // Find team name from stats or from fixtures
  let teamName = rawStats?.response?.team?.name
  if (!teamName && fixtures?.response?.length) {
    const match = fixtures.response.find((item) =>
      item.teams?.home?.id === teamId || item.teams?.away?.id === teamId
    )
    if (match) {
      teamName = match.teams?.home?.id === teamId
        ? match.teams?.home?.name
        : match.teams?.away?.name
    }
  }
  teamName = teamName || 'Unknown team'

  const formRaw = rawStats?.response?.form ?? ''
  const formLetters = formRaw.replace(/\s+/g, '').split('').filter(Boolean)

  const rawMatches = fixtures?.response ?? []
  const formMatches =
    rawMatches.map((item) => {
      const isHome = item.teams?.home?.id === teamId
      const homeGoals = item.goals?.home ?? 0
      const awayGoals = item.goals?.away ?? 0
      const result =
        homeGoals === awayGoals ? 'D' : isHome ? (homeGoals > awayGoals ? 'W' : 'L') : homeGoals < awayGoals ? 'W' : 'L'

      return {
        date: formatDate(item.fixture?.date ?? undefined),
        competition: item.league?.name ?? 'Unknown',
        homeTeam: item.teams?.home?.name ?? 'Home',
        awayTeam: item.teams?.away?.name ?? 'Away',
        homeScore: homeGoals ?? 0,
        awayScore: awayGoals ?? 0,
        result: result as 'W' | 'D' | 'L',
      }
    }) ?? []

  const summaryPlayed = rawStats?.response?.fixtures?.played?.total ?? formMatches.length
  const summaryWins = rawStats?.response?.fixtures?.wins?.total ?? formMatches.filter((m) => m.result === 'W').length
  const summaryDraws = rawStats?.response?.fixtures?.draws?.total ?? formMatches.filter((m) => m.result === 'D').length
  const summaryLosses = rawStats?.response?.fixtures?.loses?.total ?? formMatches.filter((m) => m.result === 'L').length

  const derivedGoalsFor = formMatches.reduce((acc, m) => {
    if (m.homeTeam === teamName) return acc + m.homeScore
    if (m.awayTeam === teamName) return acc + m.awayScore
    return acc
  }, 0)

  const derivedGoalsAgainst = formMatches.reduce((acc, m) => {
    if (m.homeTeam === teamName) return acc + m.awayScore
    if (m.awayTeam === teamName) return acc + m.homeScore
    return acc
  }, 0)

  const goalsFor = rawStats?.response?.goals?.for?.total?.total ?? derivedGoalsFor
  const goalsAgainst = rawStats?.response?.goals?.against?.total?.total ?? derivedGoalsAgainst

  const formStringSource =
    formLetters.length > 0
      ? formLetters.slice(-5)
      : formMatches
          .slice(0, 5)
          .map((m) => m.result)
  const formString = formStringSource.join(' ')

  return {
    name: teamName,
    formSummary: {
      played: summaryPlayed,
      wins: summaryWins,
      draws: summaryDraws,
      losses: summaryLosses,
      goalsFor,
      goalsAgainst,
      formString,
    },
    formMatches,
  }
}

async function fetchTeamStats(
  teamId: number,
  leagueApiId?: number,
  season?: string | number | null
): Promise<TeamStats | null> {
  if (!teamId) {
    return null
  }

  const hasLeagueStats = leagueApiId && season !== undefined && season !== null
  const seasonValue = hasLeagueStats ? Number(season) : null

  try {
    // Always fetch last 5 fixtures for the team
    const fixturesPromise = apiFootball<FixturesResponse>('/fixtures', {
      team: teamId,
      last: 5,
    })

    // Only fetch league stats if we have league and season info
    const statsPromise = hasLeagueStats && Number.isFinite(seasonValue)
      ? apiFootball<TeamStatisticsResponse>('/teams/statistics', {
          league: leagueApiId,
          season: seasonValue!,
          team: teamId,
        })
      : Promise.resolve(null)

    const [statsRes, fixturesRes] = await Promise.allSettled([
      statsPromise,
      fixturesPromise,
    ])

    const statsData =
      statsRes.status === 'fulfilled' ? statsRes.value : null
    const fixturesData =
      fixturesRes.status === 'fulfilled' ? fixturesRes.value : null

    // Return stats even if we only have fixtures (no league stats)
    if (!fixturesData?.response?.length && !statsData?.response) {
      return null
    }

    return buildTeamStats(statsData, fixturesData, teamId)
  } catch {
    return null
  }
}

async function fetchHeadToHead(homeTeamId: number, awayTeamId: number): Promise<H2HMatch[] | undefined> {
  if (!homeTeamId || !awayTeamId) return undefined

  try {
    const data = await apiFootball<FixturesResponse>('/fixtures/headtohead', {
      h2h: `${homeTeamId}-${awayTeamId}`,
      last: 5,
    })
    return (
      data.response?.map((item) => {
        const homeGoals = item.goals?.home ?? 0
        const awayGoals = item.goals?.away ?? 0
        return {
          date: formatDate(item.fixture?.date ?? undefined),
          competition: item.league?.name ?? 'Unknown',
          homeTeam: item.teams?.home?.name ?? 'Home',
          awayTeam: item.teams?.away?.name ?? 'Away',
          score: `${homeGoals ?? 0}\u2013${awayGoals ?? 0}`,
        }
      }) ?? []
    )
  } catch {
    return undefined
  }
}

async function fetchLineup(fixtureId: number, preferredTeamId: number): Promise<Lineup | null> {
  if (!fixtureId) return null

  try {
    const data = await apiFootball<LineupsResponse>('/fixtures/lineups', { fixture: fixtureId })
    const entries = data.response ?? []
    if (!entries.length) return null

    const selected =
      entries.find((entry) => entry.team?.id === preferredTeamId) ??
      entries[0]

    if (!selected) return null

    const starters =
      selected.startXI?.map((item) => ({
        name: item.player?.name ?? 'Unknown',
        position: item.player?.pos ?? '',
      })) ?? []

    const bench =
      selected.substitutes?.map((item) => ({
        name: item.player?.name ?? 'Unknown',
        position: item.player?.pos ?? '',
      })) ?? []

    return {
      status: starters.length > 0 ? 'confirmed' : 'tbc',
      formation: selected.formation ?? 'Unknown',
      lastUpdated: selected.update ?? new Date().toISOString(),
      source: 'API-Football',
      starters,
      bench,
      absentees: [],
    }
  } catch {
    return null
  }
}

export function useMatchExtras(params: MatchExtrasParams | null) {
  const [state, setState] = useState<MatchExtrasState>(EMPTY_STATE)

  const fetchExtras = useCallback(async () => {
    if (!params) {
      setState(EMPTY_STATE)
      return
    }

    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const [homeStats, awayStats, h2h, lineup] = await Promise.all([
        fetchTeamStats(params.homeTeamId, params.leagueApiId, params.season ?? null),
        fetchTeamStats(params.awayTeamId, params.leagueApiId, params.season ?? null),
        fetchHeadToHead(params.homeTeamId, params.awayTeamId),
        fetchLineup(params.fixtureId, params.homeTeamId),
      ])

      setState({
        loading: false,
        error: null,
        teams: homeStats && awayStats ? { home: homeStats, away: awayStats } : undefined,
        h2h,
        lineup: lineup ?? null,
      })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load match data'
      setState({
        loading: false,
        error: message,
        teams: undefined,
        h2h: undefined,
        lineup: null,
      })
    }
  }, [params])

  useEffect(() => {
    if (!params) {
      setState(EMPTY_STATE)
      return
    }
    fetchExtras()
  }, [params, fetchExtras])

  return {
    teams: state.teams,
    h2h: state.h2h,
    lineup: state.lineup ?? undefined,
    loading: state.loading,
    error: state.error,
    refresh: fetchExtras,
  }
}
