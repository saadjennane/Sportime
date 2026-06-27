import { useEffect, useMemo, useState } from 'react';
import { SportimeGame, UserChallengeEntry, UserSwipeEntry, UserFantasyTeam } from '../../types';
import { hasPendingAction } from '../../services/gamePending';
import { tournamentHasPendingPicks } from '../../services/tournamentService';

/**
 * Set of game ids where the user (having joined) still has an action to take before
 * the deadline — a pick/prediction/lineup they'd otherwise forget and lose points on.
 *
 * Betting / prediction / fantasy are computed synchronously from already-loaded
 * catalog data. Tournament Quest needs a per-game fetch (entry + matches), done
 * asynchronously for joined, non-finished tournaments only.
 */
export function useGamePending(
  games: SportimeGame[],
  joinedGameIds: Set<string>,
  userChallengeEntries: UserChallengeEntry[],
  userSwipeEntries: UserSwipeEntry[],
  userFantasyTeams: UserFantasyTeam[],
  userId: string | null,
): Set<string> {
  // Full joined set (mirrors GamesListPage: entries imply membership).
  const joinedIds = useMemo(() => {
    const s = new Set(joinedGameIds);
    userChallengeEntries.forEach(e => s.add(e.challengeId));
    userSwipeEntries.forEach(e => s.add(e.matchDayId));
    userFantasyTeams.forEach(e => s.add(e.gameId));
    return s;
  }, [joinedGameIds, userChallengeEntries, userSwipeEntries, userFantasyTeams]);

  // Sync: betting / prediction / fantasy.
  const syncIds = useMemo(() => {
    const s = new Set<string>();
    for (const g of games) {
      if (!joinedIds.has(g.id)) continue;
      const ue = userChallengeEntries.find(e => e.challengeId === g.id);
      const se = userSwipeEntries.find(e => e.matchDayId === g.id);
      const ft = userFantasyTeams.find(t => t.gameId === g.id);
      if (hasPendingAction(g, true, ue, se, ft)) s.add(g.id);
    }
    return s;
  }, [games, joinedIds, userChallengeEntries, userSwipeEntries, userFantasyTeams]);

  // Async: Tournament Quest.
  const [tqIds, setTqIds] = useState<Set<string>>(new Set());
  const joinedTournamentIds = useMemo(
    () => games.filter(g => g.game_type === 'tournament' && joinedIds.has(g.id) && g.status !== 'Finished').map(g => g.id),
    [games, joinedIds],
  );
  const tqKey = joinedTournamentIds.join(',');
  useEffect(() => {
    if (!userId || joinedTournamentIds.length === 0) { setTqIds(new Set()); return; }
    let cancelled = false;
    Promise.all(joinedTournamentIds.map(async id => ({ id, pending: await tournamentHasPendingPicks(id, userId).catch(() => false) })))
      .then(rs => { if (!cancelled) setTqIds(new Set(rs.filter(r => r.pending).map(r => r.id))); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tqKey, userId]);

  return useMemo(() => new Set<string>([...syncIds, ...tqIds]), [syncIds, tqIds]);
}
