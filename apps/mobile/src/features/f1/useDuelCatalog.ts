import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import type { SportimeGame } from '../../types';

/** Encode/parse the race id inside a duel game's SportimeGame id. */
export const DUEL_ID_PREFIX = 'f1duel:';
export const duelRaceId = (gameId: string): number | null =>
  gameId.startsWith(DUEL_ID_PREFIX) ? Number(gameId.slice(DUEL_ID_PREFIX.length)) : null;

/** Loads Teammates Duels games and maps them into the unified SportimeGame catalog,
 *  so they appear in the Games list (Browse / My Games) like any other game. */
export function useDuelCatalog(userId: string | null | undefined) {
  const [games, setGames] = useState<SportimeGame[]>([]);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('f1_duel_games')
      .select('id,race_id,status,entry_cost,rewards,pairs,is_active,entry_lock_at,race:f1_races(name,round,race_at,status)')
      .eq('is_active', true)
      .order('race_id');
    const rows = (data ?? []) as any[];

    let joined = new Set<string>();
    if (userId && rows.length) {
      const { data: picks } = await supabase
        .from('f1_duel_picks')
        .select('game_id')
        .eq('user_id', userId)
        .in('game_id', rows.map((r) => r.id));
      const joinedGameUuids = new Set((picks ?? []).map((p: any) => p.game_id));
      joined = new Set(rows.filter((r) => joinedGameUuids.has(r.id)).map((r) => DUEL_ID_PREFIX + r.race_id));
    }

    const mapped: SportimeGame[] = rows.map((r) => {
      const raceAt: string | null = r.race?.race_at ?? null;
      const topReward = Math.max(0, ...Object.values((r.rewards ?? {}) as Record<string, number>).map(Number));
      const status: SportimeGame['status'] =
        r.status === 'settled' || r.race?.status === 'Completed' ? 'Finished'
          : raceAt && new Date(raceAt).getTime() <= Date.now() ? 'Ongoing' : 'Upcoming';
      return {
        id: DUEL_ID_PREFIX + r.race_id,
        name: `Teammates Duels · ${r.race?.name ?? 'Grand Prix'}`,
        description: '11 duels — pick which teammate finishes ahead.',
        start_date: new Date().toISOString(),
        end_date: raceAt ?? new Date(Date.now() + 7 * 864e5).toISOString(),
        game_type: 'duel',
        entry_cost: r.entry_cost ?? 0,
        minimum_players: 0,
        maximum_players: 1_000_000,
        status,
        totalPlayers: 0,
        participants: [],
        rewards: topReward > 0 ? [{ rank: '1', reward: { type: 'coins', amount: topReward } } as any] : [],
        first_kickoff_time: raceAt ?? undefined,
        entry_deadline: raceAt ?? undefined,
        entry_lock_at: r.entry_lock_at ?? undefined,
      };
    });

    setGames(mapped);
    setJoinedIds(joined);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  return { duelGames: games, duelJoinedIds: joinedIds, refreshDuels: load };
}
