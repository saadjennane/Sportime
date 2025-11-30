/**
 * useSwipeLeaderboard Hook
 *
 * Manages leaderboard data for swipe games including:
 * - Challenge-wide leaderboard (cumulative)
 * - Matchday-specific leaderboard
 * - User rank and stats
 * - Real-time updates
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../services/supabase';
import * as swipeService from '../../services/swipeGameService';
import type { SwipeLeaderboardEntry } from '../../types';

interface UserStats {
  totalPoints: number;
  rank: number | null;
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  matchdaysCompleted: number;
}

interface UseSwipeLeaderboardReturn {
  // Leaderboard data
  leaderboard: SwipeLeaderboardEntry[];
  matchdayLeaderboard: SwipeLeaderboardEntry[];

  // User stats
  userStats: UserStats | null;
  userPosition: number | null;

  // State
  isLoading: boolean;
  error: Error | null;

  // Actions
  refresh: () => Promise<void>;
  loadMatchdayLeaderboard: (matchdayId: string) => Promise<void>;
}

export function useSwipeLeaderboard(
  challengeId: string,
  userId: string | null
): UseSwipeLeaderboardReturn {
  const [leaderboard, setLeaderboard] = useState<SwipeLeaderboardEntry[]>([]);
  const [matchdayLeaderboard, setMatchdayLeaderboard] = useState<SwipeLeaderboardEntry[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [userPosition, setUserPosition] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load challenge-wide leaderboard
  const loadChallengeLeaderboard = useCallback(async () => {
    try {
      const data = await swipeService.getChallengeLeaderboard(challengeId);
      setLeaderboard(data);

      // Find user position
      if (userId) {
        const userIndex = data.findIndex(entry => entry.userId === userId);
        setUserPosition(userIndex >= 0 ? userIndex + 1 : null);
      }
    } catch (err) {
      console.error('Error loading challenge leaderboard:', err);
      setError(err as Error);
    }
  }, [challengeId, userId]);

  // Load matchday-specific leaderboard
  const loadMatchdayLeaderboard = useCallback(async (matchdayId: string) => {
    try {
      const data = await swipeService.getMatchdayLeaderboard(matchdayId);
      setMatchdayLeaderboard(data);
    } catch (err) {
      console.error('Error loading matchday leaderboard:', err);
      setError(err as Error);
    }
  }, []);

  // Load user stats
  const loadUserStats = useCallback(async () => {
    if (!userId) {
      setUserStats(null);
      return;
    }

    try {
      const stats = await swipeService.getUserChallengeStats(challengeId, userId);
      setUserStats(stats);
    } catch (err) {
      console.error('Error loading user stats:', err);
      setError(err as Error);
    }
  }, [challengeId, userId]);

  // Refresh all data
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await Promise.all([
        loadChallengeLeaderboard(),
        loadUserStats(),
      ]);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [loadChallengeLeaderboard, loadUserStats]);

  // Refs to stabilize callbacks and prevent infinite re-render loops
  const loadChallengeLeaderboardRef = useRef(loadChallengeLeaderboard);
  loadChallengeLeaderboardRef.current = loadChallengeLeaderboard;

  const loadUserStatsRef = useRef(loadUserStats);
  loadUserStatsRef.current = loadUserStats;

  // Initial load - use direct deps instead of refresh to avoid loops
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        await Promise.all([
          loadChallengeLeaderboardRef.current(),
          loadUserStatsRef.current(),
        ]);
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [challengeId, userId]);

  // Subscribe to real-time updates on challenge_participants
  // CRITICAL: Use refs to avoid re-subscribing on every callback change
  useEffect(() => {
    const channel = supabase
      .channel(`swipe-leaderboard-${challengeId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'challenge_participants',
          filter: `challenge_id=eq.${challengeId}`,
        },
        (payload) => {
          console.log('Leaderboard updated:', payload);
          loadChallengeLeaderboardRef.current();
          if (userId) {
            loadUserStatsRef.current();
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [challengeId, userId]); // REMOVED loadChallengeLeaderboard, loadUserStats from deps

  return {
    leaderboard,
    matchdayLeaderboard,
    userStats,
    userPosition,
    isLoading,
    error,
    refresh,
    loadMatchdayLeaderboard,
  };
}
