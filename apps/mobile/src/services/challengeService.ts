import { supabase } from './supabase'
import type {
  SportimeGame,
  UserChallengeEntry,
  UserSwipeEntry,
  UserFantasyTeam,
  GameRewardTier,
  RewardItem,
  TournamentType,
  GameType,
  DailyChallengeEntry,
  ChallengeBet,
} from '../types'
import type { Challenge, ChallengeMatch } from '../types'
import { normalizeTournamentTier, normalizeDurationType } from '../config/constants'
import { detectAndSyncMissingOdds, type FixtureForOddsCheck } from './oddsSyncService'

type ChallengeConfigRow = {
  config_type: string
  config_data: Record<string, any> | null
}

type ChallengeLeagueRow = {
  league_id: string | null
  league?: {
    id: string
    name: string
    logo: string | null
    api_league_id: number | null
  } | null
}

type ChallengeRow = {
  id: string
  name: string
  description: string | null
  game_type: string
  format: string | null
  start_date: string
  end_date: string
  entry_cost: number | null
  prizes: any
  rules: Record<string, any> | null
  status: string | null
  entry_conditions: Record<string, any> | null
  challenge_configs?: ChallengeConfigRow[] | null
  challenge_leagues?: ChallengeLeagueRow[] | null
}

type ChallengeParticipantRow = {
  challenge_id: string
  user_id: string
}

type ChallengeBetRow = {
  challenge_match_id: string
  prediction: 'teamA' | 'draw' | 'teamB'
  amount: number
  odds_snapshot: { teamA: number; draw: number; teamB: number } | null
  status: 'pending' | 'won' | 'lost' | 'void' | null
  points_earned: number | null
}

type ChallengeDailyEntryRow = {
  day_number: number
  booster_type: 'x2' | 'x3' | null
  booster_match_id: string | null
  bets: ChallengeBetRow[] | null
}

type ChallengeEntryRow = {
  id: string
  challenge_id: string
  entry_method: 'coins' | 'ticket'
  ticket_id: string | null
  daily_entries: ChallengeDailyEntryRow[] | null
}

export type ChallengeCatalogResult = {
  games: SportimeGame[]
  userChallengeEntries: UserChallengeEntry[]
  userSwipeEntries: UserSwipeEntry[]
  userFantasyTeams: UserFantasyTeam[]
  joinedChallengeIds: string[]
}

const STATUS_MAP: Record<string, SportimeGame['status']> = {
  upcoming: 'Upcoming',
  active: 'Ongoing',
  ongoing: 'Ongoing',
  finished: 'Finished',
  cancelled: 'Cancelled',
}

const GAME_TYPE_ALLOWLIST: GameType[] = ['betting', 'prediction', 'fantasy', 'fantasy-live']

const BOOKMAKER_PRIORITY = ['Pinnacle', 'Bet365']

function mapStatus(status: string | null | undefined): SportimeGame['status'] {
  if (!status) return 'Upcoming'
  const normalized = status.toLowerCase()
  return STATUS_MAP[normalized] ?? 'Upcoming'
}

function mapGameType(type: string | null | undefined): GameType {
  if (!type) return 'betting'
  const lower = type.toLowerCase()
  if ((GAME_TYPE_ALLOWLIST as string[]).includes(lower)) {
    return lower as GameType
  }
  // Default unknown types to betting for now
  return 'betting'
}

function mapRewards(prizes: any): GameRewardTier[] {
  if (!Array.isArray(prizes)) return []
  return prizes
    .map((tier: any, index: number): GameRewardTier | null => {
      if (!tier) return null
      const rewards: RewardItem[] = Array.isArray(tier.rewards)
        ? tier.rewards.map((reward: any, rewardIndex: number): RewardItem | null => {
            if (!reward || typeof reward !== 'object') return null
            const rawType = reward.type ?? reward.reward_type
            const allowedRewardTypes: RewardItem['type'][] = ['ticket', 'spin', 'xp', 'giftcard', 'masterpass', 'custom', 'premium_3d', 'premium_7d', 'coins']
            const normalizedType: RewardItem['type'] = typeof rawType === 'string' && allowedRewardTypes.includes(rawType as RewardItem['type'])
              ? (rawType as RewardItem['type'])
              : 'custom'

            return {
              id: reward.id ?? `${index}-${rewardIndex}`,
              type: normalizedType,
              value: reward.value ?? reward.amount ?? null,
              tier: reward.tier ?? undefined,
              name: reward.name ?? undefined,
              logo: reward.logo ?? undefined,
            }
          }).filter(Boolean) as RewardItem[]
        : []

      const positionCandidate = tier.positionType ?? tier.position_type
      const allowedPositionTypes: GameRewardTier['positionType'][] = ['rank', 'range', 'percent']
      const positionType: GameRewardTier['positionType'] = typeof positionCandidate === 'string' && allowedPositionTypes.includes(positionCandidate as GameRewardTier['positionType'])
        ? (positionCandidate as GameRewardTier['positionType'])
        : 'rank'
      const start = typeof tier.start === 'number' ? tier.start : 1
      const end =
        typeof tier.end === 'number'
          ? tier.end
          : typeof tier.range_end === 'number'
            ? tier.range_end
            : undefined

      return {
        id: tier.id ?? String(index),
        positionType,
        start,
        end,
        rewards,
      }
    })
    .filter(Boolean) as GameRewardTier[]
}

function extractConfigValue<T>(
  configs: ChallengeConfigRow[] | null | undefined,
  key: string
): T | undefined {
  if (!configs) return undefined
  for (const cfg of configs) {
    const data = cfg?.config_data
    if (data && key in data) {
      return data[key] as T
    }
  }
  return undefined
}

function mapChallengeRow(
  row: ChallengeRow,
  participantCount: number,
  matches?: Array<{ id: string; day: number; kickoffTime: string | undefined; result: 'teamA' | 'draw' | 'teamB' | undefined }>
): SportimeGame {
  const rules = row.rules ?? {}
  const entryConditions = row.entry_conditions ?? {}
  const configs = row.challenge_configs ?? []

  const tierRaw =
    extractConfigValue<string>(configs, 'tier') ??
    (rules?.tier as string | undefined)
  const durationRaw =
    extractConfigValue<string>(configs, 'duration_type') ??
    (rules?.duration_type as string | undefined)

  const tier = normalizeTournamentTier(tierRaw) ?? 'amateur'
  const durationType = normalizeDurationType(durationRaw) ?? 'flash'

  const minimumLevel =
    extractConfigValue<string>(configs, 'minimum_level') ??
    (entryConditions?.minimum_level as string | undefined)
  const requiredBadges =
    extractConfigValue<string[]>(configs, 'required_badges') ??
    (entryConditions?.required_badges as string[] | undefined) ??
    []
  const requiresSubscription =
    extractConfigValue<boolean>(configs, 'requires_subscription') ??
    (entryConditions?.requires_subscription as boolean | undefined) ??
    false
  const minimumPlayers =
    extractConfigValue<number>(configs, 'minimum_players') ??
    (rules?.minimum_players as number | undefined) ??
    0
  const maximumPlayers =
    extractConfigValue<number>(configs, 'maximum_players') ??
    (rules?.maximum_players as number | undefined) ??
    0

  // Extract period_type from rules (matchdays or calendar)
  const periodType = (rules?.period_type as 'matchdays' | 'calendar' | undefined) ?? 'matchdays'

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    league_id: row.challenge_leagues?.[0]?.league_id ?? undefined,
    league_name: row.challenge_leagues?.[0]?.league?.name ?? undefined,
    league_logo: row.challenge_leagues?.[0]?.league?.logo ??
      (row.challenge_leagues?.[0]?.league?.api_league_id
        ? `https://media.api-sports.io/football/leagues/${row.challenge_leagues[0].league.api_league_id}.png`
        : undefined),
    start_date: row.start_date,
    end_date: row.end_date,
    game_type: mapGameType(row.game_type),
    tier,
    duration_type: durationType,
    entry_cost: row.entry_cost ?? 0,
    custom_entry_cost_enabled: rules?.custom_entry_cost_enabled ?? undefined,
    is_linkable: rules?.is_linkable ?? undefined,
    reward_tier: rules?.reward_tier ?? undefined,
    format: (row.format ?? 'leaderboard') as SportimeGame['format'],
    requires_subscription: requiresSubscription,
    minimum_level: minimumLevel,
    required_badges: requiredBadges,
    conditions_logic: entryConditions?.conditions_logic ?? undefined,
    minimum_players: minimumPlayers,
    maximum_players: maximumPlayers,
    status: mapStatus(row.status),
    totalPlayers: participantCount,
    participants: [],
    rewards: mapRewards(row.prizes),
    challengeBalance: rules?.challengeBalance ?? rules?.challenge_balance ?? undefined,
    // Map matches for betting game categorization (minimal SwipeMatch format)
    matches: matches?.map(m => ({
      id: m.id,
      day: m.day,
      kickoffTime: m.kickoffTime,
      result: m.result,
      // Minimal required fields for SwipeMatch type
      teamA: { name: '', emoji: '' },
      teamB: { name: '', emoji: '' },
      league: { name: '', logo: '' },
    })),
    gameWeeks: undefined,
    challengeId: row.id,
    period_type: periodType,
  }
}

function mapParticipantEntries(
  challengesById: Map<string, SportimeGame>,
  participants: ChallengeParticipantRow[],
  userId?: string | null,
  existingEntries?: Map<string, UserChallengeEntry>
) {
  const counts = new Map<string, number>()
  const userChallengeEntries: UserChallengeEntry[] = []
  const userSwipeEntries: UserSwipeEntry[] = []
  const userFantasyTeams: UserFantasyTeam[] = []
  const joinedIds = new Set<string>()

  for (const participant of participants) {
    const challenge = challengesById.get(participant.challenge_id)
    if (!challenge) continue

    counts.set(
      participant.challenge_id,
      (counts.get(participant.challenge_id) ?? 0) + 1
    )

    if (userId && participant.user_id === userId) {
      joinedIds.add(participant.challenge_id)

      const existing = existingEntries?.get(participant.challenge_id)
      if (existing) {
        if (challenge.game_type === 'betting') {
          userChallengeEntries.push(existing)
        }
        continue
      }

      switch (challenge.game_type) {
        case 'betting':
          userChallengeEntries.push({
            user_id: participant.user_id,
            challengeId: participant.challenge_id,
            dailyEntries: [],
            entryMethod: 'coins',
          })
          break
        case 'prediction':
          userSwipeEntries.push({
            user_id: participant.user_id,
            matchDayId: participant.challenge_id,
            predictions: [],
            submitted_at: null,
          })
          break
        case 'fantasy':
        case 'fantasy-live':
          userFantasyTeams.push({
            userId: participant.user_id,
            gameId: participant.challenge_id,
            gameWeekId: participant.challenge_id,
            starters: [],
            substitutes: [],
            captain_id: '',
            booster_used: null,
            fatigue_state: {},
          })
          break
        default:
          break
      }
    }
  }

  return {
    counts,
    userChallengeEntries,
    userSwipeEntries,
    userFantasyTeams,
    joinedIds,
  }
}

export async function fetchChallengeCatalog(userId?: string | null): Promise<ChallengeCatalogResult> {
  const { data: challengeRows, error: challengeError } = await supabase
    .from('challenges')
    .select(`
      id,
      name,
      description,
      game_type,
      format,
      start_date,
      end_date,
      entry_cost,
      prizes,
      rules,
      status,
      entry_conditions,
      challenge_configs (
        config_type,
        config_data
      ),
      challenge_leagues (
        league_id,
        league:fb_leagues (
          name,
          logo,
          api_league_id
        )
      )
    `)
    .order('start_date', { ascending: true })

  if (challengeError) {
    console.error('[challengeService] Failed to fetch challenges', challengeError)
    throw challengeError
  }

  const challenges = (challengeRows ?? []) as ChallengeRow[]
  if (challenges.length === 0) {
    return {
      games: [],
      userChallengeEntries: [],
      userSwipeEntries: [],
      userFantasyTeams: [],
      joinedChallengeIds: [],
    }
  }

  const challengeIds = challenges.map(ch => ch.id)

  // Fetch first kickoff time for each challenge (for entry deadline calculation)
  // We need to check both structures:
  // 1. Betting challenges: challenge_matches → matches (kickoff_time)
  // 2. Swipe challenges: challenge_matchdays → matchday_fixtures → fb_fixtures (date)

  const firstKickoffByChallenge = new Map<string, string>()

  // 1. Try betting structure: challenge_matches → matches
  const { data: bettingKickoffRows, error: bettingKickoffError } = await supabase
    .from('challenge_matches')
    .select(`
      challenge_id,
      match:matches (
        kickoff_time
      )
    `)
    .in('challenge_id', challengeIds)

  if (bettingKickoffError) {
    console.warn('[challengeService] Failed to fetch betting kickoff times', bettingKickoffError)
  }

  if (bettingKickoffRows) {
    const kickoffsByChallenge = new Map<string, string[]>()
    for (const row of bettingKickoffRows as Array<{ challenge_id: string; match: { kickoff_time: string | null } | null }>) {
      const kickoff = row.match?.kickoff_time
      if (kickoff) {
        if (!kickoffsByChallenge.has(row.challenge_id)) {
          kickoffsByChallenge.set(row.challenge_id, [])
        }
        kickoffsByChallenge.get(row.challenge_id)!.push(kickoff)
      }
    }
    for (const [challengeId, kickoffs] of kickoffsByChallenge.entries()) {
      const earliest = kickoffs.sort()[0]
      if (earliest) {
        firstKickoffByChallenge.set(challengeId, earliest)
      }
    }
  }

  // 2. Try swipe structure: use challenge_matchdays.deadline directly
  // The deadline field contains the first kickoff time for each matchday
  const { data: swipeKickoffRows, error: swipeKickoffError } = await supabase
    .from('challenge_matchdays')
    .select('challenge_id, deadline')
    .in('challenge_id', challengeIds)
    .not('deadline', 'is', null)
    .order('deadline', { ascending: true })

  // 2b. Fetch matchday details for betting game categorization
  // We need day info and match results to determine if games are in "Awaiting Results"
  const { data: matchdayDetailsRows, error: matchdayDetailsError } = await supabase
    .from('challenge_matches')
    .select(`
      challenge_id,
      day_number,
      match:matches (
        kickoff_time,
        status,
        score
      )
    `)
    .in('challenge_id', challengeIds)

  if (matchdayDetailsError) {
    console.warn('[challengeService] Failed to fetch matchday details for categorization', matchdayDetailsError)
  }

  // 2c. Fetch ALL matchdays from challenge_matchdays (including future ones without assigned matches)
  // This is critical for betting games to show "Place Bets" instead of "View Results"
  const { data: allMatchdaysRows, error: allMatchdaysError } = await supabase
    .from('challenge_matchdays')
    .select('id, challenge_id, date, deadline')
    .in('challenge_id', challengeIds)
    .order('date', { ascending: true })

  if (allMatchdaysError) {
    console.warn('[challengeService] Failed to fetch all matchdays', allMatchdaysError)
  }

  // Build matches array per challenge for betting game categorization
  const matchesByChallenge = new Map<string, Array<{
    id: string
    day: number
    kickoffTime: string | undefined
    result: 'teamA' | 'draw' | 'teamB' | undefined
  }>>()

  // Track which (challenge_id, day_number) pairs have been added from challenge_matches
  const existingDays = new Set<string>()

  if (matchdayDetailsRows) {
    for (const row of matchdayDetailsRows as Array<{
      challenge_id: string
      day_number: number | null
      match: { kickoff_time: string | null; status: string | null; score: Record<string, any> | null } | null
    }>) {
      if (!matchesByChallenge.has(row.challenge_id)) {
        matchesByChallenge.set(row.challenge_id, [])
      }

      const match = row.match
      if (!match) continue

      // Track this day as having real match data
      existingDays.add(`${row.challenge_id}-${row.day_number}`)

      // Determine result from status and score
      const status = (match.status ?? 'NS').toUpperCase()
      const finishedStatuses = ['FT', 'AET', 'PEN', 'AWARDED', 'W.O', 'CANC', 'ABD', 'POST']
      const isFinished = finishedStatuses.includes(status)

      let result: 'teamA' | 'draw' | 'teamB' | undefined
      if (isFinished && match.score) {
        const homeGoals = typeof match.score.home === 'number'
          ? match.score.home
          : typeof match.score.goals_home === 'number'
            ? match.score.goals_home
            : null
        const awayGoals = typeof match.score.away === 'number'
          ? match.score.away
          : typeof match.score.goals_away === 'number'
            ? match.score.goals_away
            : null

        if (homeGoals !== null && awayGoals !== null) {
          result = homeGoals === awayGoals ? 'draw' : homeGoals > awayGoals ? 'teamA' : 'teamB'
        }
      }

      matchesByChallenge.get(row.challenge_id)!.push({
        id: `${row.challenge_id}-${row.day_number}`,
        day: row.day_number ?? 1,
        kickoffTime: match.kickoff_time ?? undefined,
        result,
      })
    }
  }

  // Fetch fixture statuses for matchdays via matchday_fixtures
  // This is needed to determine if a matchday is finished even if no challenge_matches exist
  // Include date to identify the LAST match (by kickoff time)
  const matchdayFixturesMap = new Map<string, Array<{ status: string, date: string | null }>>()
  const { data: matchdayFixturesData, error: matchdayFixturesError } = await supabase
    .from('matchday_fixtures')
    .select('matchday_id, fixture:fb_fixtures(status, date)')

  if (matchdayFixturesError) {
    console.warn('[challengeService] Failed to fetch matchday fixtures for status check', matchdayFixturesError)
  }

  if (matchdayFixturesData) {
    for (const row of matchdayFixturesData as Array<{
      matchday_id: string
      fixture: { status: string | null, date: string | null } | null
    }>) {
      const matchdayId = row.matchday_id
      const fixtureStatus = row.fixture?.status
      const fixtureDate = row.fixture?.date
      if (matchdayId && fixtureStatus) {
        if (!matchdayFixturesMap.has(matchdayId)) {
          matchdayFixturesMap.set(matchdayId, [])
        }
        matchdayFixturesMap.get(matchdayId)!.push({ status: fixtureStatus, date: fixtureDate ?? null })
      }
    }
  }

  // Add future matchdays from challenge_matchdays that don't have assigned matches yet
  // These are matchdays with deadline set but no matches in challenge_matches
  if (allMatchdaysRows) {
    // Group by challenge_id to calculate day numbers based on date order
    const matchdaysByChallenge = new Map<string, Array<{
      id: string
      date: string | null
      deadline: string | null
    }>>()

    for (const row of allMatchdaysRows as Array<{
      id: string
      challenge_id: string
      date: string | null
      deadline: string | null
    }>) {
      if (!matchdaysByChallenge.has(row.challenge_id)) {
        matchdaysByChallenge.set(row.challenge_id, [])
      }
      matchdaysByChallenge.get(row.challenge_id)!.push({
        id: row.id,
        date: row.date,
        deadline: row.deadline,
      })
    }

    // Process each challenge's matchdays
    for (const [challengeId, matchdays] of matchdaysByChallenge) {
      // Sort by date to assign day numbers
      const sortedMatchdays = matchdays.sort((a, b) => {
        const dateA = a.date ?? a.deadline ?? ''
        const dateB = b.date ?? b.deadline ?? ''
        return dateA.localeCompare(dateB)
      })

      sortedMatchdays.forEach((row, index) => {
        const dayNumber = index + 1
        const dayKey = `${challengeId}-${row.date ?? dayNumber}`

        // Skip if we already have match data for this day
        if (existingDays.has(dayKey)) return

        // Only add if we have a date or deadline
        if (!row.date && !row.deadline) return

        if (!matchesByChallenge.has(challengeId)) {
          matchesByChallenge.set(challengeId, [])
        }

        // Check if the LAST fixture (by kickoff time) for this matchday is finished
        // Rule: When the last match has status 'FT', move to next matchday (Play Now)
        const matchdayFixtures = matchdayFixturesMap.get(row.id) ?? []
        const finishedStatuses = ['FT', 'AET', 'PEN', 'AWARDED', 'W.O', 'CANC', 'ABD', 'POST']

        let lastMatchFinished = false
        let firstKickoffTime: string | undefined = undefined

        if (matchdayFixtures.length > 0) {
          // Sort by date (kickoff) ascending to find the first kickoff
          const sortedByDateAsc = [...matchdayFixtures]
            .filter(f => f.date)
            .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())

          if (sortedByDateAsc.length > 0) {
            firstKickoffTime = sortedByDateAsc[0].date!
          }

          // Sort by date (kickoff) descending to find the last match
          const sortedByDateDesc = [...matchdayFixtures].sort((a, b) => {
            const dateA = a.date ? new Date(a.date).getTime() : 0
            const dateB = b.date ? new Date(b.date).getTime() : 0
            return dateB - dateA  // Descending: last match first
          })
          const lastMatch = sortedByDateDesc[0]
          lastMatchFinished = finishedStatuses.includes((lastMatch.status ?? 'NS').toUpperCase())
        }

        // Skip matchdays without fixtures (empty days with no matches)
        // This prevents empty matchdays from blocking game status transitions
        if (matchdayFixtures.length === 0) {
          return // Skip this matchday entirely
        }

        // Add placeholder match for this matchday
        // kickoffTime = first fixture kickoff (real deadline), fallback to deadline field
        // result = 'draw' if last match finished
        matchesByChallenge.get(challengeId)!.push({
          id: row.id,
          day: dayNumber,
          kickoffTime: firstKickoffTime ?? row.deadline ?? undefined,
          result: lastMatchFinished ? 'draw' : undefined, // Mark as finished if LAST match is done
        })
      })
    }
  }

  // 2d. For betting/prediction games without matchdays in challenge_matchdays or challenge_matches,
  // auto-generate matchdays from fb_fixtures based on period_type
  const challengesNeedingAutoMatchdays = challenges.filter(ch => {
    const gameType = ch.game_type?.toLowerCase()
    const needsMatches = gameType === 'betting' || gameType === 'prediction'
    const hasMatches = matchesByChallenge.has(ch.id) && matchesByChallenge.get(ch.id)!.length > 0
    return needsMatches && !hasMatches
  })

  if (challengesNeedingAutoMatchdays.length > 0) {
    // Get league IDs for these challenges
    const challengeLeagueMap = new Map<string, string>()
    for (const ch of challengesNeedingAutoMatchdays) {
      const leagueId = ch.challenge_leagues?.[0]?.league_id
      if (leagueId) {
        challengeLeagueMap.set(ch.id, leagueId)
      }
    }

    const leagueIds = Array.from(new Set(challengeLeagueMap.values()))

    if (leagueIds.length > 0) {
      // Fetch fixtures for these leagues within challenge date ranges
      const { data: fixturesData, error: fixturesError } = await supabase
        .from('fb_fixtures')
        .select('id, date, status, goals_home, goals_away, league_id, round')
        .in('league_id', leagueIds)
        .order('date', { ascending: true })

      if (fixturesError) {
        console.warn('[challengeService] Failed to fetch fixtures for betting games', fixturesError)
      }

      if (fixturesData) {
        // Group fixtures by challenge based on date range and period_type
        for (const ch of challengesNeedingAutoMatchdays) {
          const leagueId = challengeLeagueMap.get(ch.id)
          if (!leagueId) continue

          const rules = ch.rules ?? {}
          const periodType = (rules?.period_type as 'matchdays' | 'calendar') ?? 'matchdays'

          // Use date-only string comparison to avoid timezone issues
          // new Date("2025-12-06") creates UTC midnight, but setHours() uses local time
          // This caused dates to shift by timezone offset
          const startDateStr = ch.start_date.split('T')[0]  // "2025-12-01"
          const endDateStr = ch.end_date.split('T')[0]      // "2025-12-06"

          // Filter fixtures for this challenge's league and date range
          const challengeFixtures = fixturesData.filter(f => {
            if (f.league_id !== leagueId) return false
            const fixtureDateStr = f.date.split('T')[0]     // "2025-12-06"
            return fixtureDateStr >= startDateStr && fixtureDateStr <= endDateStr
          })

          if (challengeFixtures.length === 0) continue

          // Group fixtures by matchday
          const matchdayMap = new Map<string | number, Array<typeof challengeFixtures[0]>>()

          for (const fixture of challengeFixtures) {
            let groupKey: string | number

            if (periodType === 'matchdays') {
              // Group by round (e.g., "Regular Season - 15")
              groupKey = fixture.round ?? 'unknown'
            } else {
              // Calendar: group by date (YYYY-MM-DD)
              groupKey = fixture.date.split('T')[0]
            }

            if (!matchdayMap.has(groupKey)) {
              matchdayMap.set(groupKey, [])
            }
            matchdayMap.get(groupKey)!.push(fixture)
          }

          // Convert to matchday entries sorted by earliest fixture date
          const sortedMatchdays = Array.from(matchdayMap.entries())
            .map(([key, fixtures]) => ({
              key,
              fixtures,
              earliestDate: fixtures.reduce((min, f) => f.date < min ? f.date : min, fixtures[0].date)
            }))
            .sort((a, b) => a.earliestDate.localeCompare(b.earliestDate))

          // Create match entries for each matchday
          if (!matchesByChallenge.has(ch.id)) {
            matchesByChallenge.set(ch.id, [])
          }

          sortedMatchdays.forEach((matchday, index) => {
            const dayNumber = index + 1
            const finishedStatuses = ['FT', 'AET', 'PEN', 'AWARDED', 'W.O', 'CANC', 'ABD', 'POST']

            // Check if the LAST fixture (by kickoff time) in this matchday is finished
            // Rule: When the last match has status 'FT', move to next matchday (Play Now)
            let lastMatchFinished = false
            if (matchday.fixtures.length > 0) {
              // Sort by date (kickoff) descending to find the last match
              const sortedFixtures = [...matchday.fixtures].sort((a, b) => {
                const dateA = a.date ? new Date(a.date).getTime() : 0
                const dateB = b.date ? new Date(b.date).getTime() : 0
                return dateB - dateA  // Descending: last match first
              })
              const lastMatch = sortedFixtures[0]
              lastMatchFinished = finishedStatuses.includes((lastMatch.status ?? 'NS').toUpperCase())
            }

            matchesByChallenge.get(ch.id)!.push({
              id: `${ch.id}-auto-${dayNumber}`,
              day: dayNumber,
              kickoffTime: matchday.earliestDate,
              result: lastMatchFinished ? 'draw' : undefined, // Mark as finished if LAST match is done
            })
          })
        }
      }
    }
  }

  if (swipeKickoffError) {
    console.warn('[challengeService] Failed to fetch swipe kickoff times', swipeKickoffError)
  }

  if (swipeKickoffRows) {
    for (const row of swipeKickoffRows as Array<{
      challenge_id: string
      deadline: string | null
    }>) {
      // Skip if we already have kickoff from betting structure
      if (firstKickoffByChallenge.has(row.challenge_id)) continue

      // Use the deadline directly as the first kickoff time
      // Since results are ordered by deadline ascending, the first row for each challenge has the earliest deadline
      if (row.deadline) {
        firstKickoffByChallenge.set(row.challenge_id, row.deadline)
      }
    }
  }

  // 3. Fallback: For swipe challenges where deadline is NULL, fetch from matchday_fixtures → fb_fixtures
  // This handles cases where matchdays were created without setting the deadline field
  const challengesMissingKickoff = challengeIds.filter(id => !firstKickoffByChallenge.has(id))
  if (challengesMissingKickoff.length > 0) {
    const { data: fixtureKickoffs, error: fixtureError } = await supabase
      .from('matchday_fixtures')
      .select(`
        matchday:challenge_matchdays!inner(challenge_id),
        fixture:fb_fixtures(date)
      `)
      .not('fixture.date', 'is', null)

    if (fixtureError) {
      console.warn('[challengeService] Failed to fetch fixture kickoff fallback', fixtureError)
    }

    if (fixtureKickoffs) {
      // Group by challenge_id and find earliest date
      const kickoffsByChallenge = new Map<string, string[]>()
      for (const row of fixtureKickoffs as Array<{
        matchday: { challenge_id: string } | null
        fixture: { date: string } | null
      }>) {
        const challengeId = row.matchday?.challenge_id
        const fixtureDate = row.fixture?.date
        if (challengeId && fixtureDate && challengesMissingKickoff.includes(challengeId)) {
          if (!kickoffsByChallenge.has(challengeId)) {
            kickoffsByChallenge.set(challengeId, [])
          }
          kickoffsByChallenge.get(challengeId)!.push(fixtureDate)
        }
      }

      // Set the earliest fixture date as first_kickoff_time
      for (const [challengeId, dates] of kickoffsByChallenge.entries()) {
        const earliest = dates.sort()[0]
        if (earliest) {
          firstKickoffByChallenge.set(challengeId, earliest)
        }
      }
    }
  }

  const { data: participantsRows, error: participantsError } = await supabase
    .from('challenge_participants')
    .select('challenge_id, user_id')
    .in('challenge_id', challengeIds)

  if (participantsError) {
    console.error('[challengeService] Failed to fetch challenge participants', participantsError)
    throw participantsError
  }

  const participants = (participantsRows ?? []) as ChallengeParticipantRow[]

  const existingEntriesByChallenge =
    userId
      ? await fetchUserChallengeEntries(userId)
      : new Map<string, UserChallengeEntry>()

  const challengesById = new Map<string, SportimeGame>()
  const catalog: ChallengeCatalogResult = {
    games: [],
    userChallengeEntries: [],
    userSwipeEntries: [],
    userFantasyTeams: [],
    joinedChallengeIds: [],
  }

  for (const row of challenges) {
    // Get matches for this challenge (for betting game categorization)
    const challengeMatches = matchesByChallenge.get(row.id)
    const mapped = mapChallengeRow(row, 0, challengeMatches)
    // Add first_kickoff_time if available from match data
    const kickoff = firstKickoffByChallenge.get(row.id)
    if (kickoff) {
      mapped.first_kickoff_time = kickoff
    }
    // Note: If no kickoff data, we intentionally leave first_kickoff_time undefined
    // This allows GamesListPage to handle games without matches gracefully
    // (they won't be locked until matches are added)
    challengesById.set(row.id, mapped)
  }

  // Recompute participation with populated challenge map
  const finalParticipation = mapParticipantEntries(challengesById, participants, userId, existingEntriesByChallenge)

  // Fetch swipe predictions for this user to populate userSwipeEntries
  // This enables progress indicators on GameCard for prediction games
  let swipeEntriesWithPredictions = finalParticipation.userSwipeEntries
  if (userId && finalParticipation.userSwipeEntries.length > 0) {
    const predictionChallengeIds = finalParticipation.userSwipeEntries.map(e => e.matchDayId)
    const { data: swipePredictions, error: swipePredError } = await supabase
      .from('swipe_predictions')
      .select('challenge_id, fixture_id, prediction')
      .eq('user_id', userId)
      .in('challenge_id', predictionChallengeIds)

    if (swipePredError) {
      console.warn('[challengeService] Failed to fetch swipe predictions', swipePredError)
    } else if (swipePredictions && swipePredictions.length > 0) {
      // Group predictions by challenge_id
      const predictionsByChallenge = new Map<string, Array<{ matchId: string; prediction: string }>>()
      for (const pred of swipePredictions) {
        if (!predictionsByChallenge.has(pred.challenge_id)) {
          predictionsByChallenge.set(pred.challenge_id, [])
        }
        predictionsByChallenge.get(pred.challenge_id)!.push({
          matchId: pred.fixture_id,
          prediction: pred.prediction,
        })
      }

      // Update userSwipeEntries with real predictions
      swipeEntriesWithPredictions = finalParticipation.userSwipeEntries.map(entry => {
        const preds = predictionsByChallenge.get(entry.matchDayId)
        if (preds && preds.length > 0) {
          return {
            ...entry,
            predictions: preds as any, // Cast to SwipePrediction[]
          }
        }
        return entry
      })
    }
  }

  // Fetch current matchday fixture count for each prediction challenge
  // This enables "Ready" badge when all predictions are made
  if (userId && swipeEntriesWithPredictions.length > 0) {
    const predictionChallengeIds = swipeEntriesWithPredictions.map(e => e.matchDayId)

    // Get current matchday (first non-finished) for each challenge with fixture count
    const { data: currentMatchdays, error: matchdaysError } = await supabase
      .from('challenge_matchdays')
      .select(`
        id,
        challenge_id,
        status,
        matchday_fixtures(count)
      `)
      .in('challenge_id', predictionChallengeIds)
      .order('date', { ascending: true })

    if (matchdaysError) {
      console.warn('[challengeService] Failed to fetch current matchday fixture counts', matchdaysError)
    } else if (currentMatchdays && currentMatchdays.length > 0) {
      // Group by challenge_id and find first non-finished matchday
      const fixtureCountByChallenge = new Map<string, number>()

      for (const md of currentMatchdays as Array<{
        id: string
        challenge_id: string
        status: string | null
        matchday_fixtures: Array<{ count: number }> | { count: number } | null
      }>) {
        // Skip if we already found a non-finished matchday for this challenge
        if (fixtureCountByChallenge.has(md.challenge_id)) continue

        // Only use matchdays that are not finished
        const status = (md.status ?? 'upcoming').toLowerCase()
        if (status === 'finished') continue

        // Extract fixture count
        const mf = md.matchday_fixtures
        const count = Array.isArray(mf)
          ? (mf[0]?.count ?? 0)
          : (mf as any)?.count ?? 0

        fixtureCountByChallenge.set(md.challenge_id, count)
      }

      // Update entries with fixture count
      swipeEntriesWithPredictions = swipeEntriesWithPredictions.map(entry => ({
        ...entry,
        currentMatchdayFixtureCount: fixtureCountByChallenge.get(entry.matchDayId) ?? 0,
      }))
    }
  }

  // Fetch matchday and fixture stats for all challenges (for GameInfoModal)
  const FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'AWD', 'WO']
  const matchdayStatsByChallenge = new Map<string, { total: number; finished: number }>()
  const fixtureStatsByChallenge = new Map<string, { total: number; played: number }>()

  // Get all matchday fixtures with their status to calculate:
  // 1. Total matchdays and matchdays where ALL fixtures are finished
  // 2. Total fixtures and fixtures played
  // NOTE: We calculate matchdays_finished from actual fixture status, not matchday.status field
  const { data: allMatchdayFixtures, error: allMatchdayFixturesError } = await supabase
    .from('matchday_fixtures')
    .select(`
      matchday_id,
      matchday:challenge_matchdays!inner(id, challenge_id),
      fixture:fb_fixtures(status_short)
    `)
    .in('matchday.challenge_id', challengeIds)

  if (!allMatchdayFixturesError && allMatchdayFixtures) {
    // Group fixtures by matchday to determine if matchday is fully finished
    const fixturesByMatchday = new Map<string, {
      challengeId: string
      total: number
      finished: number
    }>()

    for (const row of allMatchdayFixtures as Array<{
      matchday_id: string
      matchday: { id: string; challenge_id: string }
      fixture: { status_short: string | null } | null
    }>) {
      const matchdayId = row.matchday_id
      const challengeId = row.matchday?.challenge_id
      if (!matchdayId || !challengeId || !challengeIds.includes(challengeId)) continue

      // Track fixtures per matchday
      const mdStats = fixturesByMatchday.get(matchdayId) ?? { challengeId, total: 0, finished: 0 }
      mdStats.total++
      if (row.fixture?.status_short && FINISHED_STATUSES.includes(row.fixture.status_short)) {
        mdStats.finished++
      }
      fixturesByMatchday.set(matchdayId, mdStats)

      // Track fixtures per challenge
      const current = fixtureStatsByChallenge.get(challengeId) ?? { total: 0, played: 0 }
      current.total++
      if (row.fixture?.status_short && FINISHED_STATUSES.includes(row.fixture.status_short)) {
        current.played++
      }
      fixtureStatsByChallenge.set(challengeId, current)
    }

    // Now calculate matchday stats: a matchday is "finished" if ALL its fixtures are finished
    for (const [matchdayId, mdStats] of fixturesByMatchday) {
      const current = matchdayStatsByChallenge.get(mdStats.challengeId) ?? { total: 0, finished: 0 }
      current.total++
      // Matchday is finished only if ALL fixtures are finished (and has at least 1 fixture)
      if (mdStats.total > 0 && mdStats.finished === mdStats.total) {
        current.finished++
      }
      matchdayStatsByChallenge.set(mdStats.challengeId, current)
    }
  }

  // BETTING CHALLENGES: Fetch stats from challenge_matches → matches (different structure)
  // Betting games don't use challenge_matchdays/matchday_fixtures - they use challenge_matches directly
  const bettingChallengeIds = challenges
    .filter(ch => ch.game_type === 'betting')
    .map(ch => ch.id)

  if (bettingChallengeIds.length > 0 && supabase) {
    const { data: bettingMatchesData, error: bettingMatchesError } = await supabase
      .from('challenge_matches')
      .select(`
        challenge_id,
        match:matches(status)
      `)
      .in('challenge_id', bettingChallengeIds)

    if (!bettingMatchesError && bettingMatchesData) {
      // Group matches by challenge
      const matchesByChallengeForStats = new Map<string, { total: number; played: number }>()

      for (const row of bettingMatchesData) {
        const challengeId = row.challenge_id
        if (!challengeId) continue

        const stats = matchesByChallengeForStats.get(challengeId) ?? { total: 0, played: 0 }
        stats.total++

        // Check if match is finished (betting uses 'matches' table with 'status' field)
        // match is returned as an object from the join
        const matchData = row.match as { status: string | null } | null
        const status = matchData?.status?.toUpperCase() ?? ''
        if (FINISHED_STATUSES.includes(status) || status === 'FINISHED' || status === 'PLAYED') {
          stats.played++
        }
        matchesByChallengeForStats.set(challengeId, stats)
      }

      // Update fixture stats for betting challenges
      for (const [challengeId, stats] of matchesByChallengeForStats) {
        fixtureStatsByChallenge.set(challengeId, stats)
      }

      // For betting challenges, calculate matchdays from the matchesByChallenge we built earlier
      // (matchesByChallenge was populated at line ~765 for period_type challenges)
      for (const challengeId of bettingChallengeIds) {
        const matches = matchesByChallenge.get(challengeId) ?? []
        if (matches.length > 0) {
          const finishedMatchdays = matches.filter(m => m.result !== undefined).length
          matchdayStatsByChallenge.set(challengeId, {
            total: matches.length,
            finished: finishedMatchdays,
          })
        }
      }
    }
  }

  // Update challenges with stats
  for (const game of challengesById.values()) {
    const matchdayStats = matchdayStatsByChallenge.get(game.id)
    const fixtureStats = fixtureStatsByChallenge.get(game.id)
    if (matchdayStats) {
      game.total_matchdays = matchdayStats.total
      game.matchdays_finished = matchdayStats.finished
    }
    if (fixtureStats) {
      game.total_fixtures = fixtureStats.total
      game.fixtures_played = fixtureStats.played
    }
  }

  catalog.games = Array.from(challengesById.values())
  catalog.userChallengeEntries = finalParticipation.userChallengeEntries
  catalog.userSwipeEntries = swipeEntriesWithPredictions
  catalog.userFantasyTeams = finalParticipation.userFantasyTeams
  catalog.joinedChallengeIds = Array.from(finalParticipation.joinedIds)

  for (const [challengeId, entry] of existingEntriesByChallenge) {
    const alreadyIncluded = catalog.userChallengeEntries.some(e => e.challengeId === challengeId)
    if (!alreadyIncluded) {
      catalog.userChallengeEntries.push(entry)
    }
  }

  // Update totals with final counts
  catalog.games = catalog.games.map(game => ({
    ...game,
    totalPlayers: finalParticipation.counts.get(game.id) ?? 0,
  }))

  return catalog
}

export async function joinChallenge(challengeId: string, userId: string, method: 'coins' | 'ticket') {
  const { data, error } = await supabase.rpc('join_betting_challenge', {
    p_challenge_id: challengeId,
    p_user_id: userId,
    p_method: method,
    p_ticket_id: null,
  })

  if (error) {
    if (error.message === 'INSUFFICIENT_COINS') {
      return { alreadyJoined: false, insufficientCoins: true, coinsBalance: null }
    }
    if (error.code === 'PGRST116') {
      return { alreadyJoined: true }
    }
    console.error('[challengeService] Failed to join challenge', error)
    throw error
  }

  const payload = Array.isArray(data) && data.length > 0 ? data[0] : { already_joined: false, coins_balance: null }

  return {
    alreadyJoined: !!payload.already_joined,
    insufficientCoins: false,
    coinsBalance: payload.coins_balance ?? null,
  }
}

function mapEntryRowToUserChallengeEntry(row: ChallengeEntryRow, userId: string): UserChallengeEntry {
  const dailyEntries: DailyChallengeEntry[] = (row.daily_entries ?? [])
    .map(entry => {
      const bets: ChallengeBet[] = (entry.bets ?? []).map(bet => ({
        challengeMatchId: bet.challenge_match_id,
        prediction: bet.prediction,
        amount: bet.amount ?? 0,
        oddsSnapshot: bet.odds_snapshot ?? null,
        status: bet.status ?? undefined,
        pointsEarned: bet.points_earned ?? undefined,
      }))

      const booster =
        entry.booster_type && entry.booster_match_id
          ? {
              type: entry.booster_type,
              matchId: entry.booster_match_id,
            }
          : undefined

      return {
        day: entry.day_number,
        bets,
        booster,
      }
    })
    .sort((a, b) => a.day - b.day)

  return {
    user_id: userId,
    challengeId: row.challenge_id,
    dailyEntries,
    entryMethod: row.entry_method,
    ticketId: row.ticket_id ?? undefined,
  }
}

async function fetchUserChallengeEntries(userId: string) {
  const entriesByChallenge = new Map<string, UserChallengeEntry>()

  const { data, error } = await supabase
    .from('challenge_entries')
    .select(`
      id,
      challenge_id,
      entry_method,
      ticket_id,
      daily_entries:challenge_daily_entries(
        day_number,
        booster_type,
        booster_match_id,
        bets:challenge_bets(
          challenge_match_id,
          prediction,
          amount,
          odds_snapshot,
          status,
          points_earned
        )
      )
    `)
    .eq('user_id', userId)

  if (error) {
    console.error('[challengeService] Failed to fetch challenge entries', error)
    throw error
  }

  for (const row of (data as ChallengeEntryRow[]) ?? []) {
    const entry = mapEntryRowToUserChallengeEntry(row, userId)
    entriesByChallenge.set(entry.challengeId, entry)
  }

  // Attach authoritative server points (challenge_participants.points)
  const { data: parts } = await supabase
    .from('challenge_participants')
    .select('challenge_id, points')
    .eq('user_id', userId)
  for (const p of (parts as Array<{ challenge_id: string; points: number | null }>) ?? []) {
    const e = entriesByChallenge.get(p.challenge_id)
    if (e) e.serverPoints = p.points ?? 0
  }

  return entriesByChallenge
}

export interface ChallengeLeaderboardRow {
  userId: string
  username: string
  points: number
  rank: number
}

/**
 * Authoritative leaderboard for a challenge: ranked participants (server points/rank)
 * joined with their display name. No client-side recompute.
 */
export async function fetchChallengeLeaderboard(challengeId: string): Promise<ChallengeLeaderboardRow[]> {
  if (!supabase) return []
  const { data: parts, error } = await supabase
    .from('challenge_participants')
    .select('user_id, points, rank')
    .eq('challenge_id', challengeId)
    .order('points', { ascending: false })

  if (error || !parts?.length) return []

  const ids = (parts as Array<{ user_id: string }>).map(p => p.user_id)
  const { data: profs } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .in('id', ids)

  const nameById = new Map<string, string>(
    ((profs as Array<{ id: string; username: string | null; display_name: string | null }>) ?? [])
      .map(p => [p.id, p.username || p.display_name || 'Player'] as [string, string])
  )

  return (parts as Array<{ user_id: string; points: number | null; rank: number | null }>).map((p, i) => ({
    userId: p.user_id,
    username: nameById.get(p.user_id) ?? 'Player',
    points: p.points ?? 0,
    rank: p.rank ?? i + 1,
  }))
}

type RawMatchday = {
  id: string
  date: string | null
  status: string | null
  matchday_fixtures: Array<{
    fixture: {
      id: string
      api_id: number | null
      date: string | null
      status: string | null
      round: string | null
      goals_home: number | null
      goals_away: number | null
      odds: Array<{
        home_win: number | null
        draw: number | null
        away_win: number | null
        bookmaker_name: string | null
      }> | {
        home_win: number | null
        draw: number | null
        away_win: number | null
        bookmaker_name: string | null
      } | null
      home: {
        id: string
        name: string | null
        logo_url: string | null
      } | null
      away: {
        id: string
        name: string | null
        logo_url: string | null
      } | null
    } | null
  }> | null
}

type ChallengeMatchRow = {
  id: string
  day_number: number | null
  match: {
    id: string
    fixture_id: string | null
    kickoff_time: string | null
    status: string | null
    score: Record<string, any> | null
    home: {
      id: string
      name: string | null
      logo_url: string | null
    } | null
    away: {
      id: string
      name: string | null
      logo_url: string | null
    } | null
  } | null
}

function normalizeChallengeStatus(status: string | null | undefined): Challenge['status'] {
  if (!status) return 'Upcoming'
  const normalized = status.toLowerCase()
  if (normalized === 'active' || normalized === 'ongoing') return 'Ongoing'
  if (normalized === 'finished' || normalized === 'completed') return 'Finished'
  return 'Upcoming'
}

function normalizeFixtureStatus(status: string | null | undefined, kickoffISO: string | null | undefined) {
  const upper = (status ?? 'NS').toUpperCase()
  const liveStatuses = ['1H', 'HT', '2H', 'ET', 'P', 'BT', 'SUSP', 'INT', 'LIVE']
  const finishedStatuses = ['FT', 'AET', 'PEN', 'AWARDED', 'W.O', 'CANC', 'ABD', 'POST']
  if (finishedStatuses.includes(upper)) return 'played'
  if (liveStatuses.includes(upper)) return 'upcoming'
  const kickoff = kickoffISO ? Date.parse(kickoffISO) : Number.POSITIVE_INFINITY
  if (!Number.isFinite(kickoff)) return 'upcoming'
  return kickoff <= Date.now() && upper !== 'NS' ? 'played' : 'upcoming'
}

/**
 * Extract the matchday number from a round string.
 * Examples:
 *   "Regular Season - 15" → 15
 *   "Matchday 3" → 3
 *   "Round 7" → 7
 * Falls back to 1 if no number is found.
 */
function extractMatchdayNumber(round: string): number {
  const match = round.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 1;
}

function preferOdds(raw: RawMatchday['matchday_fixtures'][number]['fixture']['odds']): { teamA: number; draw: number; teamB: number } {
  const defaultOdds = { teamA: 1, draw: 1, teamB: 1 }
  if (!raw) return defaultOdds
  const oddsArray = Array.isArray(raw) ? raw : [raw]
  if (oddsArray.length === 0) return defaultOdds
  const sorted = oddsArray
    .map(o => ({
      ...o,
      bookmaker_name: o?.bookmaker_name ?? '',
    }))
    .sort((a, b) => {
      const idxA = BOOKMAKER_PRIORITY.indexOf((a.bookmaker_name ?? '').trim())
      const idxB = BOOKMAKER_PRIORITY.indexOf((b.bookmaker_name ?? '').trim())
      const safeA = idxA === -1 ? BOOKMAKER_PRIORITY.length : idxA
      const safeB = idxB === -1 ? BOOKMAKER_PRIORITY.length : idxB
      return safeA - safeB
    })
  const top = sorted[0]
  const teamA = top?.home_win ?? defaultOdds.teamA
  const draw = top?.draw ?? defaultOdds.draw
  const teamB = top?.away_win ?? defaultOdds.teamB
  return {
    teamA: Number.isFinite(teamA) && teamA > 0 ? teamA : defaultOdds.teamA,
    draw: Number.isFinite(draw) && draw > 0 ? draw : defaultOdds.draw,
    teamB: Number.isFinite(teamB) && teamB > 0 ? teamB : defaultOdds.teamB,
  }
}

function nameInitialEmoji(name?: string | null) {
  if (!name) return '⚽️'
  const trimmed = name.trim()
  if (!trimmed) return '⚽️'
  const first = trimmed[0]
  return /[A-Za-z0-9]/.test(first) ? first.toUpperCase() : first
}

function mapChallengeRowToChallenge(row: ChallengeRow, totalPlayers: number): Challenge {
  const rules = row.rules ?? {}
  const balance = rules?.challengeBalance ?? rules?.challenge_balance ?? 1000
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    entryCost: row.entry_cost ?? 0,
    challengeBalance: typeof balance === 'number' ? balance : 1000,
    status: normalizeChallengeStatus(row.status),
    totalPlayers,
  }
}

function buildChallengeMatches(challengeId: string, matchdays: RawMatchday[] | null | undefined): ChallengeMatch[] {
  if (!matchdays || matchdays.length === 0) return []
  const sorted = [...matchdays].sort((a, b) => {
    const aDate = a?.date ? Date.parse(a.date) : Number.POSITIVE_INFINITY
    const bDate = b?.date ? Date.parse(b.date) : Number.POSITIVE_INFINITY
    return aDate - bDate
  })

  const matches: ChallengeMatch[] = []

  sorted.forEach((matchday, index) => {
    const fixtures = matchday.matchday_fixtures ?? []
    // Always use sequential index (1, 2, 3, ...) for consistency
    // The round number from the league (e.g., "Round 16") should NOT be used as day_number
    // because the UI groups matchdays by sequential index, not by league round number
    const day = index + 1

    // Extract display day from the first fixture's round (e.g., "Regular Season - 16" → 16)
    const firstFixtureRound = fixtures[0]?.fixture?.round
    const displayDay = firstFixtureRound ? extractMatchdayNumber(firstFixtureRound) : day

    fixtures.forEach(entry => {
      const fixture = entry?.fixture
      if (!fixture) return
      const odds = preferOdds(fixture.odds)
      const status = normalizeFixtureStatus(fixture.status, fixture.date)
      const result =
        status === 'played' && Number.isInteger(fixture.goals_home) && Number.isInteger(fixture.goals_away)
          ? fixture.goals_home === fixture.goals_away
            ? 'draw'
            : fixture.goals_home! > fixture.goals_away!
              ? 'teamA'
              : 'teamB'
          : undefined

      matches.push({
        id: fixture.id,
        challengeId,
        day,
        displayDay,
        teamA: {
          name: fixture.home?.name ?? 'Home',
          emoji: nameInitialEmoji(fixture.home?.name),
          logo: fixture.home?.logo_url ?? undefined,
        },
        teamB: {
          name: fixture.away?.name ?? 'Away',
          emoji: nameInitialEmoji(fixture.away?.name),
          logo: fixture.away?.logo_url ?? undefined,
        },
        odds,
        status,
        result,
        score: status === 'played' && fixture.goals_home !== null && fixture.goals_away !== null
          ? { teamA: fixture.goals_home!, teamB: fixture.goals_away! }
          : undefined,
        kickoffTime: fixture.date ?? undefined,
      })
    })
  })

  return matches
}

async function buildMatchesFromChallengeMatches(challengeId: string, rows: ChallengeMatchRow[] | null | undefined): Promise<ChallengeMatch[]> {
  if (!rows || rows.length === 0) return []

  // Extract fixture IDs to fetch odds
  const fixtureIds = rows
    .filter(row => row.match?.fixture_id)
    .map(row => row.match!.fixture_id!)

  // Fetch all odds for these fixtures
  const oddsMap = await fetchMultipleFixtureOdds(fixtureIds)

  return rows
    .filter(row => row.match)
    .map(row => {
      const match = row.match!
      const score = match.score ?? {}
      const homeGoals = typeof score.home === 'number'
        ? score.home
        : typeof score.goals_home === 'number'
          ? score.goals_home
          : null
      const awayGoals = typeof score.away === 'number'
        ? score.away
        : typeof score.goals_away === 'number'
          ? score.goals_away
          : null

      const status = normalizeFixtureStatus(match.status, match.kickoff_time)
      const result =
        status === 'played' && homeGoals !== null && awayGoals !== null
          ? homeGoals === awayGoals
            ? 'draw'
            : homeGoals > awayGoals
              ? 'teamA'
              : 'teamB'
          : undefined

      // Fetch real odds from oddsMap, fallback to defaults
      const fixtureId = match.fixture_id
      const odds = fixtureId && oddsMap.has(fixtureId)
        ? oddsMap.get(fixtureId)!
        : {
            teamA: 2.0,
            draw: 3.2,
            teamB: 2.4,
          }

      return {
        // Use fixture_id to match with challenge_bets.challenge_match_id
        // (bets are stored with fixture_id, not challenge_matches.id)
        id: match.fixture_id ?? row.id,
        challengeId,
        day: row.day_number ?? 1,
        teamA: {
          name: match.home?.name ?? 'Home',
          emoji: nameInitialEmoji(match.home?.name),
        },
        teamB: {
          name: match.away?.name ?? 'Away',
          emoji: nameInitialEmoji(match.away?.name),
        },
        odds,
        status,
        result,
        kickoffTime: match.kickoff_time ?? undefined,
      }
    })
    .sort((a, b) => a.day - b.day)
}

// ==================== ADMIN FUNCTIONS ====================

export type CreateChallengeParams = {
  name: string
  description?: string | null
  game_type?: string
  format?: string
  sport?: string
  start_date?: string
  end_date?: string
  entry_cost?: number
  prizes?: any
  rules?: Record<string, any>
  status?: string
  entry_conditions?: Record<string, any>
  configs?: Array<{ config_type: string; config_data: Record<string, any> }>
  league_ids?: string[]
  match_ids?: string[]
}

export type UpdateChallengeParams = {
  challenge_id: string
  name?: string | null
  description?: string | null
  start_date?: string | null
  end_date?: string | null
  entry_cost?: number | null
  prizes?: any | null
  rules?: Record<string, any> | null
  status?: string | null
  entry_conditions?: Record<string, any> | null
  configs?: Array<{ config_type: string; config_data: Record<string, any> }> | null
  league_ids?: string[] | null
  match_ids?: string[] | null
}

/**
 * Create a new challenge (admin only)
 */
export async function createChallenge(params: CreateChallengeParams) {
  const { data, error } = await supabase
    .rpc('create_challenge', {
      p_name: params.name,
      p_description: params.description ?? null,
      p_game_type: params.game_type ?? 'betting',
      p_format: params.format ?? 'leaderboard',
      p_sport: params.sport ?? 'football',
      p_start_date: params.start_date ?? new Date().toISOString(),
      p_end_date: params.end_date ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      p_entry_cost: params.entry_cost ?? 0,
      p_prizes: params.prizes ?? [],
      p_rules: params.rules ?? {},
      p_status: params.status ?? 'upcoming',
      p_entry_conditions: params.entry_conditions ?? {},
      p_configs: params.configs ?? [],
      p_league_ids: params.league_ids ?? [],
      p_match_ids: params.match_ids ?? [],
    })
    .single()

  if (error) {
    console.error('[challengeService] Failed to create challenge:', error)
    throw error
  }

  return {
    challengeId: data.out_challenge_id,
    success: data.out_success,
    message: data.out_message,
  }
}

/**
 * Update a challenge (admin only)
 */
export async function updateChallenge(params: UpdateChallengeParams) {
  const { data, error } = await supabase
    .rpc('update_challenge', {
      p_challenge_id: params.challenge_id,
      p_name: params.name,
      p_description: params.description,
      p_start_date: params.start_date,
      p_end_date: params.end_date,
      p_entry_cost: params.entry_cost,
      p_prizes: params.prizes,
      p_rules: params.rules,
      p_status: params.status,
      p_entry_conditions: params.entry_conditions,
      p_configs: params.configs,
      p_league_ids: params.league_ids,
      p_match_ids: params.match_ids,
    })
    .single()

  if (error) {
    console.error('[challengeService] Failed to update challenge:', error)
    throw error
  }

  return {
    success: data.out_success,
    message: data.out_message,
  }
}

/**
 * Delete a challenge (admin only)
 */
export async function deleteChallenge(challengeId: string) {
  const { data, error } = await supabase
    .rpc('delete_challenge', {
      p_challenge_id: challengeId,
    })
    .single()

  if (error) {
    console.error('[challengeService] Failed to delete challenge:', error)
    throw error
  }

  return {
    success: data.out_success,
    message: data.out_message,
  }
}

/**
 * Cancel a challenge and refund participants (admin only)
 */
export async function cancelChallenge(challengeId: string) {
  const { data, error } = await supabase
    .rpc('cancel_challenge', {
      p_challenge_id: challengeId,
    })
    .single()

  if (error) {
    console.error('[challengeService] Failed to cancel challenge:', error)
    throw error
  }

  return {
    success: data.out_success,
    message: data.out_message,
    refundedUsers: data.out_refunded_users,
  }
}

/**
 * Finalize a challenge (admin only)
 */
export async function finalizeChallenge(challengeId: string) {
  const { data, error } = await supabase
    .rpc('finalize_challenge', {
      p_challenge_id: challengeId,
    })
    .single()

  if (error) {
    console.error('[challengeService] Failed to finalize challenge:', error)
    throw error
  }

  return {
    success: data.out_success,
    message: data.out_message,
    totalParticipants: data.out_total_participants,
  }
}

/**
 * Manually recalculate all points and rankings for a challenge (admin only)
 */
export async function recalculateAllChallengePoints(challengeId: string) {
  const { data, error } = await supabase
    .rpc('recalculate_all_challenge_points', {
      p_challenge_id: challengeId,
    })

  if (error) {
    console.error('[challengeService] Failed to recalculate points:', error)
    throw error
  }

  return data || []
}

/**
 * Manually distribute prizes for a challenge (admin only)
 */
export async function distributeChallengePrizes(challengeId: string) {
  const { data, error } = await supabase
    .rpc('distribute_challenge_prizes', {
      p_challenge_id: challengeId,
    })

  if (error) {
    console.error('[challengeService] Failed to distribute prizes:', error)
    throw error
  }

  return data || []
}

// ==================== END ADMIN FUNCTIONS ====================

export async function fetchChallengeMatches(challengeId: string) {
  const { data: challengeRow, error } = await supabase
    .from('challenges')
    .select(`
      id,
      name,
      description,
      game_type,
      format,
      start_date,
      end_date,
      entry_cost,
      prizes,
      rules,
      status,
      entry_conditions,
      challenge_configs (
        config_type,
        config_data
      ),
      challenge_leagues (
        league_id
      ),
      challenge_matchdays (
        id,
        date,
        status,
        matchday_fixtures (
          fixture:fb_fixtures (
            id,
            date,
            status,
            round,
            goals_home,
            goals_away,
            odds:fb_odds (
              home_win,
              draw,
              away_win,
              bookmaker_name
            ),
            home:fb_teams!fb_fixtures_home_team_id_fkey (
              id,
              name,
              logo_url
            ),
            away:fb_teams!fb_fixtures_away_team_id_fkey (
              id,
              name,
              logo_url
            )
          )
        )
      )
    `)
    .eq('id', challengeId)
    .maybeSingle()

  if (error) {
    console.error('[challengeService] Failed to fetch challenge detail', error)
    throw error
  }

  if (!challengeRow) {
    return {
      challenge: null as Challenge | null,
      matches: [] as ChallengeMatch[],
      totalPlayers: 0,
    }
  }

  const { count: participantCount, error: countError } = await supabase
    .from('challenge_participants')
    .select('user_id', { count: 'exact', head: true })
    .eq('challenge_id', challengeId)

  if (countError) {
    console.error('[challengeService] Failed to count participants', countError)
    throw countError
  }

  console.log('[fetchChallengeMatches] challengeRow.challenge_matchdays:', challengeRow.challenge_matchdays)
  let matches = buildChallengeMatches(challengeId, challengeRow.challenge_matchdays as RawMatchday[])
  console.log('[fetchChallengeMatches] Built matches from matchdays:', matches.length)

  // Filter matches by end_date using date-only string comparison to avoid timezone issues
  // new Date("2025-12-06") creates UTC midnight, but setHours() uses local time
  // This caused dates to shift by timezone offset
  if (challengeRow.end_date && matches.length > 0) {
    const endDateStr = challengeRow.end_date.split('T')[0]  // "2025-12-06"
    const beforeFilter = matches.length
    matches = matches.filter(m => {
      if (!m.kickoffTime) return true
      const matchDateStr = m.kickoffTime.split('T')[0]      // "2025-12-06"
      return matchDateStr <= endDateStr
    })
    if (matches.length < beforeFilter) {
      console.log(`[fetchChallengeMatches] Filtered out ${beforeFilter - matches.length} matches after end_date (${challengeRow.end_date})`)
    }
  }

  if (matches.length === 0) {
    console.log('[fetchChallengeMatches] No matches from matchdays, trying challenge_matches fallback...')
    const { data: directRows, error: directError } = await supabase
      .from('challenge_matches')
      .select(`
        id,
        day_number,
        match:matches (
          id,
          fixture_id,
          kickoff_time,
          status,
          score,
          home:teams!matches_home_team_id_fkey (
            id,
            name,
            logo_url
          ),
          away:teams!matches_away_team_id_fkey (
            id,
            name,
            logo_url
          )
        )
      `)
      .eq('challenge_id', challengeId)
      .order('day_number', { ascending: true })

    if (directError) {
      console.error('[challengeService] Failed to fetch challenge_matches fallback', directError)
    } else {
      matches = await buildMatchesFromChallengeMatches(challengeId, directRows as ChallengeMatchRow[])
    }
  }

  // 3rd fallback: Auto-generate matches from fb_fixtures for betting games
  if (matches.length === 0 && challengeRow.game_type?.toLowerCase() === 'betting') {
    console.log('[fetchChallengeMatches] No matches found, auto-generating from fb_fixtures...')
    const leagueId = (challengeRow.challenge_leagues as Array<{ league_id: string }> | null)?.[0]?.league_id

    if (leagueId) {
      const rules = challengeRow.rules as Record<string, any> | null ?? {}
      const periodType = (rules?.period_type as 'matchdays' | 'calendar') ?? 'matchdays'

      const { data: fixturesData, error: fixturesError } = await supabase
        .from('fb_fixtures')
        .select(`
          id,
          date,
          status,
          goals_home,
          goals_away,
          round,
          odds:fb_odds (
            home_win,
            draw,
            away_win,
            bookmaker_name
          ),
          home:fb_teams!fb_fixtures_home_team_id_fkey (
            id,
            name,
            logo_url
          ),
          away:fb_teams!fb_fixtures_away_team_id_fkey (
            id,
            name,
            logo_url
          )
        `)
        .eq('league_id', leagueId)
        .gte('date', challengeRow.start_date)
        .lte('date', challengeRow.end_date)
        .order('date', { ascending: true })

      if (fixturesError) {
        console.error('[fetchChallengeMatches] Failed to fetch fb_fixtures', fixturesError)
      } else if (fixturesData && fixturesData.length > 0) {
        console.log('[fetchChallengeMatches] Found', fixturesData.length, 'fixtures from fb_fixtures')

        // Group fixtures by matchday based on period_type
        const matchdayMap = new Map<string, Array<typeof fixturesData[0]>>()

        for (const fixture of fixturesData) {
          let groupKey: string

          if (periodType === 'matchdays') {
            // Group by round (e.g., "Regular Season - 15")
            groupKey = fixture.round ?? 'unknown'
          } else {
            // Calendar: group by date (YYYY-MM-DD)
            groupKey = fixture.date.split('T')[0]
          }

          if (!matchdayMap.has(groupKey)) {
            matchdayMap.set(groupKey, [])
          }
          matchdayMap.get(groupKey)!.push(fixture)
        }

        // Sort matchdays by earliest fixture date
        const sortedMatchdays = Array.from(matchdayMap.entries())
          .map(([key, fixtures]) => ({
            key,
            fixtures,
            earliestDate: fixtures.reduce((min, f) => f.date < min ? f.date : min, fixtures[0].date)
          }))
          .sort((a, b) => a.earliestDate.localeCompare(b.earliestDate))

        // Build ChallengeMatch array
        sortedMatchdays.forEach((matchday) => {
          const day = extractMatchdayNumber(matchday.key)

          for (const fixture of matchday.fixtures) {
            const status = normalizeFixtureStatus(fixture.status, fixture.date)
            const result =
              status === 'played' && fixture.goals_home !== null && fixture.goals_away !== null
                ? fixture.goals_home === fixture.goals_away
                  ? 'draw'
                  : fixture.goals_home! > fixture.goals_away!
                    ? 'teamA'
                    : 'teamB'
                : undefined

            matches.push({
              id: fixture.id,
              challengeId,
              day,
              teamA: {
                name: fixture.home?.name ?? 'Home',
                emoji: nameInitialEmoji(fixture.home?.name),
                logo: fixture.home?.logo_url ?? undefined,
              },
              teamB: {
                name: fixture.away?.name ?? 'Away',
                emoji: nameInitialEmoji(fixture.away?.name),
                logo: fixture.away?.logo_url ?? undefined,
              },
              odds: preferOdds(fixture.odds as RawMatchday['matchday_fixtures'][number]['fixture']['odds']),
              status,
              result,
              score: status === 'played' && fixture.goals_home !== null && fixture.goals_away !== null
                ? { teamA: fixture.goals_home!, teamB: fixture.goals_away! }
                : undefined,
              kickoffTime: fixture.date,
            })
          }
        })

        console.log('[fetchChallengeMatches] Auto-generated', matches.length, 'matches from fb_fixtures')
      }
    }
  }

  const challenge = mapChallengeRowToChallenge(challengeRow as ChallengeRow, participantCount ?? 0)

  // Detect matches with missing/default odds and trigger sync if needed
  // Default odds are { teamA: 1, draw: 1, teamB: 1 } from preferOdds()
  const matchesWithDefaultOdds = matches.filter(m =>
    m.odds.teamA === 1 && m.odds.draw === 1 && m.odds.teamB === 1
  )

  if (matchesWithDefaultOdds.length > 0) {
    console.log(`[fetchChallengeMatches] ${matchesWithDefaultOdds.length} matches have default odds, triggering sync...`)

    // Get league_id from challenge_leagues
    const leagueId = (challengeRow.challenge_leagues as Array<{ league_id: string }> | null)?.[0]?.league_id

    if (leagueId) {
      // Build fixtures for odds check (fire and forget)
      const fixturesForSync: FixtureForOddsCheck[] = matchesWithDefaultOdds.map(m => ({
        id: m.id,
        league_id: leagueId,
        odds: [], // Empty = no odds
      }))

      detectAndSyncMissingOdds(fixturesForSync).catch(err => {
        console.error('[fetchChallengeMatches] Error triggering odds sync:', err)
      })
    }
  }

  return {
    challenge,
    matches,
    totalPlayers: participantCount ?? 0,
  }
}

// ==================== MATCH MANAGEMENT ====================

/**
 * Add fixtures to a challenge with day assignments
 * @param challengeId - The challenge ID
 * @param matches - Array of { fixture_id, day_number }
 */
export async function addMatchesToChallenge(
  challengeId: string,
  matches: Array<{ fixture_id: string; day_number: number }>
) {
  // First, get the associated match_id for each fixture
  const fixtureIds = matches.map(m => m.fixture_id)
  const { data: matchesData, error: matchesError } = await supabase
    .from('matches')
    .select('id, fixture_id')
    .in('fixture_id', fixtureIds)

  if (matchesError) {
    console.error('[addMatchesToChallenge] Failed to fetch matches', matchesError)
    throw matchesError
  }

  // Create a mapping: fixture_id -> match_id
  const fixtureToMatchMap = new Map(
    matchesData?.map(m => [m.fixture_id, m.id]) ?? []
  )

  // Build challenge_matches rows
  const challengeMatches = matches
    .map(m => {
      const matchId = fixtureToMatchMap.get(m.fixture_id)
      if (!matchId) {
        console.warn(`[addMatchesToChallenge] No match found for fixture ${m.fixture_id}`)
        return null
      }
      return {
        challenge_id: challengeId,
        match_id: matchId,
        day_number: m.day_number,
      }
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)

  // Insert into challenge_matches
  const { error: insertError } = await supabase
    .from('challenge_matches')
    .insert(challengeMatches)

  if (insertError) {
    console.error('[addMatchesToChallenge] Failed to insert challenge_matches', insertError)
    throw insertError
  }

  return { success: true, count: challengeMatches.length }
}

/**
 * Fetch odds for a specific fixture
 * @param fixtureId - The fixture UUID
 * @returns Odds object { teamA, draw, teamB } or null
 */
export async function fetchFixtureOdds(fixtureId: string): Promise<{
  teamA: number
  draw: number
  teamB: number
} | null> {
  // Fetch latest odds from odds table for this fixture
  const { data, error } = await supabase
    .from('odds')
    .select('home_win, draw, away_win, bookmaker_name, updated_at')
    .eq('fixture_id', fixtureId)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('[fetchFixtureOdds] Failed to fetch odds', error)
    return null
  }

  if (!data || data.length === 0) {
    console.warn(`[fetchFixtureOdds] No odds found for fixture ${fixtureId}`)
    return null
  }

  // Find odds from priority bookmaker, or use latest odds
  let selectedOdds = data.find(o => BOOKMAKER_PRIORITY.includes(o.bookmaker_name))
  if (!selectedOdds) {
    selectedOdds = data[0] // Use latest odds
  }

  return {
    teamA: selectedOdds.home_win ?? 2.0,
    draw: selectedOdds.draw ?? 3.2,
    teamB: selectedOdds.away_win ?? 2.4,
  }
}

/**
 * Fetch odds for multiple fixtures at once
 * @param fixtureIds - Array of fixture UUIDs
 * @returns Map of fixtureId -> odds
 */
export async function fetchMultipleFixtureOdds(
  fixtureIds: string[]
): Promise<Map<string, { teamA: number; draw: number; teamB: number }>> {
  const oddsMap = new Map<string, { teamA: number; draw: number; teamB: number }>()

  if (fixtureIds.length === 0) return oddsMap

  // Fetch all odds for these fixtures
  const { data, error } = await supabase
    .from('odds')
    .select('fixture_id, home_win, draw, away_win, bookmaker_name, updated_at')
    .in('fixture_id', fixtureIds)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('[fetchMultipleFixtureOdds] Failed to fetch odds', error)
    return oddsMap
  }

  if (!data || data.length === 0) {
    console.warn('[fetchMultipleFixtureOdds] No odds found for any fixtures')
    return oddsMap
  }

  // Group odds by fixture_id
  const oddsByFixture = new Map<string, typeof data>()
  for (const odd of data) {
    if (!oddsByFixture.has(odd.fixture_id)) {
      oddsByFixture.set(odd.fixture_id, [])
    }
    oddsByFixture.get(odd.fixture_id)!.push(odd)
  }

  // For each fixture, select best odds
  for (const [fixtureId, fixtureOdds] of oddsByFixture.entries()) {
    let selectedOdds = fixtureOdds.find(o => BOOKMAKER_PRIORITY.includes(o.bookmaker_name))
    if (!selectedOdds) {
      selectedOdds = fixtureOdds[0] // Use latest odds
    }

    oddsMap.set(fixtureId, {
      teamA: selectedOdds.home_win ?? 2.0,
      draw: selectedOdds.draw ?? 3.2,
      teamB: selectedOdds.away_win ?? 2.4,
    })
  }

  return oddsMap
}
