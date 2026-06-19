import { supabase } from './supabase';
import { UserSpinState } from '../types';

/**
 * Get or create user spin state from Supabase.
 * (The spin draw/grant itself is server-authoritative — see SpinwheelModal +
 *  the `spin_wheel` RPC in spinSegmentsService. This only reads the user's state.)
 */
export async function getUserSpinState(userId: string): Promise<UserSpinState> {
  const { data, error } = await supabase
    .rpc('get_user_spin_state', { p_user_id: userId })
    .single();

  if (error) {
    console.error('Error fetching spin state:', error);
    throw new Error(`Failed to fetch spin state: ${error.message}`);
  }

  return {
    userId: data.out_user_id,
    pityCounter: data.out_pity_counter,
    adaptiveMultipliers: data.out_adaptive_multipliers || {},
    availableSpins: data.out_available_spins || {
      free: 0,
      amateur: 0,
      master: 0,
      apex: 0,
      premium: 0,
    },
    lastFreeSpinAt: data.out_last_free_spin_at ? new Date(data.out_last_free_spin_at) : null,
    freeSpinStreak: data.out_free_spin_streak,
    updatedAt: new Date(data.out_updated_at),
  };
}
