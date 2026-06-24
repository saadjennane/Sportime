import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

export interface SportStat {
  predictions_total: number;
  predictions_correct: number;
  games_played: number;
  average_pick: number;
  best_rank: number | null;
}
export interface ProfileStats {
  username: string;
  badges: { count: number; names: string[] };
  football: SportStat;
  f1: SportStat;
}

export function useProfileStats(userId: string | null | undefined) {
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) { setStats(null); setIsLoading(false); return; }
    let mounted = true;
    (async () => {
      try {
        setIsLoading(true); setError(null);
        const { data, error: rpcError } = await supabase.rpc('get_profile_stats', { p_user_id: userId });
        if (rpcError) throw rpcError;
        if (mounted) setStats((data ?? null) as ProfileStats | null);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err : new Error('Failed to fetch profile stats'));
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [userId]);

  return { stats, isLoading, error };
}
