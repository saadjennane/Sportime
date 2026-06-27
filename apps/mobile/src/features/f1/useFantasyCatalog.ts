import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import type { SportimeGame } from '../../types';

export const FF_ID_PREFIX = 'f1fantasy:';
export const fantasyGameId = (id: string): string | null =>
  id.startsWith(FF_ID_PREFIX) ? id.slice(FF_ID_PREFIX.length) : null;

const COND: Record<string, string> = {
  standard: 'Standard', no_stars: 'No Stars', double_star: 'Double Star',
  underdog: 'Underdog', constructor_chaos: 'Constructor Chaos', free: 'Free Choice',
};

/** Maps Fantasy F1 games into the unified SportimeGame catalog (F1 Games list). */
export function useFantasyCatalog(userId: string | null | undefined) {
  const [games, setGames] = useState<SportimeGame[]>([]);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('f1_fantasy_games')
      .select('id,condition,status,entry_lock_at,race:f1_races(name,quali_start_at,race_at,status)')
      .eq('is_active', true).order('created_at', { ascending: false });
    const rows = (data ?? []) as any[];
    if (!rows.length) { setGames([]); setJoinedIds(new Set()); return; }

    let joined = new Set<string>();
    if (userId) {
      const { data: r } = await supabase.from('f1_fantasy_rosters').select('game_id').eq('user_id', userId).in('game_id', rows.map((x) => x.id));
      const gj = new Set((r ?? []).map((p: any) => p.game_id));
      joined = new Set(rows.filter((x) => gj.has(x.id)).map((x) => FF_ID_PREFIX + x.id));
    }

    const now = Date.now();
    const mapped: SportimeGame[] = rows.map((r) => {
      const raceAt: string | null = r.race?.race_at ?? null;
      const quali: string | null = r.race?.quali_start_at ?? null;
      const status: SportimeGame['status'] = r.status === 'settled' || r.race?.status === 'Completed' ? 'Finished'
        : raceAt && new Date(raceAt).getTime() <= now ? 'Ongoing' : 'Upcoming';
      return {
        id: FF_ID_PREFIX + r.id,
        name: `Fantasy F1 · ${r.race?.name ?? 'Grand Prix'}`,
        description: `${COND[r.condition] ?? r.condition} — pick 3 drivers + 1 constructor. Energy, boosters, live scoring.`,
        start_date: new Date().toISOString(),
        end_date: raceAt ?? new Date(now + 7 * 864e5).toISOString(),
        game_type: 'f1fantasy',
        entry_cost: 0, minimum_players: 0, maximum_players: 1_000_000,
        status, totalPlayers: 0, participants: [], rewards: [],
        first_kickoff_time: quali ?? undefined, entry_deadline: quali ?? undefined,
        entry_lock_at: r.entry_lock_at ?? undefined,
      };
    });
    setGames(mapped);
    setJoinedIds(joined);
  }, [userId]);

  useEffect(() => { load(); }, [load]);
  return { fantasyGames: games, fantasyJoinedIds: joinedIds, refreshFantasy: load };
}
