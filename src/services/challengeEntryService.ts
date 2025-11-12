import { supabase } from './supabase'
import type { ChallengeBet, DailyChallengeEntry } from '../types'
import { fetchMultipleFixtureOdds } from './challengeService'

export type SaveDailyEntryParams = {
  challengeId: string
  userId: string
  day: number
  bets: ChallengeBet[]
  booster?: { type: 'x2' | 'x3'; matchId: string } | undefined
  entryMethod?: 'coins' | 'ticket'
  ticketId?: string | null
}

export async function ensureChallengeEntry(
  challengeId: string,
  userId: string,
  entryMethod: 'coins' | 'ticket' = 'coins',
  ticketId: string | null = null
) {
  const { data, error } = await supabase
    .from('challenge_entries')
    .upsert(
      {
        challenge_id: challengeId,
        user_id: userId,
        entry_method: entryMethod,
        ticket_id: ticketId,
      },
      { onConflict: 'challenge_id,user_id' }
    )
    .select('id')
    .single()

  if (error) {
    console.error('[challengeEntryService] Failed to ensure challenge entry', error)
    throw error
  }

  return data?.id as string
}

export async function saveDailyEntry(params: SaveDailyEntryParams) {
  const {
    challengeId,
    userId,
    day,
    bets,
    booster,
    entryMethod = 'coins',
    ticketId = null,
  } = params

  // ====== VALIDATION 1: Check challenge status ======
  const { data: challengeData, error: challengeError } = await supabase
    .from('challenges')
    .select('status, rules')
    .eq('id', challengeId)
    .single()

  if (challengeError || !challengeData) {
    throw new Error('Challenge not found')
  }

  const challengeStatus = challengeData.status?.toLowerCase()
  if (challengeStatus === 'finished' || challengeStatus === 'cancelled' || challengeStatus === 'completed') {
    throw new Error('Cannot place bets on a finished or cancelled challenge')
  }

  if (challengeStatus === 'active' || challengeStatus === 'ongoing') {
    // Challenge has started - bets are locked
    throw new Error('Challenge has started - bets are locked')
  }

  // ====== VALIDATION 2: Check daily balance ======
  const challengeBalance = challengeData.rules?.challengeBalance ?? 1000
  const totalBetAmount = bets.reduce((sum, bet) => sum + bet.amount, 0)

  if (totalBetAmount > challengeBalance) {
    throw new Error(`Total bet amount (${totalBetAmount}) exceeds daily balance (${challengeBalance})`)
  }

  // Optional: Enforce full balance allocation (as per audit report)
  // Uncomment to require users to allocate entire daily balance
  // if (totalBetAmount < challengeBalance) {
  //   throw new Error(`You must allocate your entire daily balance (${challengeBalance}). Current: ${totalBetAmount}`)
  // }

  const entryId = await ensureChallengeEntry(challengeId, userId, entryMethod, ticketId)

  const { data: dailyRow, error: dailyError } = await supabase
    .from('challenge_daily_entries')
    .upsert(
      {
        challenge_entry_id: entryId,
        day_number: day,
        booster_type: booster?.type ?? null,
        booster_match_id: booster?.matchId ?? null,
      },
      { onConflict: 'challenge_entry_id,day_number' }
    )
    .select('id')
    .single()

  if (dailyError) {
    console.error('[challengeEntryService] Failed to upsert daily entry', dailyError)
    throw dailyError
  }

  const dailyEntryId = dailyRow?.id as string

  const { error: deleteError } = await supabase
    .from('challenge_bets')
    .delete()
    .eq('daily_entry_id', dailyEntryId)

  if (deleteError) {
    console.error('[challengeEntryService] Failed to reset bets', deleteError)
    throw deleteError
  }

  if (bets.length > 0) {
    // ====== FETCH ODDS SNAPSHOT ======
    // Get all challenge_match_ids to fetch their fixture_ids
    const challengeMatchIds = bets.map(b => b.challengeMatchId)
    const { data: matchesData, error: matchesError } = await supabase
      .from('challenge_matches')
      .select('id, match:matches(fixture_id)')
      .in('id', challengeMatchIds)

    if (matchesError) {
      console.error('[challengeEntryService] Failed to fetch fixture IDs', matchesError)
      throw matchesError
    }

    // Build a map: challenge_match_id -> fixture_id
    const matchToFixtureMap = new Map<string, string>()
    for (const row of matchesData ?? []) {
      const fixtureId = (row.match as any)?.fixture_id
      if (fixtureId) {
        matchToFixtureMap.set(row.id, fixtureId)
      }
    }

    // Fetch odds for all fixtures
    const fixtureIds = Array.from(matchToFixtureMap.values())
    const oddsMap = await fetchMultipleFixtureOdds(fixtureIds)

    // Build inserts with odds_snapshot
    const inserts = bets.map(bet => {
      const fixtureId = matchToFixtureMap.get(bet.challengeMatchId)
      const odds = fixtureId ? oddsMap.get(fixtureId) : null

      return {
        daily_entry_id: dailyEntryId,
        challenge_match_id: bet.challengeMatchId,
        prediction: bet.prediction,
        amount: bet.amount,
        odds_snapshot: odds ? {
          teamA: odds.teamA,
          draw: odds.draw,
          teamB: odds.teamB,
        } : null,
      }
    })

    const { error: insertError } = await supabase
      .from('challenge_bets')
      .insert(inserts)

    if (insertError) {
      console.error('[challengeEntryService] Failed to insert bets', insertError)
      throw insertError
    }
  }

  return dailyEntryId
}

export async function clearDailyEntry(challengeId: string, userId: string, day: number) {
  const { data: entryRow, error: entryError } = await supabase
    .from('challenge_entries')
    .select('id')
    .eq('challenge_id', challengeId)
    .eq('user_id', userId)
    .single()

  if (entryError && entryError.code !== 'PGRST116') {
    console.error('[challengeEntryService] Failed to locate entry for clearing', entryError)
    throw entryError
  }

  if (!entryRow) return

  const { data: dailyRow, error: dailyError } = await supabase
    .from('challenge_daily_entries')
    .select('id')
    .eq('challenge_entry_id', entryRow.id)
    .eq('day_number', day)
    .single()

  if (dailyError && dailyError.code !== 'PGRST116') {
    console.error('[challengeEntryService] Failed to fetch daily entry', dailyError)
    throw dailyError
  }

  if (!dailyRow) return

  const { error: deleteError } = await supabase
    .from('challenge_daily_entries')
    .delete()
    .eq('id', dailyRow.id)

  if (deleteError) {
    console.error('[challengeEntryService] Failed to delete daily entry', deleteError)
    throw deleteError
  }
}
