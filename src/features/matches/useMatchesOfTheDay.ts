/* src/features/matches/useMatchesOfTheDay.ts
 * Fetch fixtures of the current local day (Africa/Casablanca by default),
 * join leagues/teams/odds, map to UI-friendly shapes, and group by league.
 *
 * Notes:
 * - No direct API-Football calls here (DB only); odds fallback handled elsewhere.
 * - If your FK constraint names differ, adjust the select() relation names.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../services/supabase'

/** ---- UI Types (kept local to the hook) ---- */
export type UiMatch = {
  id: string // code (fixture id as string)
  kickoffISO: string
  kickoffLabel: string
  status: string // raw (NS, 1H, FT, etc.) or normalized
  normalized: 'upcoming' | 'played'
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
  const live = ['1H', 'HT', '2H', 'ET', 'P', 'BT', 'SUSP', 'INT'] // still "upcoming" in sense of not finished
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

export function useMatchesOfTheDay(): HookState {
  const [{ startISO, endISO }] = useState(() => getLocalDayBoundsISO(CASABLANCA_TZ))
  const [data, setData] = useState<UiLeagueGroup[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        .from('fixtures')
        .select(`
          id,
          date,
          status,
          goals_home,
          goals_away,
          league:leagues (
            id,
            name,
            logo,
            api_league_id
          ),
          home:teams!fixtures_home_team_id_fkey (
            id,
            name,
            logo
          ),
          away:teams!fixtures_away_team_id_fkey (
            id,
            name,
            logo
          ),
          odds:odds!odds_fixture_id_fkey (
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

        const leagueLogo =
          r.league?.logo ?? leagueLogoFallback(r.league?.api_league_id ?? null)

        const norm = normalizeStatus(r.status)

        const m: UiMatch = {
          id: String(r.id),
          kickoffISO: r.date,
          kickoffLabel: formatLocalTime(r.date),
          status: r.status ?? 'NS',
          normalized: norm,
          home: {
            id: r?.home?.id ? String(r.home.id) : '',
            name: r?.home?.name ?? 'Home',
            logo: r?.home?.logo ?? null,
            goals: r?.goals_home ?? null,
          },
          away: {
            id: r?.away?.id ? String(r.away.id) : '',
            name: r?.away?.name ?? 'Away',
            logo: r?.away?.logo ?? null,
            goals: r?.goals_away ?? null,
          },
          league: {
            id: r?.league?.id ? String(r.league.id) : '',
            name: r?.league?.name ?? 'League',
            logo: leagueLogo,
            apiId: r?.league?.api_league_id ?? undefined,
          },
          odds,
        }
        return m
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

      setData(groups)
    } catch (e: any) {
      setError(e?.message || 'Failed to load matches')
      setData([])
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

  return useMemo(
    () => ({ data, isLoading, error, refresh }),
    [data, isLoading, error, refresh]
  )
}

/** ---- Small util ---- */
function safeNum(x: any): number | undefined {
  const n = Number(x)
  return Number.isFinite(n) ? n : undefined
}
