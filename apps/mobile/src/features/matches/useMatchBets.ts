import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import type { Bet } from '../../types';
import { useResumeRefresh } from '../../native/useResumeRefresh';

interface UseMatchBetsReturn {
  bets: Bet[];
  isLoading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Loads the user's persisted match bets (table public.match_bets) and maps them
 * to the app's Bet shape. Replaces the previous in-memory bets so predictions
 * survive app restarts and reflect server-side settlement (won/lost).
 */
export function useMatchBets(userId: string | null): UseMatchBetsReturn {
  const [bets, setBets] = useState<Bet[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !userId) {
      setBets([]);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('match_bets')
        .select('fixture_id, prediction, amount, odds, status, potential_win')
        .eq('user_id', userId);
      if (error) throw error;

      setBets(
        (data ?? []).map((r: any): Bet => ({
          matchId: String(r.fixture_id),
          prediction: r.prediction,
          amount: r.amount,
          odds: Number(r.odds),
          status: r.status === 'won' ? 'won' : r.status === 'lost' ? 'lost' : 'pending',
          winAmount: r.status === 'won' ? r.potential_win : undefined,
        })),
      );
    } catch (err) {
      console.error('[useMatchBets] load failed', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh on app foreground (settlement may have happened while backgrounded).
  useResumeRefresh(load);

  return { bets, isLoading, refresh: load };
}
