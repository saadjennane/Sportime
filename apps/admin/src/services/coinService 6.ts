import { supabase } from './supabase'

export type TransactionType =
  | 'shop_purchase'
  | 'daily_streak'
  | 'spin_wheel'
  | 'challenge_entry'
  | 'challenge_refund'
  | 'challenge_reward'
  | 'premium_bonus'
  | 'referral_reward'
  | 'admin_adjustment'
  | 'initial_bonus'

export type CoinTransaction = {
  id: string
  user_id: string
  amount: number
  balance_after: number
  transaction_type: TransactionType
  metadata: Record<string, any>
  created_at: string
}

export type AddCoinsResult = {
  success: boolean
  new_balance: number
  transaction_id: string
}

export type DeductCoinsResult = {
  success: boolean
  new_balance: number
  transaction_id: string
  insufficient?: boolean
}

/**
 * Add coins to user's balance with transaction logging
 */
export async function addCoins(
  userId: string,
  amount: number,
  transactionType: TransactionType,
  metadata: Record<string, any> = {}
): Promise<AddCoinsResult> {
  const { data, error } = await supabase
    .rpc('add_coins', {
      p_user_id: userId,
      p_amount: amount,
      p_transaction_type: transactionType,
      p_metadata: metadata,
    })
    .single()

  if (error) {
    console.error('[coinService] Failed to add coins:', error)
    throw error
  }

  return {
    success: data.success,
    new_balance: data.new_balance,
    transaction_id: data.transaction_id,
  }
}

/**
 * Deduct coins from user's balance with transaction logging
 */
export async function deductCoins(
  userId: string,
  amount: number,
  transactionType: TransactionType,
  metadata: Record<string, any> = {}
): Promise<DeductCoinsResult> {
  const { data, error } = await supabase
    .rpc('deduct_coins', {
      p_user_id: userId,
      p_amount: amount,
      p_transaction_type: transactionType,
      p_metadata: metadata,
    })
    .single()

  if (error) {
    if (error.message?.includes('INSUFFICIENT_COINS')) {
      return {
        success: false,
        new_balance: 0,
        transaction_id: '',
        insufficient: true,
      }
    }
    console.error('[coinService] Failed to deduct coins:', error)
    throw error
  }

  return {
    success: data.success,
    new_balance: data.new_balance,
    transaction_id: data.transaction_id,
  }
}

/**
 * Get current coin balance
 */
export async function getCoinBalance(userId: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_coin_balance', { p_user_id: userId })

  if (error) {
    console.error('[coinService] Failed to get balance:', error)
    throw error
  }

  return data ?? 0
}

/**
 * Get transaction history for a user
 */
export async function getTransactionHistory(
  userId: string,
  limit: number = 50
): Promise<CoinTransaction[]> {
  const { data, error } = await supabase
    .from('coin_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[coinService] Failed to fetch transactions:', error)
    throw error
  }

  return data as CoinTransaction[]
}

/**
 * Purchase coin pack from shop (no payment, just adds coins)
 */
export async function purchaseCoinPack(
  userId: string,
  packId: string,
  coins: number
): Promise<AddCoinsResult> {
  return addCoins(userId, coins, 'shop_purchase', { pack_id: packId })
}

/**
 * Grant premium subscription bonus (5000 coins)
 */
export async function grantPremiumBonus(userId: string): Promise<AddCoinsResult> {
  return addCoins(userId, 5000, 'premium_bonus', { reason: 'first_subscription' })
}

/**
 * Grant referral reward (1000 coins)
 */
export async function grantReferralReward(
  userId: string,
  referredUserId: string
): Promise<AddCoinsResult> {
  return addCoins(userId, 1000, 'referral_reward', { referred_user_id: referredUserId })
}

/**
 * Refund challenge entry
 */
export async function refundChallengeEntry(
  challengeId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('refund_challenge_entry', {
    p_challenge_id: challengeId,
    p_user_id: userId,
  })

  if (error) {
    console.error('[coinService] Failed to refund challenge entry:', error)
    throw error
  }

  return data ?? false
}
