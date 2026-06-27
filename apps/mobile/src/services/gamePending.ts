import { SportimeGame, UserChallengeEntry, UserSwipeEntry, UserFantasyTeam } from '../types';
import { calculateGameState } from './gameStateService';

/**
 * Whether a JOINED game still needs the user to act before the deadline
 * (a pick to place, predictions to make, a fantasy team to complete).
 *
 * True only when the current period is still OPEN (`category === 'active'` →
 * first match hasn't started yet) AND the user's action for that period is
 * incomplete. Started/awaiting/finished windows never count — the points can no
 * longer be earned there, so nudging would be pointless.
 *
 * Purpose: surface a badge so users don't forget to pick and miss points.
 */
export function hasPendingAction(
  game: SportimeGame,
  joined: boolean,
  userEntry: UserChallengeEntry | undefined,
  userSwipeEntry: UserSwipeEntry | undefined,
  userFantasyTeam: UserFantasyTeam | undefined,
  now: Date = new Date(),
): boolean {
  if (!joined) return false;
  const gt = game.game_type;
  // Only the formats with a per-period user action.
  if (gt !== 'betting' && gt !== 'prediction' && gt !== 'fantasy') return false;

  const gs = calculateGameState(game, userEntry, userFantasyTeam, now);
  if (gs.category !== 'active') return false; // window must be open

  if (gt === 'betting') {
    const cur = userEntry?.dailyEntries?.[userEntry.dailyEntries.length - 1];
    const totalBet = cur?.bets?.reduce((s, b) => s + b.amount, 0) ?? 0;
    return totalBet < 1000; // incomplete stake for the open matchday
  }

  if (gt === 'prediction') {
    const total = userSwipeEntry?.currentMatchdayFixtureCount ?? 0;
    const made = userSwipeEntry?.predictions.length ?? 0;
    return !(total > 0 && made >= total); // not all fixtures predicted
  }

  // fantasy: team not selected / not complete (VIEW_GAME means 11 starters set)
  return gs.cta === 'SELECT_TEAM' || gs.cta === 'COMPLETE_TEAM';
}

/** Count of joined games awaiting a user action — for the footer badge. */
export function countPendingActions(
  games: SportimeGame[],
  joinedIds: Set<string>,
  userChallengeEntries: UserChallengeEntry[],
  userSwipeEntries: UserSwipeEntry[],
  userFantasyTeams: UserFantasyTeam[],
  now: Date = new Date(),
): number {
  return games.reduce((n, g) => {
    const joined = joinedIds.has(g.id);
    if (!joined) return n;
    const ue = userChallengeEntries.find(e => e.challengeId === g.id);
    const se = userSwipeEntries.find(e => e.matchDayId === g.id);
    const ft = userFantasyTeams.find(t => t.gameId === g.id);
    return n + (hasPendingAction(g, joined, ue, se, ft, now) ? 1 : 0);
  }, 0);
}
