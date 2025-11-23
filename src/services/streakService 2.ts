import { supabase } from './supabase'

export type StreakCheckResult = {
  is_available: boolean
  streak_day: number
  is_first_time: boolean
}

export type StreakClaimResult = {
  success: boolean
  streak_day: number
  reward_type: 'coins' | 'ticket'
  reward_amount: number
  new_balance: number
}

/**
 * Check if user can claim their daily streak
 */
export async function checkDailyStreak(userId: string): Promise<StreakCheckResult> {
  const { data, error } = await supabase
    .rpc('check_daily_streak', { p_user_id: userId })
    .single()

  if (error) {
    console.error('[streakService] Failed to check daily streak:', error)
    throw error
  }

  return data
}

/**
 * Claim daily streak and receive rewards
 */
export async function claimDailyStreak(userId: string): Promise<StreakClaimResult> {
  const { data, error } = await supabase
    .rpc('claim_daily_streak', { p_user_id: userId })
    .single()

  if (error) {
    console.error('[streakService] Failed to claim daily streak:', error)
    throw error
  }

  return data
}

/**
 * Get user's current streak data
 */
export async function getUserStreak(userId: string) {
  const { data, error } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[streakService] Failed to get user streak:', error)
    throw error
  }

  return data
}
