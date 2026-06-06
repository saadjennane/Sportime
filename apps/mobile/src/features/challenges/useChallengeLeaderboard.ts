import { useEffect, useState, useCallback } from 'react';
import { fetchChallengeLeaderboard, ChallengeLeaderboardRow } from '../../services/challengeService';

/**
 * Authoritative challenge leaderboard (server points/rank). Used by both the
 * full LeaderboardPage and the in-room rank display — one source of truth.
 */
export function useChallengeLeaderboard(challengeId: string | null, enabled = true) {
  const [rows, setRows] = useState<ChallengeLeaderboardRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!challengeId || !enabled) {
      setRows([]);
      return;
    }
    setIsLoading(true);
    try {
      setRows(await fetchChallengeLeaderboard(challengeId));
    } finally {
      setIsLoading(false);
    }
  }, [challengeId, enabled]);

  useEffect(() => {
    let active = true;
    if (!challengeId || !enabled) {
      setRows([]);
      return;
    }
    setIsLoading(true);
    fetchChallengeLeaderboard(challengeId)
      .then(r => {
        if (active) setRows(r);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [challengeId, enabled]);

  return { rows, isLoading, refresh: load };
}
