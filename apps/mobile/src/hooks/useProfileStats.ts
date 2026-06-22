import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

export interface FootballStats {
  predictions_total: number; predictions_correct: number; games_played: number;
  average_bet: number; gold: number; silver: number; bronze: number; most_played_league: string | null;
}
export interface F1Stats {
  bets_total: number; bets_won: number; bets_placed: number; games_played: number; average_bet: number;
  duels: number; predictor: number; fantasy: number; hof: number; last10_accuracy: number; favorite_game_type: string | null;
}
export interface ProfileStats {
  username: string;
  badges: { count: number; names: string[] };
  football: FootballStats;
  f1: F1Stats;
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
