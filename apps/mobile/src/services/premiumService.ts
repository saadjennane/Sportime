import { supabase } from './supabase';

export interface PremiumDailyClaim {
  ok: boolean;
  already?: boolean;
  coins?: number;
  spins?: number;
  tickets?: number;
  error?: string;
}

/** Grant today's premium perks (coins + spins). Idempotent server-side per day. */
export async function claimPremiumDaily(): Promise<PremiumDailyClaim> {
  if (!supabase) return { ok: false, error: 'offline' };
  const { data, error } = await supabase.rpc('premium_daily_claim');
  if (error) return { ok: false, error: error.message };
  return (data ?? { ok: false }) as PremiumDailyClaim;
}

export interface PredictionStats {
  ok: boolean;
  total: number;
  correct: number;
  accuracy_pct: number;
  by_type: Record<string, { total: number; correct: number }>;
  last30: { total: number; correct: number; accuracy_pct: number };
  current_streak: number;
}

/** Which of the given user ids are subscribers — for badging any leaderboard. */
export async function fetchSubscriberSet(userIds: string[]): Promise<Set<string>> {
  if (!supabase || userIds.length === 0) return new Set();
  const { data } = await supabase.from('profiles').select('id').in('id', userIds).eq('is_subscriber', true);
  return new Set((data ?? []).map((r: any) => r.id as string));
}

/** Advanced prediction analytics for the Premium stats screen. */
export async function getPredictionStats(userId?: string): Promise<PredictionStats | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_prediction_stats', { p_user_id: userId ?? null });
  if (error) return null;
  return data as PredictionStats;
}
