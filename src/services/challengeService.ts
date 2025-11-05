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
  participantCount: number
): SportimeGame {
  const rules = row.rules ?? {}
  const entryConditions = row.entry_conditions ?? {}
  const configs = row.challenge_configs ?? []

  const tier =
    extractConfigValue<TournamentType>(configs, 'tier') ??
    (rules?.tier as TournamentType | undefined)
  const durationType =
    extractConfigValue<'daily' | 'mini-series' | 'seasonal'>(configs, 'duration_type') ??
    (rules?.duration_type as 'daily' | 'mini-series' | 'seasonal' | undefined)
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

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    league_id: row.challenge_leagues?.[0]?.league_id ?? undefined,
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
    matches: undefined,
    gameWeeks: undefined,
    challengeId: row.id,
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
        league_id
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
    const mapped = mapChallengeRow(row, 0)
    challengesById.set(row.id, mapped)
  }

  // Recompute participation with populated challenge map
  const finalParticipation = mapParticipantEntries(challengesById, participants, userId, existingEntriesByChallenge)

  catalog.games = Array.from(challengesById.values())
  catalog.userChallengeEntries = finalParticipation.userChallengeEntries
  catalog.userSwipeEntries = finalParticipation.userSwipeEntries
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
          amount
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

  return entriesByChallenge
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
        logo: string | null
      } | null
      away: {
        id: string
        name: string | null
        logo: string | null
      } | null
    } | null
  }> | null
}

type ChallengeMatchRow = {
  id: string
  day_number: number | null
  match: {
    id: string
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
    const day = index + 1
    const fixtures = matchday.matchday_fixtures ?? []
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
        teamA: {
          name: fixture.home?.name ?? 'Home',
          emoji: nameInitialEmoji(fixture.home?.name),
        },
        teamB: {
          name: fixture.away?.name ?? 'Away',
          emoji: nameInitialEmoji(fixture.away?.name),
        },
        odds,
        status,
        result,
      })
    })
  })

  return matches
}

function buildMatchesFromChallengeMatches(challengeId: string, rows: ChallengeMatchRow[] | null | undefined): ChallengeMatch[] {
  if (!rows || rows.length === 0) return []

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

      return {
        id: row.id,
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
        odds: {
          teamA: 2.0,
          draw: 3.2,
          teamB: 2.4,
        },
        status,
        result,
      }
    })
    .sort((a, b) => a.day - b.day)
}

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
      challenge_configs,
      challenge_leagues (
        league_id
      ),
      challenge_matchdays (
        id,
        date,
        status,
        matchday_fixtures (
          fixture:fixtures (
            id,
            api_id,
            date,
            status,
            goals_home,
            goals_away,
            odds (
              home_win,
              draw,
              away_win,
              bookmaker_name
            ),
            home:teams!fixtures_home_team_id_fkey (
              id,
              name,
              logo_url
            ),
            away:teams!fixtures_away_team_id_fkey (
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

  let matches = buildChallengeMatches(challengeId, challengeRow.challenge_matchdays as RawMatchday[])

  if (matches.length === 0) {
    const { data: directRows, error: directError } = await supabase
      .from('challenge_matches')
      .select(`
        id,
        day_number,
        match:matches (
          id,
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
      matches = buildMatchesFromChallengeMatches(challengeId, directRows as ChallengeMatchRow[])
    }
  }

  const challenge = mapChallengeRowToChallenge(challengeRow as ChallengeRow, participantCount ?? 0)

  return {
    challenge,
    matches,
    totalPlayers: participantCount ?? 0,
  }
}
