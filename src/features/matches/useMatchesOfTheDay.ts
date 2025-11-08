/* src/features/matches/useMatchesOfTheDay.ts
 * Fetch fixtures of the current local day (Africa/Casablanca by default),
 * join leagues/teams/odds, map to UI-friendly shapes, and group by league.
 *
 * Notes:
 * - No direct API-Football calls here (DB only); odds fallback handled elsewhere.
 * - If your FK constraint names differ, adjust the select() relation names.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../services/supabase'
import { apiFootball } from '../../lib/apiFootballService'

/** ---- UI Types (kept local to the hook) ---- */
export type UiMatch = {
  id: string // fixture id from API-Football as string
  code: string // legacy identifier (use same as id)
  kickoffISO: string
  kickoffLabel: string
  status: 'upcoming' | 'played'
  rawStatus: string
  normalized: 'upcoming' | 'played'
  isLive: boolean
  homeTeamId?: number | null
  awayTeamId?: number | null
  season?: number | null
  leagueInternalId?: string | null
  hasLineup?: boolean
  home: { id: string; name: string; logo?: string | null; goals?: number | null }
  away: { id: string; name: string; logo?: string | null; goals?: number | null }
  league: { id: string; name: string; logo?: string | null; apiId?: number | null }
  odds?: { home?: number; draw?: number; away?: number; bookmaker?: string }
}

export type UiLeagueGroup = {
  leagueId: string
  leagueName: string
  leagueLogo: string | null
  matches: UiMatch[]
}

/** ---- Helpers ---- */

const CASABLANCA_TZ = 'Africa/Casablanca'

// Local start/end of day → ISO strings suitable for Postgres timestamptz comparisons
function getLocalDayBoundsISO(tz: string = CASABLANCA_TZ) {
  const now = new Date()
  // Compute local midnight/23:59:59.999 using user's local timezone (browser)
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  // These are local Date instances; PostgREST expects ISO UTC — toISOString() converts.
  return { startISO: start.toISOString(), endISO: end.toISOString() }
}

function formatLocalTime(iso: string, tz: string = CASABLANCA_TZ) {
  // Just HH:mm local display (relying on user agent tz)
  const d = new Date(iso)
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: undefined, // browser local
    }).format(d)
  } catch {
    return d.toLocaleTimeString().slice(0, 5)
  }
}

function normalizeStatus(raw?: string): 'upcoming' | 'played' {
  // Map common API-Football statuses; keep simple for UI grouping
  const s = (raw || 'NS').toUpperCase()
  const running = ['NS', 'TBD', 'PST'] // treat as upcoming
  const live = ['1H', 'HT', '2H', 'ET', 'P', 'BT', 'SUSP', 'INT', 'LIVE'] // still "upcoming" in sense of not finished
  if (running.includes(s) || live.includes(s)) return 'upcoming'
  return 'played'
}

function leagueLogoFallback(apiLeagueId?: number | null) {
  return apiLeagueId
    ? `https://media.api-sports.io/football/leagues/${apiLeagueId}.png`
    : null
}

/** ---- Hook ---- */

type HookState = {
  data: UiLeagueGroup[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

type MatchOverride = Partial<
  UiMatch & {
    home: Partial<UiMatch['home']>
    away: Partial<UiMatch['away']>
  }
>

const LIVE_STATUSES = ['1H', 'HT', '2H', 'ET', 'P', 'BT', 'SUSP', 'INT', 'LIVE']
const POLL_INTERVAL_MS = 30_000
const LINEUP_REFRESH_INTERVAL_MS = 120_000

export function useMatchesOfTheDay(): HookState {
  const [{ startISO, endISO }] = useState(() => getLocalDayBoundsISO(CASABLANCA_TZ))
  const [baseGroups, setBaseGroups] = useState<UiLeagueGroup[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<Map<string, MatchOverride>>(new Map())
  const overridesRef = useRef<Map<string, MatchOverride>>(new Map())
  const lineupFetchTrackerRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    overridesRef.current = overrides
  }, [overrides])

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      // IMPORTANT: adjust relation names if your FK names differ.
      // We expect:
      // - fixtures.league_id → leagues.id
      // - fixtures.home_team_id → teams.id (FK name: fixtures_home_team_id_fkey)
      // - fixtures.away_team_id → teams.id (FK name: fixtures_away_team_id_fkey)
      // - odds.fixture_id → fixtures.id (FK name: odds_fixture_id_fkey)
      const { data: rows, error: dbError } = await supabase
        .from('fb_fixtures')
        .select(`
          id,
          date,
          status,
          goals_home,
          goals_away,
          league:fb_leagues (
            id,
            name,
            logo,
            api_league_id,
            season
          ),
          home:fb_teams!fb_fixtures_home_team_id_fkey (
            id,
            name,
            logo
          ),
          away:fb_teams!fb_fixtures_away_team_id_fkey (
            id,
            name,
            logo
          ),
          odds:fb_odds!left (
            home_win,
            draw,
            away_win,
            bookmaker_name
          )
        `)
        .gte('date', startISO)
        .lt('date', endISO)
        .order('date', { ascending: true })

      if (dbError) throw dbError

      // Map rows → UiMatch
      const mapped: UiMatch[] = (rows ?? []).map((r: any) => {
        // odds can come back as array; take first if present
        const o = Array.isArray(r.odds) ? r.odds[0] : r.odds
        const odds = o
          ? {
              home: safeNum(o.home_win),
              draw: safeNum(o.draw),
              away: safeNum(o.away_win),
              bookmaker: o.bookmaker_name ?? undefined,
            }
          : undefined

        const rawStatus = typeof r.status === 'string' ? r.status : 'NS'
        const statusUpper = rawStatus.toUpperCase()
        const norm = normalizeStatus(statusUpper)
        const kickoffTime = r.date ? new Date(r.date).getTime() : Number.POSITIVE_INFINITY
        const hasStarted = kickoffTime <= Date.now()
        const isLive =
          LIVE_STATUSES.includes(statusUpper) || (norm !== 'played' && hasStarted)

        const leagueLogo =
          r.league?.logo ?? leagueLogoFallback(r.league?.api_league_id ?? null)
        const leagueId = r.league?.id != null ? String(r.league.id) : ''
        const homeTeamId = typeof r.home?.id === 'number' ? r.home.id : null
        const awayTeamId = typeof r.away?.id === 'number' ? r.away.id : null

        const match: UiMatch = {
          id: String(r.id),
          code: String(r.id),
          kickoffISO: r.date,
          kickoffLabel: formatLocalTime(r.date),
          status: norm,
          rawStatus: statusUpper,
          normalized: norm,
          isLive,
          homeTeamId,
          awayTeamId,
          season: typeof r.league?.season === 'number' ? r.league.season : null,
          leagueInternalId: leagueId,
          hasLineup: false,
          home: {
            id: homeTeamId != null ? String(homeTeamId) : '',
            name: r.home?.name ?? 'Home',
            logo: r.home?.logo ?? null,
            goals: r.goals_home ?? null,
          },
          away: {
            id: awayTeamId != null ? String(awayTeamId) : '',
            name: r.away?.name ?? 'Away',
            logo: r.away?.logo ?? null,
            goals: r.goals_away ?? null,
          },
          league: {
            id: leagueId,
            name: r.league?.name ?? 'League',
            logo: leagueLogo,
            apiId: r.league?.api_league_id ?? undefined,
          },
          odds,
        }
        return match
      })

      // Group by league
      const byLeague = new Map<string, UiLeagueGroup>()
      for (const m of mapped) {
        const key = m.league.id || m.league.apiId?.toString() || 'unknown'
        const curr = byLeague.get(key)
        if (!curr) {
          byLeague.set(key, {
            leagueId: key,
            leagueName: m.league.name,
            leagueLogo: m.league.logo ?? null,
            matches: [m],
          })
        } else {
          curr.matches.push(m)
        }
      }

      // Sort matches by kickoff, keep league insertion order (already by first appearance)
      const groups = Array.from(byLeague.values()).map((g) => ({
        ...g,
        matches: [...g.matches].sort(
          (a, b) => new Date(a.kickoffISO).getTime() - new Date(b.kickoffISO).getTime()
        ),
      }))

      setBaseGroups(groups)
      setOverrides((prev) => {
        const validIds = new Set(groups.flatMap((g) => g.matches.map((m) => m.id)))
        const next = new Map<string, MatchOverride>()
        prev.forEach((value, key) => {
          if (validIds.has(key)) {
            next.set(key, value)
          }
        })
        return next
      })
    } catch (e: any) {
      setError(e?.message || 'Failed to load matches')
      setBaseGroups([])
    } finally {
      setIsLoading(false)
    }
  }, [startISO, endISO])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const refresh = useCallback(async () => {
    await fetchData()
  }, [fetchData])

  const mergedGroups = useMemo(
    () => applyOverrides(baseGroups, overrides),
    [baseGroups, overrides]
  )

  useEffect(() => {
    if (!baseGroups.length) return

    let cancelled = false
    const poll = async () => {
      if (cancelled) return

      const latestGroups = applyOverrides(baseGroups, overridesRef.current)
      const mergedMatches = latestGroups.flatMap((group) => group.matches)
      const now = Date.now()
      const watchList = mergedMatches.filter((match) => {
        if (match.normalized === 'played') return false
        const kickoff = new Date(match.kickoffISO).getTime()
        return match.isLive || kickoff <= now
      })

      if (!watchList.length) {
        return
      }

      const updates = new Map<string, MatchOverride>()
      const chunks = chunkMatches(watchList, 5)

      for (const chunk of chunks) {
        const ids = chunk.map((m) => m.id)
        try {
          const params =
            ids.length === 1 ? { id: ids[0] } : { ids: ids.join('-') }
          const response = await apiFootball('/fixtures', params)
          const items: any[] = Array.isArray(response?.response) ? response.response : []

          items.forEach((item) => {
            const fixtureId = item?.fixture?.id
            if (!fixtureId) return
            const matchId = String(fixtureId)
            const statusShort = item?.fixture?.status?.short ?? 'NS'
            const statusUpper = String(statusShort).toUpperCase()
            const normalized = normalizeStatus(statusUpper)
            const kickoffISO = item?.fixture?.date ?? null
            const hasStarted =
              kickoffISO !== null ? new Date(kickoffISO).getTime() <= Date.now() : false
            const isLive =
              normalized !== 'played' && (LIVE_STATUSES.includes(statusUpper) || hasStarted)

            const homeGoals = safeNum(item?.goals?.home)
            const awayGoals = safeNum(item?.goals?.away)

            updates.set(matchId, mergeOverride(updates.get(matchId), {
              rawStatus: statusUpper,
              normalized,
              status: normalized,
              isLive,
              kickoffISO: kickoffISO ?? undefined,
              kickoffLabel: kickoffISO ? formatLocalTime(kickoffISO) : undefined,
              home: {
                goals: homeGoals ?? null,
              },
              away: {
                goals: awayGoals ?? null,
              },
            }))

            if (normalized === 'played') {
              updates.set(matchId, mergeOverride(updates.get(matchId), { isLive: false }))
            }
          })

          await maybeFetchLineups(ids, updates, lineupFetchTrackerRef)
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[useMatchesOfTheDay] live update error', err)
        }
      }

      if (!cancelled && updates.size) {
        setOverrides((prev) => {
          const next = new Map(prev)
          updates.forEach((value, key) => {
            next.set(key, mergeOverride(next.get(key), value))
          })
          return next
        })
      }
    }

    poll()
    const intervalId = window.setInterval(poll, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [baseGroups])

    return {
      data: mergedGroups,
      isLoading,
      error,
      refresh,
    }
}

/** ---- Small util ---- */
function safeNum(x: any): number | undefined {
  const n = Number(x)
  return Number.isFinite(n) ? n : undefined
}

function applyOverrides(
  groups: UiLeagueGroup[],
  overrides: Map<string, MatchOverride>
): UiLeagueGroup[] {
  if (!overrides.size) return groups
  return groups.map((group) => ({
    ...group,
    matches: group.matches.map((match) => {
      const patch = overrides.get(match.id)
      if (!patch) return match
      return mergeMatch(match, patch)
    }),
  }))
}

function mergeMatch(match: UiMatch, patch: MatchOverride): UiMatch {
  const merged: UiMatch = {
    ...match,
    ...patch,
    home: {
      ...match.home,
      ...(patch.home ?? {}),
    },
    away: {
      ...match.away,
      ...(patch.away ?? {}),
    },
  }
  return merged
}

function mergeOverride(
  current: MatchOverride | undefined,
  incoming: MatchOverride
): MatchOverride {
  if (!current) return incoming
  return {
    ...current,
    ...incoming,
    home: { ...(current.home ?? {}), ...(incoming.home ?? {}) },
    away: { ...(current.away ?? {}), ...(incoming.away ?? {}) },
  }
}

function chunkMatches(matches: UiMatch[], size: number): UiMatch[][] {
  const chunks: UiMatch[][] = []
  for (let i = 0; i < matches.length; i += size) {
    chunks.push(matches.slice(i, i + size))
  }
  return chunks
}

async function maybeFetchLineups(
  ids: string[],
  updates: Map<string, MatchOverride>,
  trackerRef: React.MutableRefObject<Map<string, number>>
) {
  const now = Date.now()
  for (const id of ids) {
    const lastFetch = trackerRef.current.get(id) ?? 0
    if (now - lastFetch < LINEUP_REFRESH_INTERVAL_MS) {
      continue
    }
    try {
      const lineupResponse = await apiFootball('/fixtures/lineups', { fixture: id })
      const entries: any[] = Array.isArray(lineupResponse?.response)
        ? lineupResponse.response
        : []
      const hasLineup = entries.some(
        (entry) => Array.isArray(entry?.startXI) && entry.startXI.length > 0
      )
      trackerRef.current.set(id, now)
      if (hasLineup) {
        updates.set(id, mergeOverride(updates.get(id), { hasLineup: true }))
      }
    } catch (err) {
      trackerRef.current.set(id, now)
      // eslint-disable-next-line no-console
      console.error('[useMatchesOfTheDay] lineup fetch error', err)
    }
  }
}
