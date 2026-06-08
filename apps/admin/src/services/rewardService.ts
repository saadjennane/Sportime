import { supabase } from './supabase';

export type RewardItem = { type: string; quantity: number; value?: number; tier?: string; name?: string; logo?: string };
export type RewardTier = { id: string; positionType: 'rank' | 'range' | 'percent' | 'participation'; start: number; end: number; rewards: RewardItem[] };

export async function listRewardPacks() {
  const { data } = await supabase.from('reward_packs').select('*').order('created_at', { ascending: false });
  return data ?? [];
}
export async function createRewardPack(name: string, tiers: RewardTier[]) {
  return supabase.from('reward_packs').insert({ name, tiers }).select().single();
}
export async function updateRewardPack(id: string, patch: { name?: string; tiers?: RewardTier[] }) {
  return supabase.from('reward_packs').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
}
export async function deleteRewardPack(id: string) {
  return supabase.from('reward_packs').delete().eq('id', id);
}

/** Distribute a game's assigned reward pack to its winners (idempotent server-side). */
export async function distributeRewards(gameType: 'tq' | 'betting' | 'prediction' | 'fantasy', gameId: string) {
  return supabase.rpc('gb_distribute_rewards', { p_type: gameType, p_id: gameId });
}

/** Assign a pack to a game: copies the resolved tiers into the game's rewards field + links the pack. */
export async function assignPackToGame(gameType: 'tq' | 'betting' | 'prediction' | 'fantasy', gameId: string, packId: string | null, tiers: RewardTier[]) {
  if (gameType === 'tq') {
    return supabase.from('tq_competitions').update({ reward_pack_id: packId, rewards_json: tiers }).eq('id', gameId);
  }
  if (gameType === 'fantasy') {
    return supabase.from('fantasy_games').update({ reward_pack_id: packId, prizes: tiers }).eq('id', gameId);
  }
  return supabase.from('challenges').update({ reward_pack_id: packId, prizes: tiers }).eq('id', gameId);
}
