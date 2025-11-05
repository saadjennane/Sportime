import { supabase } from './supabase'
import type { ChallengeBet, DailyChallengeEntry } from '../types'

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
    const inserts = bets.map(bet => ({
      daily_entry_id: dailyEntryId,
      challenge_match_id: bet.challengeMatchId,
      prediction: bet.prediction,
      amount: bet.amount,
    }))

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
