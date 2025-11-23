import { useState, useEffect, useCallback } from 'react';
import {
  getUserSpinState,
  getSpinHistory,
  performSpin,
  claimDailyFreeSpin,
  updateAvailableSpins,
} from '../services/spinService';
import { SpinTier, UserSpinState, SpinResult } from '../types';

interface UseSpinWheelOptions {
  userId: string | null;
  enabled?: boolean;
}

interface UseSpinWheelReturn {
  // State
  spinState: UserSpinState | null;
  spinHistory: SpinResult[];
  isLoading: boolean;
  isSpinning: boolean;
  error: Error | null;

  // Actions
  spin: (tier: SpinTier) => Promise<SpinResult | null>;
  claimFreeSpin: () => Promise<{ success: boolean; message: string; nextAvailableAt: Date | null }>;
  addSpins: (tier: SpinTier, count: number) => Promise<void>;
  refresh: () => Promise<void>;
  refreshHistory: () => Promise<void>;

  // Helpers
  canSpin: (tier: SpinTier) => boolean;
  getAvailableSpins: (tier: SpinTier) => number;
  canClaimFreeSpin: boolean;
  nextFreeSpinAt: Date | null;
}

export function useSpinWheel({
  userId,
  enabled = true,
}: UseSpinWheelOptions): UseSpinWheelReturn {
  const [spinState, setSpinState] = useState<UserSpinState | null>(null);
  const [spinHistory, setSpinHistory] = useState<SpinResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSpinning, setIsSpinning] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // =====================================================
  // FETCH SPIN STATE
  // =====================================================

  const fetchSpinState = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const state = await getUserSpinState(userId);
      setSpinState(state);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch spin state');
      setError(error);
      console.error('Error fetching spin state:', error);
    }
  }, [userId]);

  // =====================================================
  // FETCH SPIN HISTORY
  // =====================================================

  const fetchSpinHistory = useCallback(async () => {
    if (!userId) return;

    try {
      const history = await getSpinHistory(userId, 20);
      setSpinHistory(history);
    } catch (err) {
      console.error('Error fetching spin history:', err);
      // Don't set error state for history failures
    }
  }, [userId]);

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    if (!enabled || !userId) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function load() {
      try {
        setIsLoading(true);
        await Promise.all([
          fetchSpinState(),
          fetchSpinHistory(),
        ]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [userId, enabled, fetchSpinState, fetchSpinHistory]);

  // =====================================================
  // PERFORM SPIN
  // =====================================================

  const spin = useCallback(async (tier: SpinTier): Promise<SpinResult | null> => {
    if (!userId) {
      setError(new Error('User not authenticated'));
      return null;
    }

    if (isSpinning) {
      console.warn('Spin already in progress');
      return null;
    }

    const availableCount = spinState?.availableSpins[tier] || 0;
    if (availableCount <= 0) {
      setError(new Error(`No ${tier} spins available`));
      return null;
    }

    try {
      setIsSpinning(true);
      setError(null);

      const result = await performSpin(userId, tier);

      // Refresh state and history after spin
      await Promise.all([
        fetchSpinState(),
        fetchSpinHistory(),
      ]);

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to perform spin');
      setError(error);
      console.error('Error performing spin:', error);
      return null;
    } finally {
      setIsSpinning(false);
    }
  }, [userId, isSpinning, spinState, fetchSpinState, fetchSpinHistory]);

  // =====================================================
  // CLAIM DAILY FREE SPIN
  // =====================================================

  const claimFreeSpin = useCallback(async () => {
    if (!userId) {
      throw new Error('User not authenticated');
    }

    try {
      setError(null);
      const result = await claimDailyFreeSpin(userId);

      // Refresh state after claiming
      await fetchSpinState();

      return {
        success: result.success,
        message: result.message,
        nextAvailableAt: result.nextAvailableAt,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to claim free spin');
      setError(error);
      console.error('Error claiming free spin:', error);
      throw error;
    }
  }, [userId, fetchSpinState]);

  // =====================================================
  // ADD SPINS (FOR REWARDS/ADMIN)
  // =====================================================

  const addSpins = useCallback(async (tier: SpinTier, count: number) => {
    if (!userId) {
      throw new Error('User not authenticated');
    }

    try {
      setError(null);
      await updateAvailableSpins(userId, tier, count);

      // Refresh state after adding spins
      await fetchSpinState();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to add spins');
      setError(error);
      console.error('Error adding spins:', error);
      throw error;
    }
  }, [userId, fetchSpinState]);

  // =====================================================
  // REFRESH FUNCTIONS
  // =====================================================

  const refresh = useCallback(async () => {
    await Promise.all([
      fetchSpinState(),
      fetchSpinHistory(),
    ]);
  }, [fetchSpinState, fetchSpinHistory]);

  const refreshHistory = useCallback(async () => {
    await fetchSpinHistory();
  }, [fetchSpinHistory]);

  // =====================================================
  // HELPER FUNCTIONS
  // =====================================================

  const canSpin = useCallback((tier: SpinTier): boolean => {
    return (spinState?.availableSpins[tier] || 0) > 0;
  }, [spinState]);

  const getAvailableSpins = useCallback((tier: SpinTier): number => {
    return spinState?.availableSpins[tier] || 0;
  }, [spinState]);

  const canClaimFreeSpin = (() => {
    if (!spinState?.lastFreeSpinAt) return true;

    const now = new Date();
    const lastClaim = new Date(spinState.lastFreeSpinAt);
    const hoursSinceLastClaim = (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60);

    return hoursSinceLastClaim >= 24;
  })();

  const nextFreeSpinAt = (() => {
    if (!spinState?.lastFreeSpinAt) return null;

    const lastClaim = new Date(spinState.lastFreeSpinAt);
    const nextAvailable = new Date(lastClaim.getTime() + 24 * 60 * 60 * 1000);

    return nextAvailable > new Date() ? nextAvailable : null;
  })();

  // =====================================================
  // RETURN
  // =====================================================

  return {
    // State
    spinState,
    spinHistory,
    isLoading,
    isSpinning,
    error,

    // Actions
    spin,
    claimFreeSpin,
    addSpins,
    refresh,
    refreshHistory,

    // Helpers
    canSpin,
    getAvailableSpins,
    canClaimFreeSpin,
    nextFreeSpinAt,
  };
}
