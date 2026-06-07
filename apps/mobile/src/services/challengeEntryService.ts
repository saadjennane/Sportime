import { supabase } from './supabase'
import type { ChallengeBet } from '../types'

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

  // All validation (challenge active, fixtures not started, budget) AND the odds
  // snapshot now happen server-side in place_challenge_bets — single source of truth.
  const { data, error } = await supabase.rpc('place_challenge_bets', {
    p_challenge_id: challengeId,
    p_user_id: userId,
    p_day_number: day,
    p_bets: bets.map(b => ({
      challengeMatchId: b.challengeMatchId,
      prediction: b.prediction,
      amount: b.amount,
    })),
    p_booster: booster ? { type: booster.type, matchId: booster.matchId } : null,
    p_entry_method: entryMethod,
    p_ticket_id: ticketId,
  })

  if (error) {
    console.error('[challengeEntryService] place_challenge_bets failed', error)
    throw error
  }

  return data as string // daily_entry_id
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
