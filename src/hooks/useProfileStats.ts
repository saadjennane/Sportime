import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import type { UserProfileStatsData } from '../types';

interface ProfileStatsResponse {
  username: string;
  predictions_total: number;
  predictions_correct: number;
  hot_performance_index: number;
  best_hpi: number;
  best_hpi_date: string | null;
  streak: number;
  average_bet_coins: number;
  risk_index: number;
  games_played: number;
  gold_podiums: number;
  silver_podiums: number;
  bronze_podiums: number;
  trophies: number;
  badge_count: number;
  badge_names: string[];
  most_played_league: string;
  most_played_team: string;
  favorite_game_type: string;
  last_10_days_accuracy: number;
}

export function useProfileStats(userId: string | null | undefined) {
  const [stats, setStats] = useState<UserProfileStatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setStats(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function fetchStats() {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: rpcError } = await supabase
          .rpc('get_user_profile_stats', { p_user_id: userId })
          .single();

        if (rpcError) throw rpcError;

        if (!isMounted) return;

        if (data) {
          const response = data as ProfileStatsResponse;

          // Transform to frontend format
          const transformedStats: UserProfileStatsData = {
            username: response.username,
            predictionsTotal: response.predictions_total,
            predictionsCorrect: response.predictions_correct,
            hotPerformanceIndex: response.hot_performance_index,
            bestHotDay: response.best_hpi_date
              ? {
                  date: response.best_hpi_date,
                  hpi: response.best_hpi,
                  correct: 0, // Not calculated in view, could be added if needed
                  total: 0,
                }
              : { date: '', hpi: 0, correct: 0, total: 0 },
            streak: response.streak,
            averageBetCoins: Math.round(response.average_bet_coins),
            riskIndex: response.risk_index,
            gamesPlayed: response.games_played,
            podiums: {
              gold: response.gold_podiums,
              silver: response.silver_podiums,
              bronze: response.bronze_podiums,
            },
            trophies: response.trophies,
            badges: response.badge_names,
            mostPlayedLeague: response.most_played_league,
            mostPlayedTeam: response.most_played_team,
            favoriteGameType: response.favorite_game_type,
            last10DaysAccuracy: response.last_10_days_accuracy,
          };

          setStats(transformedStats);
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('[useProfileStats] Error:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch profile stats'));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchStats();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  return { stats, isLoading, error };
}
