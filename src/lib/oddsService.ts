// src/lib/oddsService.ts
import { apiFootball } from './apiFootballService'

export type MatchWinnerOdds = {
  home?: number | null
  draw?: number | null
  away?: number | null
  bookmaker?: string | null
}

type OddsApiResponse = {
  response?: Array<{
    fixture?: { id?: number }
    bookmakers?: Array<{
      id: number
      name: string
      bets?: Array<{
        id: number
        name: string
        values?: Array<{ value: string | number; odd: string }>
      }>
    }>
  }>
}

/**
 * Default bookmaker priority by API-Football IDs.
 * Adjust as needed: 8=Bet365, 3=Pinnacle, 6=Bwin (example IDs).
 */
const DEFAULT_BOOKMAKER_PRIORITY = [8, 3, 6]

const SLEEP_MS_BETWEEN_CALLS = 150 // gentle throttle

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}

/**
 * Extracts Match Winner (1X2) from a single response item, honoring a bookmaker priority.
 */
function extractMatchWinnerFromItem(
  item: OddsApiResponse['response'][number],
  priority: number[]
): MatchWinnerOdds | null {
  if (!item?.bookmakers?.length) return null

  const byId = new Map<number, (typeof item.bookmakers)[number]>()
  for (const bk of item.bookmakers) byId.set(bk.id, bk)

  // try priority list first
  let chosen = priority.map((id) => byId.get(id)).find(Boolean) ?? item.bookmakers[0]

  if (!chosen?.bets?.length) return null

  // Find 1X2 (Match Winner). In API-Football this is usually bet id 1, but
  // we also check by name to be safe.
  const matchWinner =
    chosen.bets.find((b) => b.id === 1) ?? chosen.bets.find((b) => b.name?.toLowerCase() === 'match winner')

  if (!matchWinner?.values?.length) return null

  // Values can be "Home", "Draw", "Away" (strings) with string odds.
  let home: number | null = null
  let draw: number | null = null
  let away: number | null = null

  for (const v of matchWinner.values) {
    const label = typeof v.value === 'string' ? v.value.toLowerCase() : String(v.value)
    const oddNum = Number(v.odd)
    if (!Number.isFinite(oddNum)) continue

    if (label === 'home') home = oddNum
    else if (label === 'draw') draw = oddNum
    else if (label === 'away') away = oddNum
  }

  return {
    home,
    draw,
    away,
    bookmaker: chosen?.name ?? null,
  }
}

/**
 * Fetch 1X2 odds for a list of fixture IDs.
 * Returns a Map keyed by fixtureId (number) → MatchWinnerOdds.
 */
export async function fetchMatchWinnerOddsForFixtures(
  fixtureIds: number[],
  bookmakerPriority: number[] = DEFAULT_BOOKMAKER_PRIORITY
): Promise<Map<number, MatchWinnerOdds>> {
  const result = new Map<number, MatchWinnerOdds>()

  for (let i = 0; i < fixtureIds.length; i++) {
    const fixture = fixtureIds[i]
    try {
      const data = await apiFootball<OddsApiResponse>('/odds', { fixture })
      const item = data?.response?.[0]
      const parsed = extractMatchWinnerFromItem(item, bookmakerPriority)
      if (parsed) result.set(fixture, parsed)
    } catch {
      // Soft-fail per fixture; continue loop
    }
    if (i < fixtureIds.length - 1) await sleep(SLEEP_MS_BETWEEN_CALLS)
  }

  return result
}
