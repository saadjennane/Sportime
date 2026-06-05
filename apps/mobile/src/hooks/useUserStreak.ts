import { useState, useEffect } from 'react';
import { getUserStreak } from '../services/streakService';
import type { UserStreak } from '../types';

interface UseUserStreakResult {
  streak: UserStreak | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage user streak data from Supabase
 * @param userId - The user ID to fetch streak for
 * @returns Streak data with loading and error states
 */
export function useUserStreak(userId: string | null | undefined): UseUserStreakResult {
  const [streak, setStreak] = useState<UserStreak | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchStreak = async () => {
    if (!userId) {
      setStreak(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await getUserStreak(userId);
      setStreak(data);
    } catch (err) {
      console.error('[useUserStreak] Failed to fetch streak:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch streak'));
      setStreak(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStreak();
  }, [userId]);

  return {
    streak,
    isLoading,
    error,
    refetch: fetchStreak,
  };
}
