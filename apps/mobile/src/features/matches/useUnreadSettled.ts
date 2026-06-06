import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bet } from '../../types';

const KEY = 'sportime:seenSettledBets';

function readSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set<string>();
  }
}

function writeSeen(s: Set<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...s]));
  } catch {
    /* ignore */
  }
}

/**
 * Tracks settled bets (won/lost) the user hasn't seen yet, persisted in
 * localStorage. `unreadCount` drives the Finished tab badge; `markAllSeen`
 * clears it (call when the user opens Finished).
 */
export function useUnreadSettled(bets: Bet[]) {
  const [seen, setSeen] = useState<Set<string>>(() => readSeen());

  const settledIds = useMemo(
    () => bets.filter((b) => b.status === 'won' || b.status === 'lost').map((b) => b.matchId),
    [bets],
  );

  const unreadCount = useMemo(
    () => settledIds.filter((id) => !seen.has(id)).length,
    [settledIds, seen],
  );

  const markAllSeen = useCallback(() => {
    setSeen((prev) => {
      let changed = false;
      const next = new Set(prev);
      settledIds.forEach((id) => {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      });
      if (changed) writeSeen(next);
      return changed ? next : prev;
    });
  }, [settledIds]);

  // Drop ids that are no longer settled bets (e.g. cancelled) to keep it small.
  useEffect(() => {
    setSeen((prev) => {
      if (prev.size === 0) return prev;
      const valid = new Set(settledIds);
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id);
        else changed = true;
      });
      if (changed) writeSeen(next);
      return changed ? next : prev;
    });
  }, [settledIds]);

  return { unreadCount, markAllSeen };
}
