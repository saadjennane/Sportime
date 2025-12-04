import { supabase } from './supabase'

export async function addXpToUser(userId: string, amount: number) {
  if (!supabase) {
    throw new Error('Supabase client not initialized')
  }

  const { data, error } = await supabase.rpc('add_xp_to_user', {
    p_user_id: userId,
    p_xp_amount: amount,
  })

  if (error) {
    console.error('[progressionService] Failed to add XP', error)
    throw error
  }

  return data
}
