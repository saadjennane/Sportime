import { supabase } from './supabase';

export type GameType = 'tournament' | 'betting' | 'prediction' | 'fantasy';

/** MasterPasses the user currently owns (available), by tier. */
export async function getAvailableMasterpasses(): Promise<{ tier: string; count: number }[]> {
  const { data } = await supabase
    .from('user_masterpasses').select('tier').eq('status', 'available');
  const counts: Record<string, number> = {};
  for (const r of (data ?? []) as any[]) counts[r.tier] = (counts[r.tier] ?? 0) + 1;
  return Object.entries(counts).map(([tier, count]) => ({ tier, count }));
}

export async function hasMasterpassForTier(tier?: string | null): Promise<boolean> {
  if (!tier) return false;
  const { count } = await supabase
    .from('user_masterpasses').select('id', { count: 'exact', head: true })
    .eq('status', 'available').eq('tier', tier);
  return (count ?? 0) > 0;
}

/** Use a masterpass to join a game (free) + open a +1 invite. Returns {token, invite_id}. */
export async function useMasterpass(gameType: GameType, gameId: string) {
  const { data, error } = await supabase.rpc('use_masterpass', { p_game_type: gameType, p_game_id: gameId });
  if (error) return { ok: false, error: error.message };
  return data as any;
}

export async function inviteByUsername(inviteId: string, username: string) {
  const { data, error } = await supabase.rpc('tq_masterpass_invite_username', { p_invite_id: inviteId, p_username: username });
  if (error) return { ok: false, error: error.message };
  return data as any;
}

export async function claimMasterpassInvite(token: string) {
  const { data, error } = await supabase.rpc('tq_claim_masterpass_invite', { p_token: token });
  if (error) return { ok: false, error: error.message };
  return data as any;
}

/** Pending +1 invite the user created for a given game (for the persistent "invite your +1" access). */
export async function getPendingInvite(gameId: string) {
  const { data } = await supabase
    .from('tq_masterpass_invites')
    .select('id, token, status, invitee_user_id')
    .eq('game_id', gameId).eq('status', 'pending')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data;
}

export function buildInviteLink(token: string): string {
  return `https://sportime.app/i/${token}`;
}

/** All pending +1 invites the user created, keyed by game id (for persistent re-open access). */
export async function getMyPendingInvites(): Promise<Record<string, { inviteId: string; token: string }>> {
  const { data } = await supabase
    .from('tq_masterpass_invites')
    .select('id, token, game_id')
    .eq('status', 'pending');
  const map: Record<string, { inviteId: string; token: string }> = {};
  for (const r of (data ?? []) as any[]) if (r.game_id) map[r.game_id] = { inviteId: r.id, token: r.token };
  return map;
}
