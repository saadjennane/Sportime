/**
 * useProgression Hook
 *
 * Manages user progression state with real-time updates from Supabase.
 * Tracks XP, level, and provides progression summary.
 *
 * Usage:
 *   const { progression, isLoading, refetch } = useProgression(userId);
 *
 *   if (progression) {
 *     console.log(`Level: ${progression.level_name}`);
 *     console.log(`XP: ${progression.xp_total}`);
 *     console.log(`Progress: ${progression.progress_percentage}%`);
 *   }
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { getUserProgressionSummary } from '../services/activityTracker';

export interface UserProgression {
  xp_total: number;
  current_level: number;
  level_name: string;
  xp_to_next_level: number;
  progress_percentage: number;
  goat_bonus_active: boolean;
  weeks_inactive: number;
  will_decay: boolean;
}

interface UseProgressionReturn {
  progression: UserProgression | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Helper to check if userId is a valid UUID
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Mock progression data for non-UUID users (dev/testing)
function getMockProgression(userId: string): UserProgression {
  return {
    xp_total: 2500,
    current_level: 1,
    level_name: 'Rookie',
    xp_to_next_level: 2500,
    progress_percentage: 50,
    goat_bonus_active: false,
    weeks_inactive: 0,
    will_decay: false,
  };
}

export function useProgression(userId: string | null): UseProgressionReturn {
  const [progression, setProgression] = useState<UserProgression | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProgression = useCallback(async () => {
    if (!userId) {
      setProgression(null);
      setIsLoading(false);
      return;
    }

    // If not a valid UUID, use mock data (for development with mock users)
    if (!isValidUUID(userId)) {
      setProgression(getMockProgression(userId));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const summary = await getUserProgressionSummary(userId);

      if (summary) {
        setProgression(summary);
      } else {
        setError('Failed to load progression data');
      }
    } catch (err: any) {
      console.error('[useProgression] Error:', err);
      setError(err.message || 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    fetchProgression();
  }, [fetchProgression]);

  // Subscribe to real-time updates on users table
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`user-progression-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          console.log('[useProgression] User updated, refetching...');
          fetchProgression();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchProgression]);

  return {
    progression,
    isLoading,
    error,
    refetch: fetchProgression,
  };
}
